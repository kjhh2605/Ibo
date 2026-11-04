import type {Asset, Candidate, DeviceRepository, EntityMap, FileRef, Fix, Id, Listener, Page, Photo, PhotoEmbedding, Piece, QueueJob, Result, ResultPieceSnapshot, SelfPhoto, Shop, Store, Trip} from '../../native/contracts';
import {Database, entities} from './database';
import type {Draft, Transaction} from './database';
import {browserImages, cutout, failure, prepareMask} from './images';
import type {ImageCodec} from './images';
import {acquireDatabaseLease} from './lease';

type Change = {entities: (keyof EntityMap | 'SelfPhoto')[]; ids: Id[]};
type ListOptions<K extends keyof EntityMap> = {entity: K; tripId?: Id; shopId?: Id; origin?: 'shop' | 'wardrobe'; limit?: number; cursor?: string};
type Options = {name?: string; now?: () => number; images?: ImageCodec; epoch?: string};
const runtimeEpoch = crypto.randomUUID();
// Only transient dispatch/listener state lives here. Every entity and file lives in IndexedDB.
const runtimes = new Map<string, {claims: Set<string>; listeners: Set<(event: Change) => void>}>();
const validId = (value: string) => { if (typeof value !== 'string' || !value.length || value.length > 128) failure('invalid_argument'); };
const time = (value: number) => { if (!Number.isSafeInteger(value) || value < 0) failure('invalid_argument'); };
const text = (value: string, max: number) => { if (typeof value !== 'string' || !value.trim() || value.trim().length > max) failure('invalid_argument'); return value.trim(); };
function location(value: {lat: number; lng: number; accuracyM: number}) {
  if (!value || !Number.isFinite(value.lat) || Math.abs(value.lat) > 90 || !Number.isFinite(value.lng) || Math.abs(value.lng) > 180 || !Number.isFinite(value.accuracyM) || value.accuracyM < 0) failure('invalid_argument');
}
function fix(value: Fix) { location(value); time(value.t); }
function dimensions(value: {w: number; h: number}) { if (!Number.isSafeInteger(value.w) || !Number.isSafeInteger(value.h) || value.w < 1 || value.h < 1) failure('invalid_argument'); }
function key<K extends keyof EntityMap>(_entity: K, row: EntityMap[K]): string {
  if ('id' in row) return row.id;
  if ('t' in row) return `${row.tripId}:${row.t}`;
  return row.photoId;
}
function order<K extends keyof EntityMap>(entity: K, row: EntityMap[K]): (number | string)[] {
  const id = key(entity, row);
  if ('n' in row) return [row.tripId, row.n, id];
  if ('startedAt' in row) return [-row.startedAt, id];
  if ('takenAt' in row) return [-row.takenAt, id];
  if ('createdAt' in row) return [-row.createdAt, id];
  if ('t' in row) return [row.t, id];
  if ('nextAt' in row) return [row.nextAt, id];
  return [id];
}
function compare(a: (number | string)[], b: (number | string)[]) { for (let i = 0; i < a.length; i++) { if (a[i] < b[i]) return -1; if (a[i] > b[i]) return 1; } return 0; }

export class WebRepository implements Store, DeviceRepository {
  private readonly db: Database;
  private readonly now: () => number;
  private readonly images: ImageCodec;
  private readonly epoch: string;
  private readonly runtime: {claims: Set<string>; listeners: Set<(event: Change) => void>};
  private ready: Promise<void> | undefined;
  private releaseLease: (() => Promise<void>) | undefined;
  private sessionStopper: (() => Promise<unknown>) | undefined;
  constructor(options: Options = {}) {
    this.db = new Database(options.name ?? 'street-fitting');
    this.now = options.now ?? Date.now;
    this.images = options.images ?? browserImages;
    this.epoch = options.epoch ?? runtimeEpoch;
    let runtime = runtimes.get(this.db.name);
    if (!runtime) { runtime = {claims: new Set(), listeners: new Set()}; runtimes.set(this.db.name, runtime); }
    this.runtime = runtime;
  }
  private initialize(): Promise<void> {
    return this.ready ??= this.recover().catch(error => {this.ready = undefined; throw error;});
  }
  private async recover(): Promise<void> {
    this.releaseLease = await acquireDatabaseLease(this.db.name, this.epoch);
    try {
      await this.db.run(true, async tx => {
        const previous = await tx.get('meta', 'epoch');
        if (previous?.value === this.epoch) return;
        // Incomplete drafts and cache are never product records; committed results keep their own files.
        for (const draft of await tx.all('drafts')) await tx.delete('drafts', draft.draftId);
        for (const asset of await tx.all('assets')) await tx.delete('assets', asset.asset.id);
        for (const row of await tx.all('files')) {
          if (row.discard || row.owner === 'temp' || row.owner.startsWith('draft:') || row.owner.startsWith('asset:')) await tx.delete('files', row.file);
          else if (row.pins) await tx.put('files', row.file, {...row, pins: 0});
        }
        for (const version of await tx.all('self')) {
          if (version.current) await tx.put('self', version.selfPhoto.updatedAt, {...version, refs: 0});
          else { await tx.removeOwner(`self:${version.selfPhoto.updatedAt}`); await tx.delete('self', version.selfPhoto.updatedAt); }
        }
        this.runtime.claims.clear();
        await tx.put('meta', 'epoch', {value: this.epoch});
      });
    } catch (error) {
      await this.releaseLease();
      this.releaseLease = undefined;
      throw error;
    }
  }
  private async run<T>(write: boolean, work: (tx: Transaction) => Promise<T>, changed?: Change): Promise<T> {
    await this.initialize();
    const value = await this.db.run(write, work);
    if (changed) for (const listener of this.runtime.listeners) { try { listener(structuredClone(changed)); } catch { /* Listener failures cannot roll back committed data. */ } }
    return value;
  }
  async close(): Promise<void> {
    await this.ready?.catch(() => {});
    await this.db.close();
    await this.releaseLease?.();
    this.releaseLease = undefined;
    this.ready = undefined;
  }
  async addListener(_name: 'changed', fn: (event: Change) => void): Promise<Listener> {
    if (_name !== 'changed') failure('invalid_argument');
    this.runtime.listeners.add(fn);
    return {remove: async () => { this.runtime.listeners.delete(fn); }};
  }
  async readBlob(file: FileRef): Promise<Blob> { return this.run(false, async tx => (await tx.file(file)).blob); }
  async writeBlob(blob: Blob, purpose: string, ownerId?: string): Promise<FileRef> {
    if (!(blob instanceof Blob) || !blob.size) failure('invalid_argument');
    text(purpose, 64);
    if (ownerId !== undefined) { validId(ownerId); if (purpose !== 'candidate-mask') failure('invalid_argument'); }
    return this.run(true, async tx => {
      const file = await tx.blob(blob, 'temp', purpose, this.epoch);
      if (ownerId !== undefined) {
        if (!(await tx.get('Photo', ownerId)) && !(await tx.get('assets', ownerId))) failure('invalid_reference');
        await tx.put('files', file, {...await tx.file(file), sourceId: ownerId});
      }
      return file;
    });
  }
  setSessionStopper(callback: () => Promise<unknown>): void { this.sessionStopper = callback; }
  async getPhoto({id}: {id: Id}): Promise<Photo | null> { return this.get({entity: 'Photo', id}); }
  async getAsset({id}: {id: Id}): Promise<Asset | null> {
    return this.run(false, async tx => {
      const photo = await tx.get('Photo', id);
      if (photo) return {id: photo.id, file: photo.file, w: photo.w, h: photo.h};
      return (await tx.get('assets', id))?.asset ?? null;
    });
  }
  async getSession(): Promise<{trip: Trip | null; shop: Shop | null; photos: Photo[]; latestFix: Fix | null}> {
    return this.run(false, async tx => {
      const trip = (await tx.all('Trip')).find(row => row.status === 'recording') ?? null;
      if (!trip) return {trip: null, shop: null, photos: [], latestFix: null};
      const shop = (await tx.all('Shop')).filter(row => row.tripId === trip.id).sort((a, b) => b.n - a.n)[0] ?? null;
      const photos = (await tx.all('Photo')).filter(row => row.tripId === trip.id);
      const latest = (await tx.all('TrailPoint')).filter(row => row.tripId === trip.id).sort((a, b) => b.t - a.t)[0];
      const latestFix = latest ? {t: latest.t, lat: latest.lat, lng: latest.lng, accuracyM: latest.accuracyM} : null;
      return {trip, shop, photos, latestFix};
    });
  }
  async nearestFix({tripId, takenAt}: {tripId: Id; takenAt: number}): Promise<Fix | null> {
    validId(tripId); time(takenAt);
    return this.run(false, async tx => {
      const nearest = (await tx.all('TrailPoint')).filter(row => row.tripId === tripId && Math.abs(row.t - takenAt) <= 15000 && row.accuracyM <= 100).sort((a, b) => Math.abs(a.t - takenAt) - Math.abs(b.t - takenAt) || a.t - b.t)[0];
      return nearest ? {t: nearest.t, lat: nearest.lat, lng: nearest.lng, accuracyM: nearest.accuracyM} : null;
    });
  }
  async registerAsset({asset, purpose}: {asset: Asset; purpose: string}): Promise<Asset> {
    validId(asset.id); dimensions(asset);
    if (purpose !== 'wardrobe' && purpose !== 'self') failure('invalid_argument');
    return this.run(true, async tx => {
      const row = await tx.file(asset.file);
      if (row.owner !== 'temp') failure('file_not_owned');
      if (await tx.get('assets', asset.id) || await tx.get('Photo', asset.id)) failure('constraint_violation');
      await tx.put('assets', asset.id, {asset, purpose});
      await tx.put('files', asset.file, {...row, owner: `asset:${asset.id}`, purpose});
      return asset;
    });
  }
  async discardAsset({assetId}: {assetId: Id}): Promise<void> {
    await this.run(true, async tx => {
      const asset = await tx.get('assets', assetId);
      if (!asset) return;
      await tx.removeFile(asset.asset.file);
      // A saving candidate pins this import until its independent cutout commits.
      const file = await tx.get('files', asset.asset.file);
      if (!file?.pins) await tx.delete('assets', assetId);
    });
  }
  async get<K extends keyof EntityMap>({entity, id}: {entity: K; id: Id}): Promise<EntityMap[K] | null> {
    if (!entities.includes(entity)) failure('invalid_argument');
    if (entity === 'TrailPoint') {
      const split = id.lastIndexOf(':');
      validId(id.slice(0, split)); time(Number(id.slice(split + 1)));
      if (split < 0 || !/^(0|[1-9][0-9]*)$/.test(id.slice(split + 1))) failure('invalid_argument');
    } else validId(id);
    return this.run(false, async tx => (await tx.get(entity, id)) ?? null);
  }
  async list<K extends keyof EntityMap>(options: ListOptions<K>): Promise<Page<EntityMap[K]>> {
    const {entity, tripId, shopId, origin, cursor} = options;
    const limit = options.limit ?? 50;
    if (!entities.includes(entity) || !Number.isInteger(limit) || limit < 1 || limit > 200) failure('invalid_argument');
    if (tripId !== undefined) { validId(tripId); if (!['Shop', 'Photo', 'TrailPoint', 'Piece'].includes(entity)) failure('invalid_argument'); }
    if (shopId !== undefined) { validId(shopId); if (!['Photo', 'Piece'].includes(entity)) failure('invalid_argument'); }
    if (origin !== undefined && (entity !== 'Piece' || !['shop', 'wardrobe'].includes(origin))) failure('invalid_argument');
    const signature = JSON.stringify([entity, tripId ?? null, shopId ?? null, origin ?? null]);
    let after: (number | string)[] | undefined;
    if (cursor !== undefined) {
      try {
        const parsed: unknown = JSON.parse(decodeURIComponent(atob(cursor)));
        if (!parsed || typeof parsed !== 'object' || !('signature' in parsed) || parsed.signature !== signature || !('order' in parsed) || !Array.isArray(parsed.order) || parsed.order.some(value => typeof value !== 'string' && (typeof value !== 'number' || !Number.isFinite(value)))) failure('invalid_argument');
        const expectedLength = entity === 'Shop' ? 3 : entity === 'PhotoEmbedding' ? 1 : 2;
        if (parsed.order.length !== expectedLength || typeof parsed.order[expectedLength - 1] !== 'string') failure('invalid_argument');
        after = parsed.order;
      } catch { failure('invalid_argument'); }
    }
    return this.run(false, async tx => {
      const rows = (await tx.all(entity)).filter(row => {
        return (tripId === undefined || ('tripId' in row && row.tripId === tripId)) && (shopId === undefined || ('shopId' in row && row.shopId === shopId)) && (origin === undefined || ('origin' in row && row.origin === origin)) && (!after || compare(order(entity, row), after) > 0);
      }).sort((a, b) => compare(order(entity, a), order(entity, b)));
      const items = rows.slice(0, limit);
      return {items, nextCursor: rows.length > limit ? btoa(encodeURIComponent(JSON.stringify({signature, order: order(entity, items[items.length - 1])}))) : null};
    });
  }
  async startSession({fix: value}: {fix: Fix}): Promise<{trip: Trip; shop: Shop}> {
    fix(value); const now = value.t;
    return this.run(true, async tx => {
      const recording = (await tx.all('Trip')).find(trip => trip.status === 'recording');
      if (recording) {
        const current = (await tx.all('Shop')).filter(shop => shop.tripId === recording.id).sort((a, b) => b.n - a.n)[0];
        if (!current) failure('constraint_violation');
        return {trip: recording, shop: current};
      }
      const trip: Trip = {id: crypto.randomUUID(), startedAt: now, endedAt: null, status: 'recording'};
      const shop = this.shop(trip.id, 1, now, value);
      await tx.put('Trip', trip.id, trip); await tx.put('Shop', shop.id, shop);
      await tx.put('TrailPoint', `${trip.id}:${value.t}`, {...value, tripId: trip.id});
      return {trip, shop};
    }, {entities: ['Trip', 'Shop', 'TrailPoint'], ids: []});
  }
  private shop(tripId: string, n: number, startedAt: number, value: Fix): Shop {
    return {id: crypto.randomUUID(), tripId, n, startedAt, spot: {lat: value.lat, lng: value.lng, accuracyM: value.accuracyM}, storefrontPhotoId: null, description: null, descriptionState: 'none', note: null};
  }
  async newShop({tripId, fix: value}: {tripId: Id; fix: Fix}): Promise<Shop> {
    validId(tripId); fix(value);
    return this.run(true, async tx => {
      const trip = await tx.get('Trip', tripId);
      if (!trip || trip.status !== 'recording') failure('not_recording');
      const n = 1 + Math.max(0, ...(await tx.all('Shop')).filter(shop => shop.tripId === tripId).map(shop => shop.n));
      if (value.t < trip.startedAt) failure('constraint_violation');
      const shop = this.shop(tripId, n, value.t, value);
      time(shop.startedAt); await tx.put('Shop', shop.id, shop); return shop;
    }, {entities: ['Shop'], ids: [tripId]});
  }
  async appendTrail({tripId, fix: value}: {tripId: Id; fix: Fix}): Promise<void> {
    validId(tripId); fix(value);
    await this.run(true, async tx => {
      if ((await tx.get('Trip', tripId))?.status !== 'recording') failure('not_recording');
      await tx.put('TrailPoint', `${tripId}:${value.t}`, {...value, tripId});
    }, {entities: ['TrailPoint'], ids: [tripId]});
  }
  async stopSession({tripId, endedAt}: {tripId: Id; endedAt: number}): Promise<Trip> {
    validId(tripId); time(endedAt);
    return this.run(true, async tx => {
      const trip = await tx.get('Trip', tripId); if (!trip) failure('not_found');
      if (endedAt < trip.startedAt) failure('constraint_violation');
      const ended: Trip = trip.status === 'ended' ? trip : {...trip, endedAt, status: 'ended'};
      await tx.put('Trip', tripId, ended);
      for (const point of await tx.all('TrailPoint')) if (point.tripId === tripId) await tx.delete('TrailPoint', `${tripId}:${point.t}`);
      return ended;
    }, {entities: ['Trip', 'TrailPoint'], ids: [tripId]});
  }
  async commitPhoto({photo, storefrontEdit = false}: {photo: Photo; storefrontEdit?: boolean}): Promise<Photo> {
    validId(photo.id); validId(photo.tripId); validId(photo.shopId); dimensions(photo); location(photo.location); time(photo.takenAt);
    if (!['item', 'storefront'].includes(photo.kind) || photo.indexState !== 'pending' ||
        typeof storefrontEdit !== 'boolean' || (storefrontEdit && photo.kind !== 'storefront')) failure('invalid_argument');
    return this.run(true, async tx => {
      const trip = await tx.get('Trip', photo.tripId), shop = await tx.get('Shop', photo.shopId);
      if (!trip || (!storefrontEdit && trip.status !== 'recording') || !shop || shop.tripId !== photo.tripId || photo.takenAt < trip.startedAt) failure('invalid_reference');
      if (await tx.get('Photo', photo.id)) failure('constraint_violation');
      const file = await tx.file(photo.file); if (file.owner !== 'temp' || !['image/jpeg', 'image/png'].includes(file.blob.type)) failure('file_not_owned');
      await tx.put('files', file.file, {...file, owner: `photo:${photo.id}`});
      await tx.put('Photo', photo.id, photo);
      if (photo.kind === 'storefront') {
        if (shop.storefrontPhotoId) await this.removeJobs(tx, 'describe_storefront', shop.storefrontPhotoId);
        await tx.put('Shop', shop.id, {...shop, storefrontPhotoId: photo.id, description: null, descriptionState: 'pending'});
        await this.addJob(tx, 'describe_storefront', photo.id);
      }
      return photo;
    }, {entities: photo.kind === 'storefront' ? ['Photo', 'Shop', 'QueueJob'] : ['Photo'], ids: [photo.id, photo.shopId]});
  }
  async commitEmbedding({embedding}: {embedding: PhotoEmbedding}): Promise<PhotoEmbedding> {
    validId(embedding.photoId);
    if (embedding.model !== 'pe-core-t16-image' || embedding.dim !== 512 || embedding.vector.length !== 512 || embedding.vector.some(value => !Number.isFinite(value)) || Math.abs(Math.hypot(...embedding.vector) - 1) > 1e-4) failure('invalid_vector');
    const stored: PhotoEmbedding = {...embedding, vector: Array.from(new Float32Array(embedding.vector))};
    return this.run(true, async tx => {
      const photo = await tx.get('Photo', embedding.photoId); if (!photo) failure('not_found');
      const existing = await tx.get('PhotoEmbedding', embedding.photoId); if (existing) return existing;
      await tx.put('PhotoEmbedding', embedding.photoId, stored);
      await tx.put('Photo', photo.id, {...photo, indexState: 'done'}); return stored;
    }, {entities: ['Photo', 'PhotoEmbedding'], ids: [embedding.photoId]});
  }
  async markIndexFailed({photoId}: {photoId: Id}): Promise<void> {
    await this.run(true, async tx => {
      const photo = await tx.get('Photo', photoId); if (!photo || photo.indexState === 'done') return;
      await tx.delete('PhotoEmbedding', photoId); await tx.put('Photo', photoId, {...photo, indexState: 'failed'});
    }, {entities: ['Photo', 'PhotoEmbedding'], ids: [photoId]});
  }
  async saveCandidate({candidate, origin, labelMode}: {candidate: Candidate; origin: 'shop' | 'wardrobe'; labelMode: 'concept' | 'describe'}): Promise<Piece> {
    validId(candidate.photoId); text(candidate.label, 120);
    if (!['shop', 'wardrobe'].includes(origin) || !['concept', 'describe'].includes(labelMode) || (origin === 'wardrobe' && labelMode !== 'describe') || !['sam', 'edgetam'].includes(candidate.source) || !Number.isFinite(candidate.score) || candidate.score < 0 || candidate.score > 1 || !Array.isArray(candidate.bbox) || candidate.bbox.length !== 4) failure('invalid_argument');
    const pinned = [candidate.mask];
    const maskBlob = await this.run(true, async tx => {
      const mask = await tx.file(candidate.mask);
      if (mask.owner !== 'temp' || mask.purpose !== 'candidate-mask' || (mask.sourceId !== undefined && mask.sourceId !== candidate.photoId)) failure('file_not_owned');
      await tx.put('files', mask.file, {...mask, pins: mask.pins + 1, sourceId: candidate.photoId});
      return mask.blob;
    });
    try {
      const mask = await prepareMask(this.images, maskBlob, candidate);
      const input = await this.run(true, async tx => {
        const existing = await tx.get('Piece', mask.id);
        if (existing) { if (existing.origin !== origin) failure('constraint_violation'); return {existing}; }
        const photo = await tx.get('Photo', candidate.photoId), asset = await tx.get('assets', candidate.photoId);
        const source = origin === 'shop' ? photo : asset?.purpose === 'wardrobe' ? asset.asset : undefined;
        if (!source) failure('invalid_reference');
        if (source.w !== mask.width || source.h !== mask.height) failure('invalid_argument');
        const image = await tx.file(source.file);
        await tx.put('files', image.file, {...image, pins: image.pins + 1});
        return {source, image: image.blob};
      });
      if (input.existing) return input.existing;
      if (!input.source || !input.image) failure('invalid_reference');
      const source = input.source;
      pinned.push(source.file);
      const cropped = await cutout(this.images, input.image, mask);
      return await this.run(true, async tx => {
        const existing = await tx.get('Piece', cropped.id); if (existing) return existing;
        const photo = origin === 'shop' ? await tx.get('Photo', candidate.photoId) : undefined;
        if (origin === 'shop' && !photo) failure('not_found');
        if (origin === 'wardrobe' && !(await tx.get('assets', candidate.photoId))) failure('not_found');
        const piece: Piece = {id: cropped.id, origin, label: labelMode === 'concept' ? candidate.label.trim() : 'Picked item', category: 'unknown', cutoutFile: await tx.blob(cropped.blob, `piece:${cropped.id}`, 'cutout', this.epoch), createdAt: this.now(), photoId: photo?.id ?? null, tripId: photo?.tripId ?? null, shopId: photo?.shopId ?? null, walkTo: photo ? {lat: photo.location.lat, lng: photo.location.lng} : null};
        time(piece.createdAt); await tx.put('Piece', piece.id, piece);
        if (labelMode === 'describe') await this.addJob(tx, 'label_piece', piece.id);
        if (origin === 'wardrobe') await tx.removeFile(source.file);
        return piece;
      }, {entities: ['Piece', 'QueueJob'], ids: [mask.id]});
    } finally {
      await this.run(true, async tx => {
        for (const file of pinned) {
          const row = await tx.get('files', file); if (!row) continue;
          const pins = Math.max(0, row.pins - 1);
          if (!pins && row.discard) {
            await tx.delete('files', file);
            if (row.owner.startsWith('asset:')) await tx.delete('assets', row.owner.slice(6));
          } else await tx.put('files', file, {...row, pins});
        }
      });
    }
  }
  async updateShop({id, note}: {id: Id; note: string | null}): Promise<Shop> {
    validId(id); const value = note === null || note.trim() === '' ? null : text(note, 280);
    return this.run(true, async tx => { const shop = await tx.get('Shop', id); if (!shop) failure('not_found'); const updated = {...shop, note: value}; await tx.put('Shop', id, updated); return updated; }, {entities: ['Shop'], ids: [id]});
  }
  async updatePiece({id, label, category}: {id: Id; label: string; category: string}): Promise<Piece> {
    validId(id); label = text(label, 120); category = text(category, 64);
    return this.run(true, async tx => {
      const piece = await tx.get('Piece', id); if (!piece) failure('not_found');
      const updated = {...piece, label, category}; await tx.put('Piece', id, updated); await this.removeJobs(tx, 'label_piece', id); return updated;
    }, {entities: ['Piece', 'QueueJob'], ids: [id]});
  }
  private async snapshot(tx: Transaction, piece: Piece, owner: string): Promise<ResultPieceSnapshot> {
    const shop = piece.shopId ? await tx.get('Shop', piece.shopId) : undefined;
    const storefront = shop?.storefrontPhotoId ? await tx.get('Photo', shop.storefrontPhotoId) : undefined;
    return {pieceId: piece.id, origin: piece.origin, label: piece.label, category: piece.category, walkTo: piece.walkTo, cutoutFile: await tx.copy(piece.cutoutFile, owner, 'snapshot-cutout', this.epoch), shop: shop ? {n: shop.n, startedAt: shop.startedAt, description: shop.description, note: shop.note, storefrontFile: storefront ? await tx.copy(storefront.file, owner, 'snapshot-storefront', this.epoch) : null} : null};
  }
  async prepareResult({targetPieceId, companionPieceIds}: {targetPieceId: Id; companionPieceIds: Id[]}): Promise<Draft> {
    validId(targetPieceId); companionPieceIds.forEach(validId);
    if (companionPieceIds.length > 5 || new Set([targetPieceId, ...companionPieceIds]).size !== companionPieceIds.length + 1) failure('invalid_argument');
    return this.run(true, async tx => {
      const target = await tx.get('Piece', targetPieceId);
      if (!target || target.origin !== 'shop' || !target.walkTo) failure('invalid_reference');
      const companions: Piece[] = [];
      for (const id of companionPieceIds) { const piece = await tx.get('Piece', id); if (!piece) failure('invalid_reference'); companions.push(piece); }
      const draftId = crypto.randomUUID(), owner = `draft:${draftId}`;
      const targetSnapshot = await this.snapshot(tx, target, owner), companionSnapshots: ResultPieceSnapshot[] = [];
      for (const piece of companions) companionSnapshots.push(await this.snapshot(tx, piece, owner));
      const draft = {draftId, targetSnapshot, companionSnapshots}; await tx.put('drafts', draftId, draft); return draft;
    });
  }
  async saveResult({draftId, file, faceless, providerFile}: {draftId: Id; file: FileRef; faceless: boolean; providerFile: FileRef}): Promise<Result> {
    validId(draftId); if (typeof faceless !== 'boolean' || file === providerFile) failure('invalid_argument');
    return this.run(true, async tx => {
      const existing = await tx.get('Result', draftId); if (existing) return existing;
      const draft = await tx.get('drafts', draftId); if (!draft) failure('not_found');
      const display = await tx.file(file), provider = await tx.file(providerFile);
      if (display.owner !== 'temp' || !['composed', 'faceless'].includes(display.purpose) || provider.owner !== 'temp' || provider.purpose !== 'provider') failure('file_not_owned');
      const owner = `result:${draftId}`;
      const result: Result = {id: draftId, targetPieceId: draft.targetSnapshot.pieceId, companionPieceIds: draft.companionSnapshots.map(piece => piece.pieceId), targetSnapshot: draft.targetSnapshot, companionSnapshots: draft.companionSnapshots, file: await tx.copy(file, owner, 'result', this.epoch), providerFile: await tx.copy(providerFile, owner, 'provider', this.epoch), faceless, createdAt: this.now()};
      time(result.createdAt);
      for (const row of await tx.all('files')) if (row.owner === `draft:${draftId}`) await tx.put('files', row.file, {...row, owner});
      await tx.put('Result', draftId, result); await tx.delete('drafts', draftId);
      await tx.removeFile(file); await tx.removeFile(providerFile); return result;
    }, {entities: ['Result'], ids: [draftId]});
  }
  async discardResultDraft({draftId}: {draftId: Id}): Promise<void> { await this.run(true, async tx => { await tx.removeOwner(`draft:${draftId}`); await tx.delete('drafts', draftId); }); }
  async deleteResult({id}: {id: Id}): Promise<void> { await this.run(true, async tx => { await tx.delete('Result', id); await tx.removeOwner(`result:${id}`); }, {entities: ['Result'], ids: [id]}); }
  async deletePiece({id}: {id: Id}): Promise<void> { await this.run(true, async tx => { await tx.delete('Piece', id); await tx.removeOwner(`piece:${id}`); await this.removeJobs(tx, 'label_piece', id); }, {entities: ['Piece', 'QueueJob'], ids: [id]}); }
  private async removePhoto(tx: Transaction, id: Id): Promise<void> {
    const photo = await tx.get('Photo', id); if (!photo) return;
    await tx.delete('Photo', id); await tx.delete('PhotoEmbedding', id); await tx.removeOwner(`photo:${id}`);
    for (const row of await tx.all('files')) if (row.sourceId === id) await tx.removeFile(row.file);
    await this.removeJobs(tx, 'describe_storefront', id);
    const shop = await tx.get('Shop', photo.shopId);
    if (shop?.storefrontPhotoId === id) await tx.put('Shop', shop.id, {...shop, storefrontPhotoId: null, description: null, descriptionState: 'none'});
    for (const piece of await tx.all('Piece')) if (piece.photoId === id) await tx.put('Piece', piece.id, {...piece, photoId: null});
  }
  async deletePhoto({id}: {id: Id}): Promise<void> { await this.run(true, tx => this.removePhoto(tx, id), {entities: ['Photo', 'PhotoEmbedding', 'Shop', 'Piece', 'QueueJob'], ids: [id]}); }
  async deleteTrip({id}: {id: Id}): Promise<void> {
    const trip = await this.get({entity: 'Trip', id});
    if (trip?.status === 'recording') {
      if (this.sessionStopper) await this.sessionStopper();
      else await this.stopSession({tripId: id, endedAt: Math.max(trip.startedAt, this.now())});
    }
    await this.run(true, async tx => {
      for (const photo of await tx.all('Photo')) if (photo.tripId === id) await this.removePhoto(tx, photo.id);
      for (const shop of await tx.all('Shop')) if (shop.tripId === id) await tx.delete('Shop', shop.id);
      for (const point of await tx.all('TrailPoint')) if (point.tripId === id) await tx.delete('TrailPoint', `${id}:${point.t}`);
      for (const piece of await tx.all('Piece')) if (piece.tripId === id) await tx.put('Piece', piece.id, {...piece, photoId: null, shopId: null, tripId: null});
      await tx.delete('Trip', id);
    }, {entities: ['Trip', 'TrailPoint', 'Shop', 'Photo', 'PhotoEmbedding', 'Piece', 'QueueJob'], ids: [id]});
  }
  async discardTemp({file}: {file: FileRef}): Promise<void> {
    await this.run(true, async tx => {
      const row = await tx.get('files', file); if (!row) return;
      if (row.owner !== 'temp' && !row.owner.startsWith('asset:')) failure('file_not_owned');
      await tx.removeFile(file);
      if (row.owner.startsWith('asset:') && !row.pins) await tx.delete('assets', row.owner.slice(6));
    });
  }
  async getSelfPhoto(): Promise<SelfPhoto | null> { return this.run(false, async tx => (await tx.all('self')).find(row => row.current)?.selfPhoto ?? null); }
  async replaceSelfPhoto({selfPhoto, sidecar}: {selfPhoto: SelfPhoto; sidecar?: FileRef}): Promise<SelfPhoto> {
    time(selfPhoto.updatedAt);
    if (new Set([selfPhoto.file, selfPhoto.headMask, selfPhoto.maskedFile]).size !== 3) failure('invalid_argument');
    return this.run(true, async tx => {
      const versions = await tx.all('self');
      if (versions.some(row => row.selfPhoto.updatedAt >= selfPhoto.updatedAt)) failure('constraint_violation');
      const owner = `self:${selfPhoto.updatedAt}`;
      for (const [file, purpose] of [[selfPhoto.file, 'self-original'], [selfPhoto.headMask, 'self-head-mask'], [selfPhoto.maskedFile, 'self-masked'], ...(sidecar ? [[sidecar, 'self-sidecar']] : [])]) {
        const row = await tx.file(file);
        if (row.owner !== 'temp' && !(purpose === 'self-original' && row.owner.startsWith('asset:') && row.purpose === 'self')) failure('file_not_owned');
        if (purpose !== 'self-original' && row.purpose !== purpose) failure('file_not_owned');
        if (row.owner.startsWith('asset:')) await tx.delete('assets', row.owner.slice(6));
        await tx.put('files', file, {...row, owner, purpose});
      }
      for (const version of versions) if (version.current) {
        if (version.refs) await tx.put('self', version.selfPhoto.updatedAt, {...version, current: false});
        else { await tx.removeOwner(`self:${version.selfPhoto.updatedAt}`); await tx.delete('self', version.selfPhoto.updatedAt); }
      }
      await tx.put('self', selfPhoto.updatedAt, {selfPhoto, refs: 0, current: true}); return selfPhoto;
    }, {entities: ['SelfPhoto'], ids: []});
  }
  async getSelfSidecar({updatedAt}: {updatedAt: number}): Promise<FileRef | null> { return this.run(false, async tx => (await tx.all('files')).find(row => row.owner === `self:${updatedAt}` && row.purpose === 'self-sidecar')?.file ?? null); }
  async retainSelf({updatedAt}: {updatedAt: number}): Promise<SelfPhoto> {
    return this.run(true, async tx => { const row = await tx.get('self', updatedAt); if (!row) failure('self_photo_changed'); await tx.put('self', updatedAt, {...row, refs: row.refs + 1}); return row.selfPhoto; });
  }
  async releaseSelf({updatedAt}: {updatedAt: number}): Promise<void> {
    await this.run(true, async tx => {
      const row = await tx.get('self', updatedAt); if (!row) return;
      const refs = Math.max(0, row.refs - 1);
      if (!refs && !row.current) { await tx.removeOwner(`self:${updatedAt}`); await tx.delete('self', updatedAt); }
      else await tx.put('self', updatedAt, {...row, refs});
    });
  }
  private async removeJobs(tx: Transaction, kind: QueueJob['kind'], refId: Id): Promise<void> {
    for (const job of await tx.all('QueueJob')) if (job.kind === kind && job.refId === refId) await tx.delete('QueueJob', job.id);
  }
  private async addJob(tx: Transaction, kind: QueueJob['kind'], refId: Id): Promise<QueueJob> {
    if (kind !== 'describe_storefront' && kind !== 'label_piece') failure('invalid_argument');
    if (kind === 'label_piece') { if (!(await tx.get('Piece', refId))) failure('invalid_reference'); }
    else {
      const photo = await tx.get('Photo', refId), shop = photo && await tx.get('Shop', photo.shopId);
      if (!photo || photo.kind !== 'storefront' || shop?.storefrontPhotoId !== refId) failure('invalid_reference');
      await tx.put('Shop', shop.id, {...shop, description: null, descriptionState: 'pending'});
    }
    const existing = (await tx.all('QueueJob')).find(job => job.kind === kind && job.refId === refId); if (existing) return existing;
    const job: QueueJob = {id: crypto.randomUUID(), kind, refId, attempts: 0, nextAt: this.now()}; time(job.nextAt);
    await tx.put('QueueJob', job.id, job); return job;
  }
  async enqueue({kind, refId}: {kind: QueueJob['kind']; refId: Id}): Promise<QueueJob> { validId(refId); return this.run(true, tx => this.addJob(tx, kind, refId), {entities: ['QueueJob', 'Shop'], ids: [refId]}); }
  async nextJob({now}: {now: number}): Promise<QueueJob | null> {
    time(now); return this.run(false, async tx => (await tx.all('QueueJob')).filter(job => job.nextAt <= now && !this.runtime.claims.has(job.id)).sort((a, b) => a.nextAt - b.nextAt || a.id.localeCompare(b.id))[0] ?? null);
  }
  async beginJob({id, now}: {id: Id; now: number}): Promise<QueueJob> {
    validId(id); time(now);
    // Reserve synchronously before awaiting the DB so concurrent callers cannot dispatch twice.
    if (this.runtime.claims.has(id)) failure('busy');
    this.runtime.claims.add(id);
    try {
      return await this.run(true, async tx => {
        const job = await tx.get('QueueJob', id); if (!job) failure('not_found');
        if (job.nextAt > now) failure('busy');
        const attempts = job.attempts + 1;
        const updated = {...job, attempts, nextAt: now + Math.min(300000, 5000 * 2 ** Math.min(attempts - 1, 6))};
        time(updated.nextAt); await tx.put('QueueJob', id, updated); return updated;
      }, {entities: ['QueueJob'], ids: [id]});
    } catch (error) { this.runtime.claims.delete(id); throw error; }
  }
  async completeJob(options: {id: Id; description?: string; label?: string; category?: string}): Promise<void> {
    const {id, description, label, category} = options;
    await this.run(true, async tx => {
      const job = await tx.get('QueueJob', id); if (!job) return;
      if (!this.runtime.claims.has(id)) failure('job_not_claimed');
      if (job.kind === 'describe_storefront') {
        if (description === undefined || label !== undefined || category !== undefined) failure('invalid_argument');
        const value = text(description, 300), photo = await tx.get('Photo', job.refId), shop = photo && await tx.get('Shop', photo.shopId);
        if (shop?.storefrontPhotoId === job.refId) await tx.put('Shop', shop.id, {...shop, description: value, descriptionState: 'done'});
      } else {
        if (description !== undefined || label === undefined || category === undefined) failure('invalid_argument');
        const name = text(label, 120), type = text(category, 64), piece = await tx.get('Piece', job.refId);
        if (piece) await tx.put('Piece', piece.id, {...piece, label: name, category: type});
      }
      await tx.delete('QueueJob', id);
    }, {entities: ['QueueJob', 'Shop', 'Piece'], ids: [id]});
    this.runtime.claims.delete(id);
  }
  async failJob({id, retryable, retryAfterMs, preflight = false}: {id: Id; retryable: boolean; retryAfterMs?: number; preflight?: boolean}): Promise<void> {
    if (typeof retryable !== 'boolean' || typeof preflight !== 'boolean' || (preflight && (retryable || retryAfterMs !== undefined))) failure('invalid_argument');
    if (retryAfterMs !== undefined) time(retryAfterMs);
    await this.run(true, async tx => {
      const job = await tx.get('QueueJob', id); if (!job) return;
      if (preflight ? this.runtime.claims.has(id) : !this.runtime.claims.has(id)) failure('job_not_claimed');
      if (retryable) {
        const nextAt = Math.max(job.nextAt, retryAfterMs === undefined ? 0 : this.now() + retryAfterMs); time(nextAt);
        await tx.put('QueueJob', id, {...job, nextAt});
      } else {
        if (job.kind === 'describe_storefront') {
          const photo = await tx.get('Photo', job.refId), shop = photo && await tx.get('Shop', photo.shopId);
          if (shop?.storefrontPhotoId === job.refId) await tx.put('Shop', shop.id, {...shop, description: null, descriptionState: 'failed'});
        }
        await tx.delete('QueueJob', id);
      }
    }, {entities: ['QueueJob', 'Shop'], ids: [id]});
    this.runtime.claims.delete(id);
  }
}

let singleton: WebRepository | undefined;
export function getWebRepository(): WebRepository { return singleton ??= new WebRepository(); }
export function readBlob(file: FileRef): Promise<Blob> { return getWebRepository().readBlob(file); }
export function writeBlob(blob: Blob, purpose: string, ownerId?: string): Promise<FileRef> { return getWebRepository().writeBlob(blob, purpose, ownerId); }
export function setWebRepository(repository: WebRepository): void { singleton = repository; }
