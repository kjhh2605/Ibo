import type {components} from '../generated/relay-api';
import {TryOnError} from './errors';

type Image = components['schemas']['GeneratedImage'];
export function decodeImage(image: Image, kind: 'upload' | 'provider'): Uint8Array {
  const limit = kind === 'upload' ? 4 * 1024 * 1024 : 32 * 1024 * 1024;
  if (typeof image.data !== 'string' || image.data.length > Math.ceil(limit / 3) * 4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(image.data)) throw new TryOnError('io_error');
  const binary = atob(image.data);
  if (!binary.length || binary.length > limit) throw new TryOnError('io_error');
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const actual = imageDimensions(bytes);
  const side = kind === 'upload' ? 2048 : 8192;
  const pixels = kind === 'upload' ? 4194304 : 33554432;
  if (actual.mimeType !== image.mimeType || actual.width !== image.width || actual.height !== image.height ||
      actual.width > side || actual.height > side || actual.width * actual.height > pixels) throw new TryOnError('io_error');
  return bytes;
}

/** Reads dimensions without decoding/re-encoding pixels or touching provider metadata. */
export function imageDimensions(bytes: Uint8Array): Omit<Image, 'data'> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 33 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a &&
      view.getUint32(8) === 13 && view.getUint32(12) === 0x49484452) {
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    if (width && height) return {width, height, mimeType: 'image/png'};
  } else if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 8) {
        const height = view.getUint16(offset + 3);
        const width = view.getUint16(offset + 5);
        if (width && height) return {width, height, mimeType: 'image/jpeg'};
        break;
      }
      offset += length;
    }
  }
  throw new TryOnError('io_error');
}

export function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  return btoa(chunks.join(''));
}
