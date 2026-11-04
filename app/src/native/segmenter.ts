import type {Asset, BBox, SegMask, Segmenter as SegmenterContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';
import {getMockContext} from './web/context';
import type {MockContext} from './web/context';
import {getWebRepository, readBlob, writeBlob} from '../data/web/repository';

export type WebRaster = {w: number; h: number; rgba: Uint8ClampedArray};
export type WebMask = {pixels: Uint8Array | number[]; score: number};
export type SegmenterFixture = {person: WebMask[]; taps: Array<{x: number; y: number; masks: WebMask[]}>};

export function mlError(code: string): never {
  throw {code, message: 'The local image operation could not be completed.', retryable: false};
}

export function checkMlFailure(context: MockContext, operation: string): void {
  const failure = context.failure(operation);
  if (failure) throw failure;
}

export function maskBounds(pixels: ArrayLike<number>, w: number, h: number): BBox {
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 1 || h < 1 || pixels.length !== w * h) mlError('inference_failed');
  let left = w, top = h, right = -1, bottom = -1;
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] !== 0 && pixels[i] !== 255) mlError('inference_failed');
    if (pixels[i]) {
      const x = i % w, y = Math.floor(i / w);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) mlError('inference_failed');
  return [left, top, right - left + 1, bottom - top + 1];
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(name: string, bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const chunk = new Uint8Array(bytes.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, bytes.length);
  chunk.set(new TextEncoder().encode(name), 4); chunk.set(bytes, 8);
  view.setUint32(chunk.length - 4, crc32(chunk.subarray(4, chunk.length - 4)));
  return chunk;
}

/** Lossless metadata-free PNG. Masks use grayscale, not a colored screenshot. */
export async function encodeWebPng(w: number, h: number, pixels: Uint8Array | Uint8ClampedArray, grayscale = false): Promise<Blob> {
  const channels = grayscale ? 1 : 4;
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 1 || h < 1 || pixels.length !== w * h * channels) mlError('io_error');
  const rows = new Uint8Array((w * channels + 1) * h);
  for (let y = 0; y < h; y++) rows.set(pixels.subarray(y * w * channels, (y + 1) * w * channels), y * (w * channels + 1) + 1);
  const compressed = new Uint8Array(await new Response(new Blob([rows]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, w); view.setUint32(4, h); header[8] = 8; header[9] = grayscale ? 0 : 6;
  return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array())], {type: 'image/png'});
}

/** PNG fixtures decode without a DOM; other imported image formats use the browser codec. */
export async function decodeWebRaster(blob: Blob): Promise<WebRaster> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (bytes.length >= 33 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    const view = new DataView(bytes.buffer);
    const w = view.getUint32(16), h = view.getUint32(20), type = bytes[25];
    if (bytes[24] === 8 && [0, 2, 4, 6].includes(type) && bytes[28] === 0 && w > 0 && h > 0 && w * h <= 40_000_000) {
      const parts: Uint8Array<ArrayBuffer>[] = [];
      for (let at = 8; at + 12 <= bytes.length;) {
        const length = view.getUint32(at);
        if (at + length + 12 > bytes.length) mlError('io_error');
        if (crc32(bytes.subarray(at + 4, at + 8 + length)) !== view.getUint32(at + 8 + length)) mlError('io_error');
        if (String.fromCharCode(...bytes.subarray(at + 4, at + 8)) === 'IDAT') parts.push(bytes.slice(at + 8, at + 8 + length));
        at += length + 12;
      }
      const channels = type === 0 ? 1 : type === 2 ? 3 : type === 4 ? 2 : 4;
      const stride = w * channels;
      const raw = new Uint8Array(await new Response(new Blob(parts).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
      if (raw.length !== (stride + 1) * h) mlError('io_error');
      const decoded = new Uint8Array(stride * h);
      for (let y = 0; y < h; y++) {
        const filter = raw[y * (stride + 1)];
        if (filter > 4) mlError('io_error');
        for (let x = 0; x < stride; x++) {
          const at = y * stride + x, a = x >= channels ? decoded[at - channels] : 0;
          const b = y ? decoded[at - stride] : 0, c = y && x >= channels ? decoded[at - stride - channels] : 0;
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          decoded[at] = raw[y * (stride + 1) + x + 1] + predictor;
        }
      }
      const rgba = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < w * h; i++) {
        rgba[i * 4] = decoded[i * channels];
        rgba[i * 4 + 1] = decoded[i * channels + (type === 0 || type === 4 ? 0 : 1)];
        rgba[i * 4 + 2] = decoded[i * channels + (type === 0 || type === 4 ? 0 : 2)];
        rgba[i * 4 + 3] = type === 4 ? decoded[i * channels + 1] : type === 6 ? decoded[i * channels + 3] : 255;
      }
      return {w, h, rgba};
    }
  }
  if (typeof createImageBitmap !== 'function') mlError('io_error');
  const bitmap = await createImageBitmap(blob, {imageOrientation: 'from-image'});
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d');
    if (!context) mlError('io_error');
    context.drawImage(bitmap, 0, 0);
    return {w: bitmap.width, h: bitmap.height, rgba: context.getImageData(0, 0, bitmap.width, bitmap.height).data};
  } finally { bitmap.close(); }
}

export function binaryPixels(raster: WebRaster): Uint8Array {
  const pixels = new Uint8Array(raster.w * raster.h);
  for (let i = 0; i < pixels.length; i++) {
    const value = raster.rgba[i * 4];
    if ((value !== 0 && value !== 255) || raster.rgba[i * 4 + 1] !== value || raster.rgba[i * 4 + 2] !== value || raster.rgba[i * 4 + 3] !== 255) mlError('inference_failed');
    pixels[i] = value;
  }
  return pixels;
}

export function getSegmenterFixture(context: MockContext, asset: Asset): SegmenterFixture {
  const fixture = context.fixture<SegmenterFixture>(`Segmenter.asset:${asset.id}`) ?? context.fixture<SegmenterFixture>(`Segmenter.asset:${asset.file}`);
  if (!fixture) mlError('model_missing');
  return fixture;
}

export function sortedFixtureMasks(masks: WebMask[], w: number, h: number): Array<WebMask & {bbox: BBox}> {
  if (!Array.isArray(masks) || masks.length !== 3) mlError('inference_failed');
  return masks.map((mask, index) => {
    if (!Number.isFinite(mask.score) || mask.score < 0 || mask.score > 1) mlError('inference_failed');
    return {...mask, index, bbox: maskBounds(mask.pixels, w, h)};
  }).sort((a, b) => b.score - a.score || a.index - b.index);
}

export function createWebSegmenter(context?: MockContext): SegmenterContract {
  let active: {handle: string; asset: Asset; fixture: SegmenterFixture; files: string[]} | undefined;
  let generation = 0;
  const listeners = new Set<(event: {handle: string; assetId: string}) => void>();
  const ctx = () => context ?? getMockContext();
  async function decode(handle: string, x: number, y: number, person: boolean): Promise<{masks: SegMask[]}> {
    const current = active;
    if (!current || current.handle !== handle) mlError('handle_expired');
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 1 || y > 1) mlError('invalid_argument');
    const masks = person ? current.fixture.person : current.fixture.taps.find(tap => tap.x === x && tap.y === y)?.masks;
    if (!masks) mlError('inference_failed');
    const sorted = sortedFixtureMasks(masks, current.asset.w, current.asset.h);
    const repository = getWebRepository();
    const files: string[] = [];
    try {
      const output: SegMask[] = [];
      for (const mask of sorted) {
        const blob = await encodeWebPng(current.asset.w, current.asset.h, Uint8Array.from(mask.pixels), true);
        const file = await writeBlob(blob, 'candidate-mask');
        files.push(file);
        output.push({mask: file, bbox: mask.bbox, score: mask.score});
      }
      if (active !== current) mlError('handle_expired');
      current.files.push(...files);
      return {masks: output};
    } catch (error) {
      await Promise.all(files.map(file => repository.discardTemp({file})));
      throw error;
    }
  }
  return {
    async addListener(_name, listener) { listeners.add(listener); return {async remove() { listeners.delete(listener); }}; },
    async prepare({asset}) {
      checkMlFailure(ctx(), 'Segmenter.prepare');
      const previous = active;
      active = undefined;
      const ticket = ++generation;
      if (previous) await Promise.all(previous.files.map(file => getWebRepository().discardTemp({file})));
      const image = await decodeWebRaster(await readBlob(asset.file));
      if (image.w !== asset.w || image.h !== asset.h) mlError('inference_failed');
      const fixture = getSegmenterFixture(ctx(), asset);
      if (ticket !== generation) mlError('handle_expired');
      const handle = crypto.randomUUID();
      active = {handle, asset: {...asset}, fixture, files: []};
      for (const listener of listeners) listener({handle, assetId: asset.id});
      return {handle, w: asset.w, h: asset.h};
    },
    async tap({handle, x, y}) { checkMlFailure(ctx(), 'Segmenter.tap'); return decode(handle, x, y, false); },
    async person({handle}) { checkMlFailure(ctx(), 'Segmenter.person'); return decode(handle, 0.5, 0.5, true); },
    async release({handle}) {
      checkMlFailure(ctx(), 'Segmenter.release');
      if (!active || active.handle !== handle) mlError('handle_expired');
      const previous = active;
      active = undefined; generation++;
      await Promise.all(previous.files.map(file => getWebRepository().discardTemp({file})));
    },
  };
}

export const Segmenter = registerDevicePlugin<SegmenterContract>('Segmenter', async () => createWebSegmenter());
