import type {components} from '../generated/relay-api';
import type {FileRef, SelfPhoto} from '../native/contracts';

type Image = components['schemas']['Image'];
export type UploadImageReader = (file: FileRef, signal?: AbortSignal) => Promise<Image>;

/** Reads only the registered, independently encoded masked derivative. */
export async function prepareMaskedSelfPhoto(
  self: SelfPhoto | null,
  readImage: UploadImageReader,
  signal?: AbortSignal,
): Promise<components['schemas']['MaskedSelfPhoto']> {
  signal?.throwIfAborted();
  if (!self?.maskedFile || self.maskedFile === self.file || self.maskedFile === self.headMask) {
    throw new Error('A safely masked self photo is required.');
  }
  const image = await readImage(self.maskedFile, signal);
  signal?.throwIfAborted();
  return {image, headMasked: true};
}
