import {GARMENT_SLOTS, isGarmentSlot, slotOf} from '../category';
import type {GarmentSlot} from '../category';
import type {Asset, Candidate, DeviceError, FaceMask, Media, Piece, Result, SelfPhoto, Store} from '../native/contracts';
import type {RelayResponse} from '../relay/client';
import type {UploadImageReader} from '../relay/selfPhoto';
import {safeError, TryOnError} from './errors';
import {serializeTryOn} from './request';
import type {PreparedResult, TryOnRequest} from './request';

/** The mannequin: at most one piece per slot. Empty slots follow the relay's slot rules. */
export type Outfit = Readonly<Partial<Record<GarmentSlot, string>>>;
export type TryOnDraft = {readonly outfit: Outfit};
/** Filled slots in mannequin order (outer, top, bottom); also the stored Result order. */
export function wornSlots(outfit: Outfit): [GarmentSlot, string][] {
  return GARMENT_SLOTS.flatMap(slot => outfit[slot] ? [[slot, outfit[slot]] as [GarmentSlot, string]] : []);
}
export type TryOnPhase = 'idle' | 'preparing' | 'sending' | 'compositing' | 'saving' | 'cancelling' | 'complete' | 'failed' | 'cancelled';
export type TryOnState = {
  readonly draft: TryOnDraft;
  readonly phase: TryOnPhase;
  readonly selfState: 'empty' | 'ready' | 'registering' | 'failed';
  readonly selfPhoto: SelfPhoto | null;
  readonly result: Result | null;
  readonly error: DeviceError | null;
};
export interface TryOnDependencies {
  store: Store;
  faceMask: Pick<FaceMask, 'register' | 'compose'>;
  readImage: UploadImageReader;
  request(body: TryOnRequest, signal: AbortSignal): Promise<RelayResponse<'/v1/tryon'>>;
  writeProvider(image: RelayResponse<'/v1/tryon'>['image']): Promise<string>;
  online(): Promise<boolean>;
  exportResult(resultId: string): Promise<{uri: string}>;
  discardAsset: Media['discard'];
}
export interface TryOnController {
  getSnapshot(): TryOnState;
  subscribe(listener: () => void): () => void;
  /** Put a sorted piece on the mannequin in its own slot, keeping the other slots. */
  wear(pieceId: string): Promise<GarmentSlot>;
  /** Put a piece in `slot`; a piece not yet sorted into that slot is re-categorised first. */
  setSlot(slot: GarmentSlot, pieceId: string): Promise<void>;
  clearSlot(slot: GarmentSlot): void;
  addTripCandidate(candidate: Candidate, slot: GarmentSlot, signal?: AbortSignal): Promise<Piece>;
  registerSelf(asset: Asset): Promise<boolean>;
  generate(): Promise<Result | null>;
  cancel(): void;
  restoreResult(result: Result): Promise<void>;
  canChangePieces(result: Result): Promise<boolean>;
  exportResult(resultId: string): Promise<{uri: string}>;
  refresh(): Promise<void>;
  dispose(): Promise<void>;
}

export function createTryOnController(deps: TryOnDependencies): TryOnController {
  let state: TryOnState = Object.freeze({draft: Object.freeze({outfit: Object.freeze({})}), phase: 'idle', selfState: 'empty', selfPhoto: null, result: null, error: null});
  const listeners = new Set<() => void>();
  let active: AbortController | null = null;
  let running: Promise<Result | null> | null = null;
  let editing = false;
  let disposed = false;
  let revision = 0;
  let refreshRevision = 0;
  const publish = (patch: Partial<TryOnState>) => {
    state = Object.freeze({...state, ...patch});
    if (!disposed) for (const listener of listeners) listener();
  };
  const draft = (outfit: Outfit) => {
    revision++;
    publish({draft: Object.freeze({outfit: Object.freeze({...outfit})}), phase: 'idle', result: null, error: null});
  };
  const withSlot = (slot: GarmentSlot, id: string | undefined): Outfit => {
    const next: Partial<Record<GarmentSlot, string>> = {...state.draft.outfit};
    // A piece moved to another slot leaves its old one.
    for (const other of GARMENT_SLOTS) if (id && next[other] === id) delete next[other];
    if (id) next[slot] = id; else delete next[slot];
    return next;
  };
  const idle = () => {
    if (disposed) throw new TryOnError('cancelled');
    if (active || editing || state.selfState === 'registering') throw new TryOnError('busy');
  };
  const piece = async (id: string) => {
    if (typeof id !== 'string' || !id) throw new TryOnError('invalid_composition');
    const value = await deps.store.get({entity: 'Piece', id});
    if (!value) throw new TryOnError('invalid_reference');
    if (value.origin !== 'shop' && value.origin !== 'wardrobe') throw new TryOnError('invalid_composition');
    return value;
  };
  // A piece is worn only under its exact stored slot, so the wire category is never guessed.
  const validate = async (value: TryOnDraft) => {
    const worn = wornSlots(value.outfit);
    if (!worn.length || Object.keys(value.outfit).some(slot => !isGarmentSlot(slot)) ||
        new Set(worn.map(([, id]) => id)).size !== worn.length) throw new TryOnError('invalid_composition');
    for (const [slot, id] of worn) if ((await piece(id)).category !== slot) throw new TryOnError('invalid_composition');
    return worn;
  };
  // Sorting is an explicit user choice; it keeps the label, like a rename.
  const sortInto = async (value: Piece, slot: GarmentSlot) =>
    value.category === slot ? value : deps.store.updatePiece({id: value.id, label: value.label, category: slot});
  const edit = async (action: () => Promise<void>) => {
    idle();
    editing = true;
    try { await action(); } finally { editing = false; }
  };
  const refresh = async () => {
    const current = ++refreshRevision;
    const self = await deps.store.getSelfPhoto();
    if (disposed || current !== refreshRevision || state.selfState === 'registering') return;
    // A failed replacement never silently unlocks generation with the previous photo.
    publish({selfPhoto: self, selfState: state.selfState === 'failed' ? 'failed' : self ? 'ready' : 'empty'});
  };
  const cancel = () => {
    revision++;
    active?.abort();
    if (active) publish({phase: 'cancelling', error: null});
  };
  const run = async (operation: AbortController): Promise<Result | null> => {
    const signal = operation.signal;
    let prepared: PreparedResult | null = null;
    let saved: Result | null = null;
    let error: DeviceError | null = null;
    const temp = new Set<string>();
    try {
      publish({phase: 'preparing', error: null, result: null});
      if (state.selfState === 'failed') throw new TryOnError('masking_failed');
      if (!await deps.online()) throw new TryOnError('offline', true);
      signal.throwIfAborted();
      const worn = await validate(state.draft);
      signal.throwIfAborted();
      const currentSelf = await deps.store.getSelfPhoto();
      const self = currentSelf ? {...currentSelf} : null;
      if (!self) throw new TryOnError('self_photo_required');
      if (!self.maskedFile || self.maskedFile === self.file || self.maskedFile === self.headMask) throw new TryOnError('masking_failed');
      signal.throwIfAborted();
      // Stored as lead piece + the rest, in mannequin slot order.
      const ids = worn.map(([, id]) => id);
      prepared = await deps.store.prepareResult({targetPieceId: ids[0], companionPieceIds: ids.slice(1)});
      signal.throwIfAborted();
      const body = await serializeTryOn(self.maskedFile, prepared, deps.readImage, signal);
      signal.throwIfAborted();
      publish({phase: 'sending'});
      const response = await deps.request(body, signal);
      signal.throwIfAborted();
      const providerFile = await deps.writeProvider(response.image);
      temp.add(providerFile);
      signal.throwIfAborted();
      publish({phase: 'compositing'});
      const composed = await deps.faceMask.compose({providerFile, selfUpdatedAt: self.updatedAt});
      if (composed.ok && ![self.file, self.headMask, self.maskedFile, providerFile].includes(composed.file)) temp.add(composed.file);
      signal.throwIfAborted();
      if (!composed.ok) throw new TryOnError(composed.reason);
      const metrics = composed.metrics;
      const measurements = [metrics.neckColorDeltaE95, metrics.shoulderColorDeltaE95, metrics.neckOffsetRatio95, metrics.shoulderOffsetRatio95];
      if ([self.file, self.headMask, self.maskedFile, providerFile].includes(composed.file) || composed.faceless === metrics.passed ||
          (metrics.passed && (metrics.decision !== 'composited' || !metrics.thresholdVersion ||
            measurements.some(value => value === null || !Number.isFinite(value) || value < 0))) ||
          (!metrics.passed && metrics.decision === 'composited')) throw new TryOnError('unsafe_output');
      publish({phase: 'saving'});
      saved = await deps.store.saveResult({draftId: prepared.draftId, file: composed.file, faceless: composed.faceless, providerFile});
      // A cancellation during the atomic save removes that result, not an unrelated one.
      signal.throwIfAborted();
    } catch (cause) {
      error = signal.aborted ? null : safeError(cause);
    } finally {
      // Keep the operation busy until native work and file ownership cleanup settle.
      // Discarding an already-promoted draft is a no-op in both repositories.
      const cleanup = [...temp].map(async file => deps.store.discardTemp({file}));
      if (prepared) cleanup.push(deps.store.discardResultDraft({draftId: prepared.draftId}));
      const failures = await Promise.allSettled(cleanup);
      if (failures.some(result => result.status === 'rejected')) error = safeError(new TryOnError('io_error'));
      // Cancellation can arrive during the atomic save or its asynchronous cleanup.
      if (saved && signal.aborted) {
        try { await deps.store.deleteResult({id: saved.id}); }
        catch { error = safeError(new TryOnError('io_error')); }
      }
      active = null;
      running = null;
    }
    const result = signal.aborted ? null : saved;
    publish({phase: signal.aborted ? 'cancelled' : result ? 'complete' : 'failed', result, error});
    return result;
  };
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async wear(pieceId) {
      let slot: GarmentSlot | null = null;
      await edit(async () => {
        const value = await piece(pieceId);
        slot = slotOf(value);
        if (!slot) throw new TryOnError('category_required');
        await sortInto(value, slot);
        draft(withSlot(slot, pieceId));
      });
      await refresh();
      return slot!;
    },
    async setSlot(slot, pieceId) {
      if (!isGarmentSlot(slot)) throw new TryOnError('invalid_composition');
      await edit(async () => { await sortInto(await piece(pieceId), slot); draft(withSlot(slot, pieceId)); });
    },
    clearSlot(slot) { idle(); if (isGarmentSlot(slot)) draft(withSlot(slot, undefined)); },
    async addTripCandidate(candidate, slot, signal) {
      if (!isGarmentSlot(slot)) throw new TryOnError('invalid_composition');
      let saved: Piece | undefined;
      await edit(async () => {
        const version = revision;
        signal?.throwIfAborted();
        // Spark still names it; the slot the user chose stays its category.
        saved = await deps.store.saveCandidate({candidate, origin: 'shop', labelMode: 'describe', category: slot});
        signal?.throwIfAborted();
        if (disposed || version !== revision) throw new TryOnError('cancelled');
        // The same cut saved earlier comes back as-is and may need sorting.
        saved = await sortInto(saved, slot);
        if (disposed || version !== revision) throw new TryOnError('cancelled');
        draft(withSlot(slot, saved.id));
      });
      return saved!;
    },
    async registerSelf(asset) {
      idle();
      refreshRevision++;
      publish({selfState: 'registering', error: null});
      try {
        const result = await deps.faceMask.register({asset});
        if (!result.ok) {
          publish({selfState: 'failed', error: safeError(new TryOnError('masking_failed'))});
          return false;
        }
        publish({selfPhoto: result.selfPhoto, selfState: 'ready', error: null});
        return true;
      } catch (error) {
        publish({selfState: 'failed', error: safeError(error)});
        return false;
      } finally {
        await deps.discardAsset({assetId: asset.id});
      }
    },
    generate() {
      idle();
      active = new AbortController();
      running = run(active);
      return running;
    },
    cancel,
    async restoreResult(result) {
      await edit(async () => {
        // Deleted or re-sorted pieces drop out; the rest go back in their current slot.
        const outfit: Partial<Record<GarmentSlot, string>> = {};
        for (const id of [result.targetPieceId, ...result.companionPieceIds]) {
          const value = await deps.store.get({entity: 'Piece', id});
          const slot = value && value.category === slotOf(value) ? slotOf(value) : null;
          if (slot && !outfit[slot]) outfit[slot] = id;
        }
        if (!Object.keys(outfit).length) throw new TryOnError('invalid_reference');
        draft(outfit);
      });
      await refresh();
    },
    async canChangePieces(result) {
      for (const id of [result.targetPieceId, ...result.companionPieceIds]) {
        const value = await deps.store.get({entity: 'Piece', id});
        if (value && value.category === slotOf(value)) return true;
      }
      return false;
    },
    exportResult: deps.exportResult,
    refresh,
    async dispose() { disposed = true; cancel(); listeners.clear(); await running; },
  };
}
