import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Photo, PhotoEmbedding} from './contracts';
import {createMockContext} from './web/context';
import {createWebPhotoIndex, PhotoIndex, resumePendingPhotoIndexes} from './photoIndex';

const state = vi.hoisted(() => ({photos: new Map<string, Photo>(), embeddings: new Map<string, PhotoEmbedding>(), reads: 0, commits: 0, gate: null as Promise<Blob> | null, native: true, nativeError: null as unknown}));
vi.mock('@capacitor/core', () => ({Capacitor: {isNativePlatform: () => state.native}, registerPlugin: () => ({async search() { if (state.nativeError) throw state.nativeError; return {results: [{photoId: 'native', score: 0.75}]}; }})}));
vi.mock('../data/web/repository', () => ({
  getWebRepository: () => ({
    async get({entity, id}: {entity: string; id: string}) { return structuredClone((entity === 'Photo' ? state.photos.get(id) : state.embeddings.get(id)) ?? null); },
    async list() { return {items: structuredClone([...state.photos.values()]), nextCursor: null}; },
    async commitEmbedding({embedding}: {embedding: PhotoEmbedding}) {
      const photo = state.photos.get(embedding.photoId);
      if (!photo) throw {code: 'invalid_reference'};
      state.commits++; photo.indexState = 'done'; state.embeddings.set(photo.id, structuredClone(embedding)); return embedding;
    },
    async markIndexFailed({photoId}: {photoId: string}) { const photo = state.photos.get(photoId); if (photo) photo.indexState = 'failed'; },
  }),
  async readBlob() { state.reads++; return state.gate ?? new Blob(['local']); },
  async writeBlob() { throw new Error('Index cannot write image files'); },
}));

const vector = (at = 0) => Array.from({length: 512}, (_, i) => i === at ? 1 : 0);
function photo(id: string, takenAt = 1, kind: Photo['kind'] = 'item'): Photo {
  return {id, takenAt, kind, tripId: 'trip', shopId: 'shop', location: {lat: 0, lng: 0, accuracyM: 1}, file: `blob:${id}`, w: 10, h: 10, indexState: 'pending'};
}
beforeEach(() => { state.photos.clear(); state.embeddings.clear(); state.reads = 0; state.commits = 0; state.gate = null; state.nativeError = null; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('PhotoIndex behavior', () => {
  it('singleFlightIndex caches a successful vector and normalizes fixture inference', async () => {
    state.photos.set('p', photo('p'));
    const input = vector().map(value => value * 3);
    const index = createWebPhotoIndex(createMockContext({fixtures: {'PhotoIndex.vector:p': input}}));
    const [a, b] = await Promise.all([index.index({photoId: 'p'}), index.index({photoId: 'p'})]);
    expect(a.vector).toEqual(vector()); expect(b).toEqual(a);
    expect(await index.index({photoId: 'p'})).toEqual(a);
    expect(state.reads).toBe(1); expect(state.commits).toBe(1);
  });
  it('ranks actual dot products, then newest timestamp and ascending ID before truncating', async () => {
    for (const [id, time, kind] of [['z', 2, 'item'], ['b', 3, 'item'], ['a', 3, 'item'], ['low', 9, 'item'], ['front', 10, 'storefront']] as const) state.photos.set(id, photo(id, time, kind));
    const context = createMockContext();
    for (const id of state.photos.keys()) context.setFixture(`PhotoIndex.vector:${id}`, vector(id === 'low' ? 1 : 0));
    const index = createWebPhotoIndex(context);
    expect(await index.search({phraseVector: vector(), k: 3})).toEqual([{photoId: 'a', score: 1}, {photoId: 'b', score: 1}, {photoId: 'z', score: 1}]);
    expect(await index.search({phraseVector: vector(), photoIds: ['front', 'low'], k: 2})).toEqual([{photoId: 'front', score: 1}, {photoId: 'low', score: 0}]);
  });
  it('pendingTimeoutIsNotNotFound and failed indexing never silently disappears from results', async () => {
    vi.useFakeTimers();
    state.photos.set('p', photo('p'));
    const gate = Promise.withResolvers<Blob>(); state.gate = gate.promise;
    const index = createWebPhotoIndex(createMockContext({fixtures: {'PhotoIndex.vector:p': vector()}}));
    const result = index.search({phraseVector: vector(), k: 1});
    const rejected = expect(result).rejects.toMatchObject({code: 'index_unavailable'});
    await vi.advanceTimersByTimeAsync(30_000); await rejected;
    gate.resolve(new Blob(['local'])); await index.index({photoId: 'p'});
    state.photos.get('p')!.indexState = 'failed';
    await expect(index.search({phraseVector: vector(), k: 1})).rejects.toMatchObject({code: 'index_unavailable'});
  });
  it('deletedPhotoCannotResurrect when inference finishes after deletion', async () => {
    state.photos.set('p', photo('p'));
    const gate = Promise.withResolvers<Blob>(); state.gate = gate.promise;
    const index = createWebPhotoIndex(createMockContext({fixtures: {'PhotoIndex.vector:p': vector()}}));
    const result = index.index({photoId: 'p'}), rejected = expect(result).rejects.toMatchObject({code: 'invalid_reference'});
    await vi.waitFor(() => expect(state.reads).toBe(1));
    state.photos.delete('p'); gate.resolve(new Blob(['local'])); await rejected;
    expect(state.embeddings.has('p')).toBe(false); expect(state.commits).toBe(0);
  });
  it('resumes pending only, leaves failed explicit, and retries failed only on index()', async () => {
    state.photos.set('pending', photo('pending')); state.photos.set('failed', {...photo('failed'), indexState: 'failed'});
    const context = createMockContext({fixtures: {'PhotoIndex.vector:pending': vector(), 'PhotoIndex.vector:failed': vector(1)}});
    const index = createWebPhotoIndex(context);
    await resumePendingPhotoIndexes(index);
    expect(state.photos.get('pending')!.indexState).toBe('done'); expect(state.photos.get('failed')!.indexState).toBe('failed');
    await index.index({photoId: 'failed'});
    expect(state.photos.get('failed')!.indexState).toBe('done');
    await expect(index.search({phraseVector: Array(512).fill(0), k: 1})).rejects.toMatchObject({code: 'invalid_vector'});
    await expect(index.search({phraseVector: vector(), k: 4})).rejects.toMatchObject({code: 'invalid_argument'});
  });
  it('unwraps only the native Java envelope and preserves sanitized typed rejections', async () => {
    expect(await PhotoIndex.search({phraseVector: vector(), k: 1})).toEqual([{photoId: 'native', score: 0.75}]);
    state.nativeError = {code: 'MODEL_MISSING', message: 'private-file-path', data: {retryable: true, raw: 'private'}};
    await expect(PhotoIndex.search({phraseVector: vector(), k: 1})).rejects.toEqual({code: 'model_missing', message: 'The device operation could not be completed.', retryable: true});
  });
});
