import {vi} from 'vitest';
import {GARMENT_SLOTS} from '../category';
import type {GarmentSlot} from '../category';
import type {ComposeMetrics, FaceMask, Piece, Result, ResultPieceSnapshot, SelfPhoto, Store} from '../native/contracts';
import type {TryOnDependencies} from './controller';
import {createTryOnController} from './controller';
import {encodeBase64, imageDimensions} from './images';
import {TryOnError} from './errors';
import type {PreparedResult} from './request';

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}

// Synthetic contract fixture: top two rows are explicitly removed, not a renamed raw file.
export function png(masked: boolean): Uint8Array {
  // 8×8 RGBA PNG: red head occupies y=0..1, green body y=2..7.
  // Masked PNG zeroes RGBA in every head pixel before encoding.
  const encoded = masked
    ? 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAEUlEQVR4nGNgoBz8JwCHggIAzjRfoSeVDD0AAAAASUVORK5CYII='
    : 'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAGElEQVR4nGP4z8DwHx9mIKgArAYfHAoKAJMHf4HehUPRAAAAAElFTkSuQmCC';
  return Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
}

export const passedMetrics: ComposeMetrics = {neckColorDeltaE95: 1, shoulderColorDeltaE95: 1, neckOffsetRatio95: 0.01, shoulderOffsetRatio95: 0.01, thresholdVersion: 'contract-fixture-only', passed: true, decision: 'composited'};
export function fixture() {
  const raw = png(false);
  const masked = png(true);
  const files = new Map<string, Uint8Array>([['private/ORIGINAL_SELF_SENTINEL', raw], ['private/HEAD_MASK_SENTINEL', raw], ['private/masked', masked]]);
  const self: SelfPhoto = {file: 'private/ORIGINAL_SELF_SENTINEL', headMask: 'private/HEAD_MASK_SENTINEL', maskedFile: 'private/masked', updatedAt: 123};
  const pieces = new Map<string, Piece>();
  // piece-0 outer/shop, piece-1 top/wardrobe, piece-2 bottom/shop, piece-3 outer/wardrobe, ...
  for (let index = 0; index < 8; index++) {
    const id = `piece-${index}`;
    files.set(`cutout/${id}`, masked.slice());
    pieces.set(id, {id, origin: index % 2 ? 'wardrobe' : 'shop', label: `Label ${index}`, category: GARMENT_SLOTS[index % 3], cutoutFile: `cutout/${id}`, createdAt: 1, photoId: 'photo-original', tripId: 'trip-original', shopId: 'shop-original', walkTo: {lat: 37, lng: 127}});
  }
  const drafts = new Map<string, PreparedResult>();
  const results = new Map<string, Result>();
  const labels: {cutoutFile: string; label: string; category: string}[] = [];
  let serial = 0;
  const copy = (source: string, destination: string) => {
    const bytes = files.get(source);
    if (!bytes) throw new TryOnError('io_error');
    files.set(destination, bytes.slice());
    return destination;
  };
  const snapshot = (id: string, draftId: string): ResultPieceSnapshot => {
    const value = pieces.get(id);
    if (!value) throw new TryOnError('invalid_reference');
    return {pieceId: id, origin: value.origin, label: value.label, category: value.category, cutoutFile: copy(value.cutoutFile, `draft/${draftId}/${id}`), walkTo: value.walkTo && {...value.walkTo}, shop: {n: 1, startedAt: 1, storefrontFile: null, description: 'snapshot shop', note: 'snapshot note'}};
  };
  const store = {
    get: vi.fn(async ({entity, id}: {entity: string; id: string}) => entity === 'Piece' ? pieces.get(id) ?? null : results.get(id) ?? null),
    getSelfPhoto: vi.fn(async () => self as SelfPhoto | null),
    prepareResult: vi.fn(async ({targetPieceId, companionPieceIds}: {targetPieceId: string; companionPieceIds: string[]}) => {
      const draftId = `draft-${++serial}`;
      const value = {draftId, targetSnapshot: snapshot(targetPieceId, draftId), companionSnapshots: companionPieceIds.map(id => snapshot(id, draftId))};
      drafts.set(draftId, value);
      return value;
    }),
    saveResult: vi.fn(async ({draftId, file, faceless, providerFile}: {draftId: string; file: string; faceless: boolean; providerFile: string}) => {
      const prepared = drafts.get(draftId)!;
      const result: Result = {id: draftId, targetPieceId: prepared.targetSnapshot.pieceId, companionPieceIds: prepared.companionSnapshots.map(piece => piece.pieceId), targetSnapshot: structuredClone(prepared.targetSnapshot), companionSnapshots: structuredClone(prepared.companionSnapshots), file: copy(file, `result/${draftId}/composed`), providerFile: copy(providerFile, `result/${draftId}/provider`), faceless, createdAt: 999};
      results.set(draftId, result); drafts.delete(draftId);
      return result;
    }),
    discardResultDraft: vi.fn(async ({draftId}: {draftId: string}) => {
      const prepared = drafts.get(draftId);
      if (prepared) for (const value of [prepared.targetSnapshot, ...prepared.companionSnapshots]) files.delete(value.cutoutFile);
      drafts.delete(draftId);
    }),
    discardTemp: vi.fn(async ({file}: {file: string}) => { files.delete(file); }),
    deleteResult: vi.fn(async ({id}: {id: string}) => { results.delete(id); }),
    saveCandidate: vi.fn(async (input?: {category?: GarmentSlot}) => {
      const value: Piece = {...pieces.get('piece-2')!, id: `saved-${++serial}`, label: 'Picked item', category: input?.category ?? 'unknown'};
      pieces.set(value.id, value); labels.push({cutoutFile: value.cutoutFile, label: value.label, category: value.category}); return value;
    }),
    updatePiece: vi.fn(async ({id, label, category}: {id: string; label: string; category: string}) => {
      const value = pieces.get(id);
      if (!value) throw new TryOnError('not_found');
      const updated = {...value, label, category}; pieces.set(id, updated); return updated;
    }),
  };
  const faceMask = {
    register: vi.fn<FaceMask['register']>(async () => ({ok: true, selfPhoto: self, metrics: {personAccepted: true, headAreaRatio: 0.25, gtHeadPixels: 16, exposedHeadPixels: 0, privacyPassed: true}})),
    compose: vi.fn<FaceMask['compose']>(async ({providerFile, selfUpdatedAt}) => {
      if (selfUpdatedAt !== self.updatedAt) return {ok: false, reason: 'self_photo_changed', metrics: passedMetrics};
      return {ok: true, file: copy(providerFile, 'cache/composed'), faceless: false, metrics: passedMetrics};
    }),
  };
  const deps: TryOnDependencies = {
    store: store as unknown as Store,
    faceMask,
    readImage: vi.fn(async file => {
      const bytes = files.get(file);
      if (!bytes) throw new TryOnError('io_error');
      return {...imageDimensions(bytes), data: encodeBase64(bytes)};
    }),
    request: vi.fn(async () => ({image: {...imageDimensions(masked), data: encodeBase64(masked)}})),
    writeProvider: vi.fn(async image => { const file = `cache/provider-${++serial}`; files.set(file, Uint8Array.from(atob(image.data), char => char.charCodeAt(0))); return file; }),
    online: vi.fn(async () => true),
    exportResult: vi.fn(async () => { throw new TryOnError('result_download_disabled'); }),
    discardAsset: vi.fn(async () => {}),
  };
  return {controller: createTryOnController(deps), deps, store, faceMask, pieces, drafts, results, files, self, raw, masked, labels};
}
