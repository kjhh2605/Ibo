import type {Candidate, Photo} from '../native/contracts';
import type {AgentMedia, Schema} from './types';
import {base64, requireValue} from './wire';

export interface FileIO {
  readBytes(file: string): Promise<Uint8Array>;
  writeTemp(options: {bytes: Uint8Array; mime: string; purpose: 'candidate-mask' | 'provider'; ownerId?: string}): Promise<string>;
  discard(file: string): Promise<void>;
}
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(data.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  bytes.set(new TextEncoder().encode(type), 4);
  bytes.set(data, 8);
  view.setUint32(data.length + 8, crc32(bytes.subarray(4, data.length + 8)));
  return bytes;
}
// Canvas emits RGBA PNG; the local Candidate contract specifically requires grayscale-8 binary PNG.
export async function binaryPNG(pixels: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  requireValue(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && pixels.length === width * height, 'invalid_mask');
  requireValue(pixels.every(pixel => pixel === 0 || pixel === 255), 'invalid_mask');
  const scanlines = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y++) scanlines.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  const compressed = new Uint8Array(await new Response(new Blob([scanlines]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width); view.setUint32(4, height); header[8] = 8;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', compressed), chunk('IEND', new Uint8Array())];
  const output = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}
export function originalMask(rgba: Uint8ClampedArray, maskWidth: number, maskHeight: number, width: number, height: number): {pixels: Uint8Array; bbox: Candidate['bbox']} {
  requireValue(rgba.length === maskWidth * maskHeight * 4 && maskWidth > 0 && maskHeight > 0 && width > 0 && height > 0, 'invalid_mask');
  for (let i = 0; i < rgba.length; i += 4) requireValue((rgba[i] === 0 || rgba[i] === 255) && rgba[i] === rgba[i + 1] && rgba[i] === rgba[i + 2] && rgba[i + 3] === 255, 'invalid_mask');
  const pixels = new Uint8Array(width * height);
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) {
    const sy = Math.min(maskHeight - 1, Math.floor(y * maskHeight / height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(maskWidth - 1, Math.floor(x * maskWidth / width));
      const pixel = rgba[(sy * maskWidth + sx) * 4];
      pixels[y * width + x] = pixel;
      if (pixel) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); }
    }
  }
  requireValue(right > left && bottom > top, 'invalid_mask');
  return {pixels, bbox: [left, top, right - left, bottom - top]};
}

export function createAgentMedia(io: FileIO): AgentMedia {
  return {
    async preparePhoto(photo: Photo, signal: AbortSignal): Promise<Schema['Image']> {
      requireValue(photo.kind === 'item', 'invalid_image');
      signal.throwIfAborted();
      const bytes = await io.readBytes(photo.file);
      signal.throwIfAborted();
      const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>]));
      try {
        requireValue(bitmap.width === photo.w && bitmap.height === photo.h, 'invalid_image');
        const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d');
        requireValue(context, 'image_unavailable');
        context.drawImage(bitmap, 0, 0, width, height);
        // Pixel redraw strips all source EXIF/GPS; JPEG is always newly encoded.
        const blob = await canvas.convertToBlob({type: 'image/jpeg', quality: 0.9});
        requireValue(blob.size <= 4 * 1048576, 'payload_too_large');
        signal.throwIfAborted();
        return {mimeType: 'image/jpeg', data: base64(new Uint8Array(await blob.arrayBuffer())), width, height};
      } finally { bitmap.close(); }
    },
    async cacheCandidate(photo, candidate, signal) {
      signal.throwIfAborted();
      const mask = candidate.mask;
      requireValue(mask.mimeType === 'image/png' && Number.isInteger(mask.width) && Number.isInteger(mask.height) && mask.width > 0 && mask.height > 0 && Math.max(mask.width, mask.height) <= 2048, 'invalid_mask');
      const bytes = Uint8Array.from(atob(mask.data), character => character.charCodeAt(0));
      requireValue(bytes.length > 0 && bytes.length <= 4 * 1048576, 'invalid_mask');
      const bitmap = await createImageBitmap(new Blob([bytes]));
      try {
        requireValue(bitmap.width === mask.width && bitmap.height === mask.height, 'invalid_mask');
        const bbox = candidate.bbox;
        requireValue(Array.isArray(bbox) && bbox.length === 4 && bbox.every(Number.isInteger) && bbox[0] >= 0 && bbox[1] >= 0 && bbox[2] > 0 && bbox[3] > 0 && bbox[0] + bbox[2] <= mask.width && bbox[1] + bbox[3] <= mask.height, 'invalid_mask');
        const canvas = new OffscreenCanvas(mask.width, mask.height);
        const context = canvas.getContext('2d', {willReadFrequently: true});
        requireValue(context, 'image_unavailable');
        context.drawImage(bitmap, 0, 0);
        const normalized = originalMask(context.getImageData(0, 0, mask.width, mask.height).data, mask.width, mask.height, photo.w, photo.h);
        const prefix = new TextEncoder().encode(`${photo.id}sam`);
        const identity = new Uint8Array(prefix.length + normalized.pixels.length);
        identity.set(prefix); identity.set(normalized.pixels, prefix.length);
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', identity));
        const id = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
        const png = await binaryPNG(normalized.pixels, photo.w, photo.h);
        signal.throwIfAborted();
        const file = await io.writeTemp({bytes: png, mime: 'image/png', purpose: 'candidate-mask', ownerId: photo.id});
        // Controller registers the file before checking cancellation, including late writes.
        return {id, photoId: photo.id, source: 'sam', label: candidate.label, score: candidate.score, mask: file, bbox: normalized.bbox};
      } finally { bitmap.close(); }
    },
    async readVoice(file, signal) { signal.throwIfAborted(); const bytes = await io.readBytes(file); signal.throwIfAborted(); return bytes; },
    discard: io.discard,
  };
}
