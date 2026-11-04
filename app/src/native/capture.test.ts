import 'fake-indexeddb/auto';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import type {Asset} from './contracts';
import {CaptureWeb} from './capture';
import {MediaWeb} from './media';
import {ShoppingSessionWeb} from './shoppingSession';
import {createWebSegmenter, encodeWebPng} from './segmenter';
import {createMockContext} from './web/context';
import type {MockContext} from './web/context';
import {getWebRepository, setWebRepository, WebRepository} from '../data/web/repository';

let repository: WebRepository;
let previous: WebRepository;
let context: MockContext;
let capture: CaptureWeb;
let fixture: Asset;
const now = 200_000;
beforeEach(async () => {
  previous = getWebRepository();
  repository = new WebRepository({name: `capture-${crypto.randomUUID()}`, now: () => now});
  setWebRepository(repository);
  fixture = {id: 'fixture', file: await repository.writeBlob(await encodeWebPng(2, 2, new Uint8Array(16).fill(255)), 'fixture'), w: 2, h: 2};
  const masks = [0.9, 0.8, 0.7].map(score => ({score, pixels: new Uint8Array(4).fill(255)}));
  context = createMockContext({now, permissions: {camera: 'granted', location: 'granted'}, fixtures: {
    capture: [fixture], 'media.wardrobe': fixture, 'Segmenter.asset:fixture': {person: masks, taps: []},
    location: {t: now, lat: 38, lng: -121, accuracyM: 4},
  }});
  capture = new CaptureWeb(context, new ShoppingSessionWeb(context));
});
afterEach(async () => { await capture.closePreview(); setWebRepository(previous); await repository.close(); });

describe('capture ownership and historical storefront boundary', () => {
  it.each(['camera', 'gallery'] as const)('keeps a %s wardrobe asset usable by the next image operation', async source => {
    let asset: Asset;
    if (source === 'camera') {
      await capture.openPreview({purpose: 'wardrobe', facing: 'back'});
      asset = (await capture.takePhoto({kind: 'item'})).asset;
    } else asset = (await new MediaWeb(context).pick({purpose: 'wardrobe'})).asset;
    const segmenter = createWebSegmenter(context);
    const {handle} = await segmenter.prepare({asset});
    expect((await segmenter.person({handle})).masks.map(mask => mask.bbox)).toEqual([[0, 0, 2, 2], [0, 0, 2, 2], [0, 0, 2, 2]]);
    await segmenter.release({handle});
    await repository.discardAsset({assetId: asset.id});
    await expect(segmenter.prepare({asset})).rejects.toMatchObject({code: 'file_not_owned'});
  });

  it('adds a past storefront with a fresh fix without moving the active trip or recording a trail', async () => {
    const past = await repository.startSession({fix: {t: 10_000, lat: 37, lng: -122, accuracyM: 3}});
    await repository.stopSession({tripId: past.trip.id, endedAt: 20_000});
    const active = await repository.startSession({fix: {t: 190_000, lat: 39, lng: -120, accuracyM: 3}});
    const trail = await repository.list({entity: 'TrailPoint'});
    await capture.openPreview({purpose: 'storefront', facing: 'back', shopId: past.shop.id});
    const {photo} = await capture.takePhoto({kind: 'storefront'});
    expect(photo).toMatchObject({tripId: past.trip.id, shopId: past.shop.id, takenAt: now, location: {lat: 38, lng: -121, accuracyM: 4}});
    expect(await repository.getSession()).toMatchObject({trip: {id: active.trip.id}, shop: {id: active.shop.id}});
    expect(await repository.list({entity: 'TrailPoint'})).toEqual(trail);
    expect(await repository.get({entity: 'Shop', id: past.shop.id})).toMatchObject({storefrontPhotoId: photo!.id, descriptionState: 'pending'});
    await expect(capture.takePhoto({kind: 'item'})).rejects.toMatchObject({code: 'invalid_argument'});
    context.setPermission('location', 'denied');
    await expect(capture.takePhoto({kind: 'storefront'})).rejects.toMatchObject({code: 'location_permission_denied'});
    expect((await repository.list({entity: 'Photo'})).items.map(row => row.id)).toEqual([photo!.id]);
    await repository.deleteTrip({id: past.trip.id});
    await expect(capture.takePhoto({kind: 'storefront'})).rejects.toMatchObject({code: 'not_found'});
    expect((await repository.list({entity: 'Photo'})).items).toEqual([]);
  });
});
