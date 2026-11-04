import 'fake-indexeddb/auto';
import {setImmediate} from 'node:timers';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {Photo, QueueJob} from '../native/contracts';
import type {RelayRequest, RelayResponse} from '../relay/client';
import {createRelayClient} from '../relay/client';
import {DescribeQueue} from './queue';
import type {DescribePath, DescribeTransport, QueueEnvironment} from './queue';
import {WebRepository} from './web/repository';
import type {ImageCodec, Pixels} from './web/images';

const codec: ImageCodec = {
  async decode(blob) {
    const bytes = new Uint8ClampedArray(await blob.arrayBuffer());
    return {width: 2, height: 2, data: bytes};
  },
  async encode(pixels: Pixels) { return new Blob([new Uint8Array(pixels.data)], {type: 'image/png'}); },
};
const rgba = (mask = false) => new Blob([new Uint8Array(Array.from({length: 16}, (_, index) => mask || index % 4 === 3 ? 255 : index % 4 === 0 ? 200 : 0))], {type: 'image/png'});
const wire = {mimeType: 'image/png' as const, width: 2, height: 2, data: 'sanitized-pixels'};
async function until(check: () => boolean | Promise<boolean>) {
  for (let i = 0; i < 200; i++) {
    if (await check()) return;
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  throw new Error('Queue did not settle');
}

let store: WebRepository;
let worker: DescribeQueue | undefined;
let online: boolean;
let foreground: boolean;
let environment: QueueEnvironment;
let photos: Photo[];
let tripId: string;
let shopId: string;
const calls: {path: DescribePath; body: unknown; at: number}[] = [];
let respond: (path: DescribePath) => Promise<object>;
const transport: DescribeTransport = {
  async request<P extends DescribePath>(path: P, body: RelayRequest<P>, options: {beforeSend: () => Promise<void>; forceRefreshAuth?: boolean; signal: AbortSignal}): Promise<RelayResponse<P>> {
    await options.beforeSend();
    calls.push({path, body, at: Date.now()});
    return await respond(path) as RelayResponse<P>;
  },
};
async function commit(kind: Photo['kind']) {
  const file = await store.writeBlob(rgba(), 'capture');
  const photo = await store.commitPhoto({photo: {id: crypto.randomUUID(), tripId, shopId, kind, takenAt: Date.now(), location: {lat: 37, lng: -122, accuracyM: 3}, file, w: 2, h: 2, indexState: 'pending'}});
  photos.push(photo);
  return photo;
}
async function saved(mode: 'describe' | 'concept' = 'describe', category?: 'outer' | 'top' | 'bottom') {
  const photo = await commit('item');
  const mask = await store.writeBlob(rgba(true), 'candidate-mask', photo.id);
  return store.saveCandidate({candidate: {id: 'not-trusted', photoId: photo.id, source: 'edgetam', label: 'Red jacket', score: 0.8, mask, bbox: [0, 0, 2, 2]}, origin: 'shop', labelMode: mode, category});
}
async function jobs(): Promise<QueueJob[]> { return (await store.list({entity: 'QueueJob'})).items; }

beforeEach(async () => {
  vi.useFakeTimers({toFake: ['Date', 'setTimeout', 'clearTimeout']});
  vi.setSystemTime(100_000);
  store = new WebRepository({name: `queue-${crypto.randomUUID()}`, now: () => Date.now(), images: codec});
  const session = await store.startSession({fix: {t: Date.now(), lat: 37, lng: -122, accuracyM: 3}});
  tripId = session.trip.id; shopId = session.shop.id; photos = []; calls.length = 0;
  online = true; foreground = true;
  respond = async path => path === '/v1/describe/storefront' ? {description: 'Red brick entrance'} : {label: 'Red wool jacket', category: 'outer'};
  environment = {now: () => Date.now(), foreground: () => foreground, online: () => online, schedule: (fn, ms) => setTimeout(fn, ms), cancel: handle => clearTimeout(handle as number), image: async () => wire};
});
afterEach(async () => { await worker?.stop(); worker = undefined; await store.close(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('queue foreground durable dispatcher', () => {
  it('keeps direct-cut-shop Picked item offline with zero attempts, then dispatches once on reconnect', async () => {
    const piece = await saved(); online = false;
    worker = new DescribeQueue(store, transport, environment); await worker.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toEqual([]); expect((await jobs())[0].attempts).toBe(0); expect(piece.label).toBe('Picked item');
    online = true; worker.wake(); worker.wake();
    await until(async () => (await jobs()).length === 0);
    expect(calls.map(call => call.path)).toEqual(['/v1/describe/piece']);
    expect(await store.get({entity: 'Piece', id: piece.id})).toMatchObject({label: 'Red wool jacket', category: 'outer', origin: 'shop'});
  });
  it('names a piece cut for a mannequin slot but keeps the slot as its category', async () => {
    const piece = await saved('describe', 'bottom');
    expect(piece).toMatchObject({label: 'Picked item', category: 'bottom'});
    worker = new DescribeQueue(store, transport, environment); await worker.start();
    await until(async () => (await jobs()).length === 0);
    expect(await store.get({entity: 'Piece', id: piece.id})).toMatchObject({label: 'Red wool jacket', category: 'bottom'});
    await expect(store.updatePiece({id: piece.id, label: 'Jeans', category: 'jeans'})).rejects.toMatchObject({code: 'invalid_argument'});
  });
  it('keeps reconnect and foreground wake behind persisted nextAt with 5s,10s,20s through 300s backoff', async () => {
    await saved(); respond = async () => { throw {code: 'upstream_timeout', retryable: true}; };
    worker = new DescribeQueue(store, transport, environment); await worker.start();
    await until(async () => (await jobs())[0]?.attempts === 1);
    await until(() => calls.length === 1);
    let expectedAt = 100_000;
    for (const delay of [5000, 10000, 20000, 40000, 80000, 160000, 300000]) {
      await until(async () => (await jobs())[0]?.nextAt === expectedAt + delay);
      const count = calls.length;
      online = false; worker.wake(); online = true; foreground = false; worker.wake(); foreground = true; worker.wake();
      await vi.advanceTimersByTimeAsync(delay - 1); expect(calls.length).toBe(count);
      await vi.advanceTimersByTimeAsync(1); expectedAt += delay;
      await until(() => calls.length === count + 1);
      expect(calls.at(-1)?.at).toBe(expectedAt);
    }
  });
  it('honors Retry-After without a transport retry', async () => {
    await saved(); let failures = 1;
    respond = async () => { if (failures--) throw {code: 'unauthorized', retryable: true, retryAfterMs: 90_000}; return {label: 'Authenticated jacket', category: 'outer'}; };
    worker = new DescribeQueue(store, transport, environment); await worker.start();
    await until(async () => (await jobs())[0]?.nextAt === 190_000);
    await vi.advanceTimersByTimeAsync(89_999); expect(calls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(1); await until(async () => (await jobs()).length === 0);
  });
  it('retains unclaimed jobs through auth failure and sends only after forced credential refresh', async () => {
    await commit('storefront');
    let authentications = 0;
    const authorization: string[] = [];
    vi.stubGlobal('fetch', async (_input: unknown, init: RequestInit) => {
      authorization.push(new Headers(init.headers).get('Authorization') ?? '');
      return Response.json({description: 'Authenticated storefront'});
    });
    const client = createRelayClient({auth: async forceRefresh => {
      authentications++;
      if (!forceRefresh) throw new Error('Temporary token service failure');
      return {idToken: 'fresh-id', appCheckToken: 'fresh-app-check'};
    }});
    worker = new DescribeQueue(store, client, environment); await worker.start();
    await until(() => vi.getTimerCount() > 0);
    expect((await jobs())[0].attempts).toBe(0);
    expect(await store.get({entity: 'Shop', id: shopId})).toMatchObject({descriptionState: 'pending'});
    expect(authorization).toEqual([]);
    await vi.advanceTimersByTimeAsync(5000);
    await until(async () => (await jobs()).length === 0);
    expect(authentications).toBe(2);
    expect(authorization).toEqual(['Bearer fresh-id']);
    expect(await store.get({entity: 'Shop', id: shopId})).toMatchObject({descriptionState: 'done'});
  });
  it('drains work enqueued while the empty-queue snapshot is resolving', async () => {
    const list = store.list.bind(store);
    let inserted = false;
    store.list = async options => {
      const page = await list(options);
      if (options.entity === 'QueueJob' && !page.items.length && !inserted) {
        inserted = true;
        await commit('storefront');
      }
      return page;
    };
    worker = new DescribeQueue(store, transport, environment); await worker.start();
    await until(async () => (await store.get({entity: 'Shop', id: shopId}))?.descriptionState === 'done');
    expect(calls.map(call => call.path)).toEqual(['/v1/describe/storefront']);
    expect(await jobs()).toEqual([]);
  });
  it('finishes permanent image-preparation failures without HTTP attempts or deleting the photo', async () => {
    const photo = await commit('storefront');
    environment.image = async () => { throw {code: 'image_unavailable', retryable: false}; };
    worker = new DescribeQueue(store, transport, environment); await worker.start();
    await until(async () => (await jobs()).length === 0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toEqual([]);
    expect(await store.get({entity: 'Shop', id: shopId})).toMatchObject({descriptionState: 'failed'});
    expect(await store.get({entity: 'Photo', id: photo.id})).toEqual(photo);
  });
  it('rejects a preflight failure racing an already claimed job', async () => {
    await commit('storefront');
    const job = (await jobs())[0];
    await store.beginJob({id: job.id, now: Date.now()});
    await expect(store.failJob({id: job.id, retryable: false, preflight: true})).rejects.toMatchObject({code: 'job_not_claimed'});
    expect((await jobs())[0]).toMatchObject({id: job.id, attempts: 1});
    await store.completeJob({id: job.id, description: 'Still owned by the original request'});
    expect(await store.get({entity: 'Shop', id: shopId})).toMatchObject({descriptionState: 'done'});
  });
  it('does not claim while authentication/image preprocessing is offline', async () => {
    await saved(); environment.image = async () => { online = false; return wire; };
    worker = new DescribeQueue(store, transport, environment); await worker.start();
    await until(() => !online);
    expect(calls).toEqual([]); expect((await jobs())[0].attempts).toBe(0);
  });
  it('does not run in background and marks a nonretryable storefront failure without deleting its photo', async () => {
    const photo = await commit('storefront'); foreground = false;
    respond = async () => { throw {code: 'invalid_request', retryable: false}; };
    worker = new DescribeQueue(store, transport, environment); await worker.start(); await vi.advanceTimersByTimeAsync(10_000); expect(calls).toEqual([]);
    foreground = true; worker.wake(); await until(async () => (await jobs()).length === 0);
    expect(await store.get({entity: 'Shop', id: shopId})).toMatchObject({descriptionState: 'failed', description: null});
    expect(await store.get({entity: 'Photo', id: photo.id})).not.toBeNull();
  });
  it('discards late labels after rename and delete without resurrecting Piece', async () => {
    const piece = await saved(); let finish!: (value: object) => void;
    respond = () => new Promise(resolve => { finish = resolve; });
    worker = new DescribeQueue(store, transport, environment); await worker.start(); await until(() => calls.length === 1);
    await store.updatePiece({id: piece.id, label: 'My title', category: 'top'}); finish({label: 'Late model title', category: 'outer'});
    await until(async () => (await jobs()).length === 0);
    expect(await store.get({entity: 'Piece', id: piece.id})).toMatchObject({label: 'My title', category: 'top'});
    const next = await store.enqueue({kind: 'label_piece', refId: piece.id}); worker.wake(); await until(() => calls.length === 2);
    await store.deletePiece({id: piece.id}); finish({label: 'Late deleted title', category: 'outer'});
    await until(async () => await store.get({entity: 'QueueJob', id: next.id}) === null);
    expect(await store.get({entity: 'Piece', id: piece.id})).toBeNull();
  });
  it('discards replaced storefront reply and describes only the replacement', async () => {
    await commit('storefront'); let finish!: (value: object) => void; let count = 0;
    respond = async () => ++count === 1 ? new Promise(resolve => { finish = resolve; }) : {description: 'Replacement entrance'};
    worker = new DescribeQueue(store, transport, environment); await worker.start(); await until(() => calls.length === 1);
    const replacement = await commit('storefront'); finish({description: 'Old entrance'});
    await until(async () => (await jobs()).length === 0);
    expect(await store.get({entity: 'Shop', id: shopId})).toMatchObject({storefrontPhotoId: replacement.id, description: 'Replacement entrance'});
  });
});

describe('privacy queue upload boundary', () => {
  it('reads only saved cutouts and selected storefront originals; concept saves and private device data never dispatch', async () => {
    await saved('concept'); const direct = await saved('describe'); const front = await commit('storefront');
    const observed: string[] = []; environment.image = async file => { observed.push(file); return wire; };
    const self = await store.writeBlob(rgba(), 'self-original'); const head = await store.writeBlob(rgba(true), 'self-head-mask'); const masked = await store.writeBlob(rgba(), 'self-masked');
    await store.replaceSelfPhoto({selfPhoto: {file: self, headMask: head, maskedFile: masked, updatedAt: Date.now()}});
    await store.commitEmbedding({embedding: {photoId: front.id, model: 'pe-core-t16-image', dim: 512, vector: Array.from({length: 512}, (_, i) => i === 0 ? 1 : 0)}});
    worker = new DescribeQueue(store, transport, environment); await worker.start(); await until(async () => (await jobs()).length === 0);
    expect(observed.sort()).toEqual([direct.cutoutFile, front.file].sort());
    expect(calls.map(call => Object.keys(call.body as object))).toEqual([['image'], ['image']]);
    expect(JSON.stringify(calls)).not.toMatch(/tripId|photoId|accuracyM|headMask|vector|latitude|longitude/);
    await store.stopSession({tripId, endedAt: Date.now()}); expect((await store.list({entity: 'TrailPoint'})).items).toEqual([]);
  });
});
