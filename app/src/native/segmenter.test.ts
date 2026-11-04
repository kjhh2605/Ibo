import {beforeEach, describe, expect, it, vi} from 'vitest';
import {binaryPixels, createWebSegmenter, decodeWebRaster, encodeWebPng, maskBounds, sortedFixtureMasks} from './segmenter';
import {createMockContext} from './web/context';

const storage = vi.hoisted(() => ({files: new Map<string, Blob>(), next: 0}));
vi.mock('../data/web/repository', () => ({
  getWebRepository: () => ({async discardTemp({file}: {file: string}) { storage.files.delete(file); }}),
  async readBlob(file: string) { const blob = storage.files.get(file); if (!blob) throw {code: 'io_error'}; return blob; },
  async writeBlob(blob: Blob, purpose: string) { const file = `blob:${purpose}:${storage.next++}`; storage.files.set(file, blob); return file; },
}));
beforeEach(() => { storage.files.clear(); storage.next = 0; });

function fixture(w: number, h: number) {
  const first = new Uint8Array(w * h), second = new Uint8Array(w * h), third = new Uint8Array(w * h);
  first.fill(255, w + 1, w + 3); second[w * h - 1] = 255; third[0] = 255;
  return [{pixels: first, score: 0.5}, {pixels: second, score: 0.9}, {pixels: third, score: 0.9}];
}

describe('web binary masks', () => {
  it('preserves exact grayscale pixels and tight non-square coordinates through PNG encoding', async () => {
    const masks = fixture(9, 4), binary = masks[0].pixels;
    const blob = await encodeWebPng(9, 4, binary, true);
    const decoded = await decodeWebRaster(blob);
    expect([decoded.w, decoded.h]).toEqual([9, 4]);
    expect(binaryPixels(decoded)).toEqual(binary);
    expect(maskBounds(binary, 9, 4)).toEqual([1, 1, 2, 1]);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[25]).toBe(0);
  });
  it.each([
    ['color', [70, 120, 170, 255]],
    ['intermediate gray', [127, 127, 127, 255]],
    ['transparent foreground', [255, 255, 255, 0]],
  ] as const)('rejects %s rather than treating it as a privacy mask', (_name, pixel) => {
    expect(() => binaryPixels({w: 1, h: 1, rgba: new Uint8ClampedArray(pixel)}))
      .toThrowError(expect.objectContaining({code: 'inference_failed'}));
  });
  it('keeps all three masks with stable decoder-order score ties', () => {
    expect(sortedFixtureMasks(fixture(9, 4), 9, 4).map(mask => mask.bbox)).toEqual([[8, 3, 1, 1], [0, 0, 1, 1], [1, 1, 2, 1]]);
    const invalid = fixture(9, 4); invalid[2].pixels.fill(0);
    expect(() => sortedFixtureMasks(invalid, 9, 4)).toThrowError(expect.objectContaining({code: 'inference_failed'}));
  });
  it('reuses prepared masks, supports exact edge taps, and invalidates and cleans released handles', async () => {
    const w = 9, h = 4, pixels = new Uint8ClampedArray(w * h * 4).fill(255);
    storage.files.set('blob:source', await encodeWebPng(w, h, pixels));
    const asset = {id: 'a', file: 'blob:source', w, h}, masks = fixture(w, h);
    const context = createMockContext({fixtures: {'Segmenter.asset:a': {person: masks, taps: [{x: 1, y: 1, masks}]}}});
    const segmenter = createWebSegmenter(context), prepared = await segmenter.prepare({asset});
    const result = await segmenter.tap({handle: prepared.handle, x: 1, y: 1});
    expect(result.masks.map(mask => mask.bbox)).toEqual([[8, 3, 1, 1], [0, 0, 1, 1], [1, 1, 2, 1]]);
    expect(binaryPixels(await decodeWebRaster(storage.files.get(result.masks[0].mask)!))).toEqual(masks[1].pixels);
    context.setFixture('Segmenter.asset:a', undefined);
    expect((await segmenter.person({handle: prepared.handle})).masks.map(mask => mask.score)).toEqual([0.9, 0.9, 0.5]);
    await expect(segmenter.tap({handle: prepared.handle, x: 1.01, y: 0.5})).rejects.toMatchObject({code: 'invalid_argument'});
    await segmenter.release({handle: prepared.handle});
    expect(result.masks.every(mask => !storage.files.has(mask.mask))).toBe(true);
    await expect(segmenter.person({handle: prepared.handle})).rejects.toMatchObject({code: 'handle_expired'});
  });
  it('invalidates the old handle on new prepare and rejects fixture or injected errors without native fallback', async () => {
    const asset = {id: 'a', file: 'blob:source', w: 9, h: 4};
    storage.files.set(asset.file, await encodeWebPng(9, 4, new Uint8ClampedArray(9 * 4 * 4).fill(255)));
    const context = createMockContext({fixtures: {'Segmenter.asset:a': {person: fixture(9, 4), taps: []}}});
    const segmenter = createWebSegmenter(context), first = await segmenter.prepare({asset});
    await segmenter.prepare({asset});
    await expect(segmenter.person({handle: first.handle})).rejects.toMatchObject({code: 'handle_expired'});
    context.setFailure('Segmenter.prepare', {code: 'model_missing', message: 'missing', retryable: false});
    await expect(segmenter.prepare({asset})).rejects.toMatchObject({code: 'model_missing'});
  });
});
