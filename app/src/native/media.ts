import {WebPlugin} from '@capacitor/core';
import type {Asset, Media as MediaContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';
import {getMockContext} from './web/context';
import type {MockContext} from './web/context';
import {getWebRepository} from '../data/web/repository';
import {deviceFailure} from './shoppingSession';

/** Strip metadata without decoding or changing compressed pixels of normalized photos. */
export async function stripPhotoMetadata(blob: Blob): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    chunks.push(bytes.subarray(0, 2)); let at = 2;
    while (at < bytes.length) {
      if (bytes[at] !== 0xff || at + 1 >= bytes.length) throw deviceFailure('invalid_image');
      const marker = bytes[at + 1];
      if (marker === 0xda || marker === 0xd9) { chunks.push(bytes.subarray(at)); return new Blob(chunks, {type: 'image/jpeg'}); }
      if (at + 4 > bytes.length) throw deviceFailure('invalid_image');
      const size = (bytes[at + 2] << 8) | bytes[at + 3];
      if (size < 2 || at + size + 2 > bytes.length) throw deviceFailure('invalid_image');
      if (!(marker >= 0xe1 && marker <= 0xef) && marker !== 0xfe) chunks.push(bytes.subarray(at, at + size + 2));
      at += size + 2;
    }
  } else if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) {
    chunks.push(bytes.subarray(0, 8)); let at = 8; const view = new DataView(bytes.buffer);
    while (at + 12 <= bytes.length) {
      const size = view.getUint32(at); if (size > bytes.length - at - 12) throw deviceFailure('invalid_image');
      const kind = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
      if (['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS'].includes(kind)) chunks.push(bytes.subarray(at, at + size + 12));
      at += size + 12;
      if (kind === 'IEND') return new Blob(chunks, {type: 'image/png'});
    }
  }
  throw deviceFailure('invalid_image');
}
export class MediaWeb extends WebPlugin implements MediaContract {
  private readonly injected?: MockContext;
  constructor(context?: MockContext) { super(); this.injected = context; }
  private get context() { return this.injected ?? getMockContext(); }
  async pick(options: {purpose: 'wardrobe' | 'self'}) {
    if (options.purpose !== 'wardrobe' && options.purpose !== 'self') throw deviceFailure('invalid_argument', false);
    const failure = this.context.failure('Media.pick'); if (failure) throw failure;
    const fixture = this.context.fixture<Asset | null>(`media.${options.purpose}`);
    if (!fixture) throw deviceFailure('cancelled', false);
    const repository = getWebRepository();
    const file = await repository.writeBlob(await repository.readBlob(fixture.file), 'import');
    try {
      const asset = await repository.registerAsset({asset: {...fixture, id: crypto.randomUUID(), file}, purpose: options.purpose});
      return {asset};
    } finally { await repository.discardTemp({file}); }
  }
  async exportPhoto({photoId}: {photoId: string}) {
    const repository = getWebRepository(); const photo = await repository.getPhoto({id: photoId});
    if (!photo) throw deviceFailure('invalid_reference', false);
    const blob = await stripPhotoMetadata(await repository.readBlob(photo.file));
    const uri = await repository.writeBlob(blob, 'export');
    if (typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `Street-Fitting-${photoId}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    }
    await this.notifyListeners('exported', {uri, sourceId: photoId}); return {uri};
  }
  async exportResult(_options: {resultId: string}): Promise<{uri: string}> { throw deviceFailure('result_download_disabled', false); }
  async discard(options: {assetId: string}) { await getWebRepository().discardAsset(options); }
}
export const Media = registerDevicePlugin<MediaContract>('Media', async () => new MediaWeb());
