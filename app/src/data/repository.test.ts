import 'fake-indexeddb/auto';
import {afterEach, describe, expect, it} from 'vitest';
import type {Candidate} from '../native/contracts';
import type {ImageCodec} from './web/images';
import {WebRepository} from './web/repository';

const codec: ImageCodec = {
  async decode(blob) {return {width: 2, height: 2, data: new Uint8ClampedArray(await blob.arrayBuffer())};},
  async encode(pixels) {return new Blob([new Uint8Array(pixels.data)], {type: 'image/png'});},
};
const rows: WebRepository[] = [];
function repository(name = crypto.randomUUID(), epoch = 'runtime-a', images = codec) {
  const value = new WebRepository({name, epoch, images}); rows.push(value); return value;
}
const image = () => new Blob([new Uint8Array([200, 0, 0, 255, 200, 0, 0, 255, 200, 0, 0, 255, 200, 0, 0, 255])], {type: 'image/png'});
async function source(store: WebRepository) {
  const takenAt = Date.now();
  const {trip, shop} = await store.startSession({fix: {t: takenAt, lat: 37, lng: -122, accuracyM: 3}});
  const file = await store.writeBlob(image(), 'capture');
  const photo = await store.commitPhoto({photo: {id: crypto.randomUUID(), tripId: trip.id, shopId: shop.id, kind: 'item', takenAt, location: {lat: 37, lng: -122, accuracyM: 3}, file, w: 2, h: 2, indexState: 'pending'}});
  const mask = await store.writeBlob(new Blob([new Uint8Array(16).fill(255)], {type: 'image/png'}), 'candidate-mask', photo.id);
  const candidate: Candidate = {id: 'untrusted', photoId: photo.id, mask, bbox: [0, 0, 2, 2], label: 'Red jacket', source: 'edgetam', score: 0.8};
  return {photo, candidate, trip};
}
afterEach(async () => {await Promise.all(rows.splice(0).map(row => row.close()));});

describe('durable ownership and recovery', () => {
  it('releases source and mask pins after cutout encoding fails', async () => {
    const store = repository(undefined, undefined, {...codec, async encode() {throw new Error('Encoder failed');}});
    const {photo, candidate} = await source(store);
    await expect(store.saveCandidate({candidate, origin: 'shop', labelMode: 'describe'})).rejects.toBeDefined();
    await store.deletePhoto({id: photo.id});
    await store.discardTemp({file: candidate.mask});
    await expect(store.readBlob(photo.file)).rejects.toMatchObject({code: 'file_not_owned'});
    await expect(store.readBlob(candidate.mask)).rejects.toMatchObject({code: 'file_not_owned'});
    expect((await store.list({entity: 'Piece'})).items).toEqual([]);
    expect((await store.list({entity: 'QueueJob'})).items).toEqual([]);
  });
  it('deduplicates simultaneous saves and preserves the cutout and destination after trip deletion', async () => {
    const store = repository();
    const {photo, candidate, trip} = await source(store);
    const options = {candidate, origin: 'shop' as const, labelMode: 'describe' as const};
    const [first, second] = await Promise.all([store.saveCandidate(options), store.saveCandidate(options)]);
    expect(first.id).toBe(second.id);
    expect((await store.list({entity: 'Piece'})).items.map(row => row.id)).toEqual([first.id]);
    expect((await store.list({entity: 'QueueJob'})).items.map(row => row.refId)).toEqual([first.id]);
    const bytes = new Uint8Array(await (await store.readBlob(first.cutoutFile)).arrayBuffer());
    await store.deleteTrip({id: trip.id});
    expect(await store.get({entity: 'Piece', id: first.id})).toMatchObject({photoId: null, shopId: null, tripId: null, walkTo: {lat: 37, lng: -122}});
    expect(new Uint8Array(await (await store.readBlob(first.cutoutFile)).arrayBuffer())).toEqual(bytes);
    await expect(store.readBlob(photo.file)).rejects.toMatchObject({code: 'file_not_owned'});
  });
  it('does not let a new runtime recover files until every current owner closes', async () => {
    const name = crypto.randomUUID(), first = repository(name), peer = repository(name), next = repository(name, 'runtime-b');
    const {photo} = await source(first);
    const temp = await first.writeBlob(new Blob(['in-flight provider']), 'provider');
    await peer.getSelfPhoto();
    await expect(next.getSelfPhoto()).rejects.toMatchObject({code: 'busy'});
    expect(await (await first.readBlob(temp)).text()).toBe('in-flight provider');
    await first.close();
    await expect(next.getSelfPhoto()).rejects.toMatchObject({code: 'busy'});
    await peer.close();
    expect(await next.get({entity: 'Photo', id: photo.id})).toEqual(photo);
    await expect(next.readBlob(temp)).rejects.toMatchObject({code: 'file_not_owned'});
    expect(new Uint8Array(await (await next.readBlob(photo.file)).arrayBuffer())).toEqual(new Uint8Array(await image().arrayBuffer()));
  });
});
