import {WebPlugin} from '@capacitor/core';
import type {Asset, Capture as CaptureContract, Fix, Photo} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';
import {copyAssetFixtures, getMockContext} from './web/context';
import type {MockContext} from './web/context';
import {getWebRepository} from '../data/web/repository';
import {deviceFailure, getShoppingSessionWeb, validFix} from './shoppingSession';
import type {ShoppingSessionWeb, ShutterSnapshot} from './shoppingSession';
import {PhotoIndex} from './photoIndex';

export class CaptureWeb extends WebPlugin implements CaptureContract {
  private readonly injected?: MockContext;
  private readonly session: ShoppingSessionWeb;
  private purpose?: 'shopping' | 'wardrobe' | 'self' | 'storefront';
  private storefrontShopId?: string;
  private index = 0;
  private busy = false;
  private previewVersion = 0;
  private previewRequest = 0;
  private preview?: HTMLImageElement;
  private previewUrl?: string;
  private previewRect?: Parameters<CaptureContract['setPreviewRect']>[0];
  constructor(context?: MockContext, session = getShoppingSessionWeb()) { super(); this.injected = context; this.session = session; }
  private get context() { return this.injected ?? getMockContext(); }
  private clearPreview() {
    this.preview?.remove(); this.preview = undefined;
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = undefined;
  }
  private positionPreview() {
    if (!this.preview || !this.previewRect) return;
    const {x, y, width, height} = this.previewRect;
    Object.assign(this.preview.style, {left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`});
    this.preview.hidden = width === 0 || height === 0;
  }
  private async showPreview(fixture: Asset, version: number) {
    const request = ++this.previewRequest;
    if (typeof document === 'undefined') return;
    const url = URL.createObjectURL(await getWebRepository().readBlob(fixture.file));
    const image = document.createElement('img');
    image.alt = ''; image.setAttribute('aria-hidden', 'true'); image.dataset.sfCameraPreview = '';
    image.hidden = true;
    Object.assign(image.style, {position: 'fixed', zIndex: '-1', objectFit: 'cover', pointerEvents: 'none'});
    image.src = url;
    try { await image.decode(); }
    catch { URL.revokeObjectURL(url); throw deviceFailure('fixture_unavailable', false); }
    if (version !== this.previewVersion || request !== this.previewRequest) { URL.revokeObjectURL(url); return; }
    this.clearPreview(); this.preview = image; this.previewUrl = url;
    document.body.prepend(image); this.positionPreview();
  }
  async openPreview(options: Parameters<CaptureContract['openPreview']>[0]) {
    if (this.busy) throw deviceFailure('busy');
    if (!['shopping', 'wardrobe', 'self', 'storefront'].includes(options.purpose) || !['back', 'front'].includes(options.facing)) throw deviceFailure('invalid_argument', false);
    if (options.purpose === 'storefront') {
      if (typeof options.shopId !== 'string' || !options.shopId) throw deviceFailure('invalid_argument', false);
      if (!await getWebRepository().get({entity: 'Shop', id: options.shopId})) throw deviceFailure('not_found', false);
    } else if (options.shopId !== undefined) throw deviceFailure('invalid_argument', false);
    if (options.purpose === 'shopping' && (await this.session.getState()).phase !== 'recording') throw deviceFailure('not_recording');
    const failure = this.context.failure('Capture.openPreview'); if (failure) throw failure;
    if (this.context.permission('camera') === 'denied') throw deviceFailure('permission_denied', false);
    const fixtures = this.context.fixture<Asset[]>('capture'); if (!fixtures?.length) throw deviceFailure('fixture_unavailable');
    const version = ++this.previewVersion;
    this.purpose = undefined; this.clearPreview();
    await this.showPreview(fixtures[this.index % fixtures.length], version);
    if (version !== this.previewVersion) throw deviceFailure('cancelled', false);
    this.purpose = options.purpose;
    this.storefrontShopId = options.purpose === 'storefront' ? options.shopId : undefined;
    await this.notifyListeners('preview', {ready: true});
  }
  async setPreviewRect(options: {x: number; y: number; width: number; height: number}) {
    if (Object.values(options).some(value => !Number.isFinite(value)) || options.width < 0 || options.height < 0) throw deviceFailure('invalid_argument', false);
    this.context.setFixture('captureRect', options);
    this.previewRect = {...options}; this.positionPreview();
  }
  async takePhoto(options: {kind: 'item' | 'storefront'}) {
    if (!this.purpose) throw deviceFailure('preview_not_ready');
    const purpose = this.purpose, shopId = this.storefrontShopId;
    const previewVersion = this.previewVersion;
    if (!['item', 'storefront'].includes(options.kind) ||
        (purpose === 'storefront' ? options.kind !== 'storefront' : purpose !== 'shopping' && options.kind !== 'item')) throw deviceFailure('invalid_argument', false);
    if (this.busy) throw deviceFailure('busy');
    this.busy = true;
    let shutter: ShutterSnapshot | undefined;
    let staged: string | undefined;
    const takenAt = this.context.clock.now();
    try {
      const failure = this.context.failure('Capture.takePhoto'); if (failure) throw failure;
      if (purpose === 'shopping') shutter = await this.session.acquireShutter();
      const fixtures = this.context.fixture<Asset[]>('capture'); if (!fixtures?.length) throw deviceFailure('fixture_unavailable');
      const fixture = fixtures[this.index % fixtures.length];
      const repository = getWebRepository();
      const target = purpose === 'storefront' && shopId ? await repository.get({entity: 'Shop', id: shopId}) : null;
      if (purpose === 'storefront' && !target) throw deviceFailure('not_found', false);
      const blob = await repository.readBlob(fixture.file);
      staged = await repository.writeBlob(blob, 'capture');
      let asset: Asset = {id: crypto.randomUUID(), file: staged, w: fixture.w, h: fixture.h};
      let photo: Photo | null = null;
      if (shutter || target) {
        const stamp = shutter?.takenAt ?? takenAt;
        if (this.context.permission('location') !== 'granted') throw deviceFailure('location_permission_denied', false);
        let fix = shutter ? await repository.nearestFix({tripId: shutter.tripId, takenAt: stamp}) : null;
        if (!validFix(fix, stamp)) fix = this.context.fixture<Fix>('location') ?? null;
        if (!validFix(fix, stamp)) throw deviceFailure('location_unavailable');
        photo = await repository.commitPhoto({photo: {id: asset.id, file: asset.file, w: asset.w, h: asset.h,
          tripId: shutter?.tripId ?? target!.tripId, shopId: shutter?.shopId ?? target!.id, kind: options.kind,
          takenAt: stamp, location: {lat: fix.lat, lng: fix.lng, accuracyM: fix.accuracyM}, indexState: 'pending'}, storefrontEdit: purpose === 'storefront'});
        asset = {...asset, file: photo.file};
      } else asset = await repository.registerAsset({asset, purpose});
      // The committed Photo/Asset now owns this file. Cleanup must not discard a successful capture.
      staged = undefined;
      copyAssetFixtures(this.context, fixture, asset);
      this.index++;
      const result = {asset, photo}; await this.notifyListeners('captured', result);
      if (photo) void PhotoIndex.index({photoId: photo.id}).catch(() => undefined);
      if (this.purpose && previewVersion === this.previewVersion) {
        void this.showPreview(fixtures[this.index % fixtures.length], previewVersion).catch(() => {
          if (previewVersion === this.previewVersion) this.notifyListeners('preview', {ready: false});
        });
      }
      return result;
    } finally {
      if (staged) await getWebRepository().discardTemp({file: staged});
      await shutter?.release(); this.busy = false;
    }
  }
  async closePreview() {
    this.previewVersion++; this.clearPreview(); this.previewRect = undefined;
    this.purpose = undefined; this.storefrontShopId = undefined;
    await this.notifyListeners('preview', {ready: false});
  }
}
export const Capture = registerDevicePlugin<CaptureContract>('Capture', async () => new CaptureWeb());
