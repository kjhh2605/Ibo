import type {BBox, Candidate} from '../../native/contracts';

export type Pixels = {width: number; height: number; data: Uint8ClampedArray};
export type ImageCodec = {decode(blob: Blob): Promise<Pixels>; encode(pixels: Pixels): Promise<Blob>};

export function failure(code: string): never {
  throw {code, message: `Device storage operation failed (${code})`, retryable: code === 'io_error' || code === 'storage_full'};
}

export const browserImages: ImageCodec = {
  async decode(blob) {
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(blob, {imageOrientation: 'none'}); }
    catch { return failure('invalid_argument'); }
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      if (!context) return failure('io_error');
      context.drawImage(bitmap, 0, 0);
      return {width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data};
    } finally { bitmap.close(); }
  },
  async encode(pixels) {
    const canvas = new OffscreenCanvas(pixels.width, pixels.height);
    const context = canvas.getContext('2d');
    if (!context) return failure('io_error');
    context.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height), 0, 0);
    return canvas.convertToBlob({type: 'image/png'});
  },
};

export type PreparedMask = {id: string; binary: Uint8Array; bbox: BBox; width: number; height: number};
/** Hash decoded binary pixels, not PNG encoding, score, label or a caller-supplied ID. */
export async function prepareMask(codec: ImageCodec, mask: Blob, candidate: Candidate): Promise<PreparedMask> {
  const matte = await codec.decode(mask);
  const {width, height} = matte;
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || matte.data.length !== width * height * 4 || mask.type !== 'image/png') failure('invalid_argument');
  const binary = new Uint8Array(width * height);
  let left = width, top = height, right = -1, bottom = -1;
  for (let i = 0; i < binary.length; i++) {
    const offset = i * 4;
    const value = matte.data[offset];
    if ((value !== 0 && value !== 255) || matte.data[offset + 1] !== value || matte.data[offset + 2] !== value || matte.data[offset + 3] !== 255) failure('invalid_argument');
    binary[i] = value;
    if (value) {
      const x = i % width, y = Math.floor(i / width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) failure('invalid_argument');
  const bbox: BBox = [left, top, right - left + 1, bottom - top + 1];
  if (bbox.some((value, i) => value !== candidate.bbox[i])) failure('invalid_argument');
  const prefix = new TextEncoder().encode(candidate.photoId + candidate.source);
  const hashInput = new Uint8Array(prefix.length + binary.length);
  hashInput.set(prefix); hashInput.set(binary, prefix.length);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', hashInput));
  const id = `piece:${Array.from(hash, value => value.toString(16).padStart(2, '0')).join('')}`;
  return {id, binary, bbox, width, height};
}

export async function cutout(codec: ImageCodec, source: Blob, mask: PreparedMask) {
  const image = await codec.decode(source);
  const {binary, bbox, width, height, id} = mask;
  if (image.width !== width || image.height !== height || image.data.length !== width * height * 4) failure('invalid_argument');
  const [left, top] = bbox;
  const data = new Uint8ClampedArray(bbox[2] * bbox[3] * 4);
  for (let y = 0; y < bbox[3]; y++) for (let x = 0; x < bbox[2]; x++) {
    const from = (width * (y + top) + x + left) * 4;
    const to = (bbox[2] * y + x) * 4;
    if (binary[from / 4]) {
      data[to] = image.data[from]; data[to + 1] = image.data[from + 1]; data[to + 2] = image.data[from + 2]; data[to + 3] = image.data[from + 3];
    }
  }
  return {id, blob: await codec.encode({width: bbox[2], height: bbox[3], data})};
}
