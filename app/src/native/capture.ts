import {WebPlugin} from '@capacitor/core';
import type {Asset, Capture as CaptureContract, Fix, Photo} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';
import {getMockContext} from './web/context';
import type {MockContext} from './web/context';
import {getWebRepository} from '../data/web/repository';
import {deviceFailure, getShoppingSessionWeb, validFix} from './shoppingSession';
import type {ShoppingSessionWeb, ShutterSnapshot} from './shoppingSession';
import {PhotoIndex} from './photoIndex';

export class CaptureWeb extends WebPlugin implements CaptureContract {
  private readonly injected?: MockContext;
  private readonly session: ShoppingSessionWeb;
  private purpose?: 'shopping' | 'wardrobe' | 'self';
  private index = 0;
  private busy = false;
  constructor(context?: MockContext, session = getShoppingSessionWeb()) { super(); this.injected = context; this.session = session; }
  private get context() { return this.injected ?? getMockContext(); }
  async openPreview(options: {purpose: 'shopping' | 'wardrobe' | 'self'; facing: 'back' | 'front'}) {
    if (!['shopping', 'wardrobe', 'self'].includes(options.purpose) || !['back', 'front'].includes(options.facing)) throw deviceFailure('invalid_argument', false);
    if (options.purpose === 'shopping' && (await this.session.getState()).phase !== 'recording') throw deviceFailure('not_recording');
    const failure = this.context.failure('Capture.openPreview'); if (failure) throw failure;
    if (this.context.permission('camera') === 'denied') throw deviceFailure('permission_denied', false);
    const fixtures = this.context.fixture<Asset[]>('capture'); if (!fixtures?.length) throw deviceFailure('fixture_unavailable');
    this.purpose = options.purpose;
    await this.notifyListeners('preview', {ready: true});
  }
  async setPreviewRect(options: {x: number; y: number; width: number; height: number}) {
    if (Object.values(options).some(value => !Number.isFinite(value) || value < 0)) throw deviceFailure('invalid_argument', false);
    this.context.setFixture('captureRect', options);
  }
  async takePhoto(options: {kind: 'item' | 'storefront'}) {
    if (!this.purpose) throw deviceFailure('preview_not_ready');
    if (!['item', 'storefront'].includes(options.kind) || (this.purpose !== 'shopping' && options.kind !== 'item')) throw deviceFailure('invalid_argument', false);
    if (this.busy) throw deviceFailure('busy');
    this.busy = true;
    let shutter: ShutterSnapshot | undefined;
    let staged: string | undefined;
    try {
      const failure = this.context.failure('Capture.takePhoto'); if (failure) throw failure;
      if (this.purpose === 'shopping') shutter = await this.session.acquireShutter();
      const fixtures = this.context.fixture<Asset[]>('capture'); if (!fixtures?.length) throw deviceFailure('fixture_unavailable');
      const fixture = fixtures[this.index % fixtures.length];
      const repository = getWebRepository();
      const blob = await repository.readBlob(fixture.file);
      staged = await repository.writeBlob(blob, 'capture');
      let asset: Asset = {id: crypto.randomUUID(), file: staged, w: fixture.w, h: fixture.h};
      let photo: Photo | null = null;
      if (shutter) {
        let fix = await repository.nearestFix({tripId: shutter.tripId, takenAt: shutter.takenAt});
        if (!validFix(fix, shutter.takenAt)) fix = this.context.fixture<Fix>('location') ?? null;
        if (!validFix(fix, shutter.takenAt)) throw deviceFailure('location_disabled');
        photo = await repository.commitPhoto({photo: {id: asset.id, file: asset.file, w: asset.w, h: asset.h, tripId: shutter.tripId, shopId: shutter.shopId, kind: options.kind,
          takenAt: shutter.takenAt, location: {lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM}, indexState: 'pending'}});
        asset = {...asset, file: photo.file};
      } else asset = await repository.registerAsset({asset, purpose: this.purpose});
      this.index++;
      const result = {asset, photo}; await this.notifyListeners('captured', result);
      if (photo) void PhotoIndex.index({photoId: photo.id}).catch(() => undefined);
      return result;
    } finally {
      if (staged) await getWebRepository().discardTemp({file: staged});
      await shutter?.release(); this.busy = false;
    }
  }
  async closePreview() { this.purpose = undefined; await this.notifyListeners('preview', {ready: false}); }
}
export const Capture = registerDevicePlugin<CaptureContract>('Capture', async () => new CaptureWeb());
