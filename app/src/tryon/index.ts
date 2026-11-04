import {Network} from '@capacitor/network';
import {config} from '../config';
import {FaceMask} from '../native/faceMask';
import {Media} from '../native/media';
import {Store} from '../native/store';
import {readBytes, writeTemp} from '../native/files';
import {createRelayClient} from '../relay/client';
import {createTryOnController as createController} from './controller';
import type {TryOnController, TryOnDependencies} from './controller';
import {createResultExporter, resultExportPolicy} from './export';
import {decodeImage, encodeBase64, imageDimensions} from './images';

export type {Outfit, TryOnController, TryOnDependencies, TryOnDraft, TryOnPhase, TryOnState} from './controller';
export {wornSlots} from './controller';
export type {ProvenanceApproval, ResultExportPolicy} from './export';
export {createResultExporter, resultExportPolicy} from './export';
export {TryOnError} from './errors';

const relay = createRelayClient();
const production: TryOnDependencies = {
  store: Store,
  faceMask: FaceMask,
  async readImage(file, signal) {
    signal?.throwIfAborted();
    const bytes = await readBytes(file);
    signal?.throwIfAborted();
    const image = {...imageDimensions(bytes), data: encodeBase64(bytes)};
    decodeImage(image, 'upload');
    return image;
  },
  request: (body, signal) => relay.request('/v1/tryon', body, {signal}),
  async writeProvider(image) {
    const bytes = decodeImage(image, 'provider');
    return writeTemp({bytes, mime: image.mimeType, purpose: 'provider'});
  },
  async online() { return (await Network.getStatus()).connected; },
  exportResult: createResultExporter(Media, {...resultExportPolicy, enabled: config.resultDownload}),
  discardAsset: options => Media.discard(options),
};

export function createTryOnController(dependencies: TryOnDependencies = production): TryOnController {
  return createController(dependencies);
}

/** Route-independent memory owner: never recreate this for Outfit → Trips → Pick. */
export const tryOn = createTryOnController();
