import {Capacitor} from '@capacitor/core';
import type {Photo, PhotoEmbedding, PhotoIndex as PhotoIndexContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';
import {getMockContext} from './web/context';
import type {MockContext} from './web/context';
import {getWebRepository, readBlob} from '../data/web/repository';
import {checkMlFailure, mlError} from './segmenter';

export function validatePhraseVector(vector: number[]): void {
  if (!Array.isArray(vector) || vector.length !== 512 || vector.some(value => !Number.isFinite(value))) mlError('invalid_vector');
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (Math.abs(norm - 1) > 1e-4) mlError('invalid_vector');
}

async function allPhotos(): Promise<Photo[]> {
  const repository = getWebRepository();
  const photos: Photo[] = [];
  let cursor: string | undefined;
  do {
    const page = await repository.list({entity: 'Photo', limit: 200, ...(cursor ? {cursor} : {})});
    photos.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return photos;
}

export function createWebPhotoIndex(context?: MockContext): PhotoIndexContract {
  const inFlight = new WeakMap<MockContext, Map<string, Promise<PhotoEmbedding>>>();
  const listeners = new Set<(event: {photoId: string; state: 'done' | 'failed'}) => void>();
  function index({photoId}: {photoId: string}): Promise<PhotoEmbedding> {
    const current = context ?? getMockContext();
    let flights = inFlight.get(current);
    if (!flights) { flights = new Map(); inFlight.set(current, flights); }
    const existing = flights.get(photoId);
    if (existing) return existing;
    const repository = getWebRepository();
    const operation = (async () => {
      const photo = await repository.get({entity: 'Photo', id: photoId});
      if (!photo) mlError('invalid_reference');
      const embedding = await repository.get({entity: 'PhotoEmbedding', id: photoId});
      if (photo.indexState === 'done') {
        if (!embedding) mlError('index_unavailable');
        validatePhraseVector(embedding.vector);
        return embedding;
      }
      try {
        checkMlFailure(current, 'PhotoIndex.index');
        // Opening the owned bytes rejects missing files; fixture inference never manufactures an embedding.
        await readBlob(photo.file);
        const vector = current.fixture<number[]>(`PhotoIndex.vector:${photoId}`) ?? current.fixture<number[]>(`PhotoIndex.vector:${photo.file}`);
        if (!vector) mlError('model_missing');
        if (vector.length !== 512 || vector.some(value => !Number.isFinite(value))) mlError('invalid_vector');
        const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
        if (!Number.isFinite(norm) || norm === 0) mlError('invalid_vector');
        const normalized = vector.map(value => value / norm);
        const result = await repository.commitEmbedding({embedding: {photoId, model: 'pe-core-t16-image', dim: 512, vector: normalized}});
        for (const listener of listeners) listener({photoId, state: 'done'});
        return result;
      } catch (error) {
        if (await repository.get({entity: 'Photo', id: photoId})) {
          await repository.markIndexFailed({photoId});
          for (const listener of listeners) listener({photoId, state: 'failed'});
        }
        throw error;
      }
    })();
    flights.set(photoId, operation);
    void operation.finally(() => flights.delete(photoId)).catch(() => undefined);
    return operation;
  }
  return {
    index,
    async addListener(_name, listener) { listeners.add(listener); return {async remove() { listeners.delete(listener); }}; },
    async search({phraseVector, photoIds, k}) {
      const current = context ?? getMockContext();
      checkMlFailure(current, 'PhotoIndex.search');
      validatePhraseVector(phraseVector);
      if (!Number.isInteger(k) || k < 1 || k > 3 || (photoIds !== undefined && (!Array.isArray(photoIds) || photoIds.some(id => typeof id !== 'string' || !id)))) mlError('invalid_argument');
      const repository = getWebRepository();
      const scope = photoIds === undefined ? (await allPhotos()).filter(photo => photo.kind === 'item') : (await Promise.all([...new Set(photoIds)].map(id => repository.get({entity: 'Photo', id})))).filter((photo): photo is Photo => photo !== null);
      if (scope.some(photo => photo.indexState === 'failed')) mlError('index_unavailable');
      const timeout = Promise.withResolvers<never>();
      const timer = setTimeout(() => timeout.reject({code: 'index_unavailable', message: 'Photo indexing is unavailable.', retryable: true}), 30_000);
      try {
        await Promise.race([
          Promise.all(scope.filter(photo => photo.indexState === 'pending').map(photo => index({photoId: photo.id}))).catch(() => mlError('index_unavailable')),
          timeout.promise,
        ]);
      } finally { clearTimeout(timer); }
      const ranked: Array<{photoId: string; score: number; takenAt: number}> = [];
      for (const selected of scope) {
        const photo = await repository.get({entity: 'Photo', id: selected.id});
        if (!photo) continue;
        const embedding = await repository.get({entity: 'PhotoEmbedding', id: photo.id});
        if (photo.indexState !== 'done' || !embedding) mlError('index_unavailable');
        validatePhraseVector(embedding.vector);
        const score = embedding.vector.reduce((sum, value, i) => sum + value * phraseVector[i], 0);
        ranked.push({photoId: photo.id, score, takenAt: photo.takenAt});
      }
      ranked.sort((a, b) => b.score - a.score || b.takenAt - a.takenAt || (a.photoId < b.photoId ? -1 : a.photoId > b.photoId ? 1 : 0));
      return ranked.slice(0, k).map(({photoId, score}) => ({photoId, score}));
    },
  };
}

export async function resumePendingPhotoIndexes(index: PhotoIndexContract): Promise<void> {
  const photos = await allPhotos();
  await Promise.all(photos.filter(photo => photo.indexState === 'pending').map(photo => index.index({photoId: photo.id}).catch(() => undefined)));
}

type NativePhotoIndex = Omit<PhotoIndexContract, 'search'> & {search(o: {phraseVector: number[]; photoIds?: string[]; k: number}): Promise<{results: Array<{photoId: string; score: number}>}>};
const bridge = registerDevicePlugin<PhotoIndexContract | NativePhotoIndex>('PhotoIndex', async () => {
  const web = createWebPhotoIndex();
  void resumePendingPhotoIndexes(web).catch(() => undefined);
  return web;
});

export const PhotoIndex: PhotoIndexContract = {
  index: options => bridge.index(options),
  addListener: (name, listener) => bridge.addListener(name, listener),
  async search(options) {
    const result = await bridge.search(options);
    // Java PluginCall resolves an object. The explicit web mock returns the public array directly.
    if (Capacitor.isNativePlatform() || import.meta.env.VITE_SF_RUNTIME !== 'web-mock') {
      if (!result || Array.isArray(result) || !Array.isArray(result.results)) mlError('io_error');
      return result.results;
    }
    if (!Array.isArray(result)) mlError('io_error');
    return result;
  },
};
