import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {SelfPhoto} from './contracts';
import {composeRaster, createWebFaceMask, decideComposition, detectFixtureHead, detectHead, maskRaster, measureComposition, privacyMetrics} from './faceMask';
import type {HeadGeometry} from './faceMask';
import {binaryPixels, decodeWebRaster, encodeWebPng} from './segmenter';
import type {WebRaster} from './segmenter';
import {createMockContext} from './web/context';
import {parseCompositionConfig} from './compositionConfig';
import type {FaceMaskConfig} from './compositionConfig';
import type * as CompositionConfigModule from './compositionConfig';

const testConfig = vi.hoisted(() => ({schemaVersion: 1, configVersion: 'local-composition-uncalibrated-v1', mode: 'a', compositionThresholds: null, provenance: null} as FaceMaskConfig));
vi.mock('./compositionConfig', async importOriginal => {
  const actual = await importOriginal<typeof CompositionConfigModule>();
  return {...actual, localCompositionConfig: testConfig};
});

const storage = vi.hoisted(() => ({files: new Map<string, Blob>(), next: 0, self: null as SelfPhoto | null, sidecar: null as string | null, retained: 0}));
vi.mock('../data/web/repository', () => ({
  getWebRepository: () => ({
    async getSelfPhoto() { return structuredClone(storage.self); },
    async replaceSelfPhoto({selfPhoto, sidecar}: {selfPhoto: SelfPhoto; sidecar: string}) { storage.self = structuredClone(selfPhoto); storage.sidecar = sidecar; return structuredClone(selfPhoto); },
    async retainSelf({updatedAt}: {updatedAt: number}) { if (!storage.self || storage.self.updatedAt !== updatedAt) throw {code: 'self_photo_changed'}; storage.retained++; return structuredClone(storage.self); },
    async releaseSelf() { storage.retained--; },
    async getSelfSidecar() { return storage.sidecar; },
    async discardTemp({file}: {file: string}) { storage.files.delete(file); },
  }),
  async readBlob(file: string) { const blob = storage.files.get(file); if (!blob) throw {code: 'io_error'}; return blob; },
  async writeBlob(blob: Blob, purpose: string) { const file = `blob:${purpose}:${storage.next++}`; storage.files.set(file, blob); return file; },
}));

const w = 160, h = 240;
function silhouette(): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let y = 20; y <= 220; y++) {
    const left = y <= 55 ? 60 : y <= 70 ? 70 : y <= 120 ? 35 : 45;
    const right = y <= 55 ? 99 : y <= 70 ? 89 : y <= 120 ? 124 : 114;
    mask.fill(255, y * w + left, y * w + right + 1);
  }
  return mask;
}
function image(color = [70, 120, 170, 255]): WebRaster {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set(color, i * 4);
  return {w, h, rgba};
}
function geometry(): HeadGeometry {
  const result = detectHead(silhouette(), w, h);
  if (!result.ok) throw new Error(result.reason);
  return result.geometry;
}
function masks(pixels = silhouette()) { return [0.9, 0.8, 0.7].map(score => ({pixels, score})); }
function noPerson(): Uint8Array { const pixels = new Uint8Array(w * h); pixels.fill(255, 0, 5); return pixels; }
async function fixtureRuntime() {
  const source = image(), provider = image([90, 140, 190, 255]);
  storage.files.set('blob:source', await encodeWebPng(w, h, source.rgba));
  storage.files.set('blob:provider', await encodeWebPng(w, h, provider.rgba));
  const context = createMockContext({now: 123, fixtures: {
    'Segmenter.asset:self': {person: masks(), taps: []},
    'Segmenter.asset:blob:provider': {person: masks(), taps: []},
  }});
  return {context, face: createWebFaceMask(context), asset: {id: 'self', file: 'blob:source', w, h}};
}
beforeEach(() => {
  storage.files.clear(); storage.next = 0; storage.self = null; storage.sidecar = null; storage.retained = 0;
  Object.assign(testConfig, {schemaVersion: 1, configVersion: 'local-composition-uncalibrated-v1', mode: 'a', compositionThresholds: null, provenance: null});
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const thresholds = {version: 'unit-boundaries-not-calibration', maxBoundaryColorDeltaE: 10, maxBoundaryOffsetRatio: 0.1};
const exact = {neckColorDeltaE95: 10, shoulderColorDeltaE95: 10, neckOffsetRatio95: 0.1, shoulderOffsetRatio95: 0.1};
describe('automatic composition decision', () => {
  it('composeThresholdInclusiveBoundary accepts all four equal thresholds', () => {
    expect(decideComposition(exact, thresholds)).toMatchObject({passed: true, decision: 'composited', thresholdVersion: thresholds.version});
  });
  it.each(Object.keys(exact) as Array<keyof typeof exact>)('oneMetricExceededIsFaceless for %s', metric => {
    expect(decideComposition({...exact, [metric]: exact[metric] + 0.0001}, thresholds)).toMatchObject({passed: false, decision: 'threshold_exceeded'});
  });
  it('nullThresholdsAreNotCalibrated even when metrics are unavailable', () => {
    expect(decideComposition({...exact, neckColorDeltaE95: null}, null)).toMatchObject({passed: false, decision: 'not_calibrated', thresholdVersion: null});
  });
  it.each([null, NaN, Infinity, -1])('metricsUnavailableIsFaceless for %s', value => {
    expect(decideComposition({...exact, shoulderOffsetRatio95: value}, thresholds)).toMatchObject({passed: false, decision: 'metrics_unavailable'});
  });
});

describe('binary silhouette and source-contribution privacy', () => {
  it.each(['a', 'b', 'c'] as const)('removes every GT source contribution in mode %s regardless of source RGB', mode => {
    const found = geometry(), source = image([127, 127, 127, 255]), gt = new Uint8Array(w * h);
    for (let y = 20; y <= 55; y++) gt.fill(255, y * w + 60, y * w + 100);
    const transformed = maskRaster(source, found, mode);
    expect(privacyMetrics(found, mode, gt)).toMatchObject({gtHeadPixels: 1440, exposedHeadPixels: 0, privacyPassed: true});
    gt[180 * w + 80] = 255;
    expect(privacyMetrics(found, mode, gt)).toMatchObject({exposedHeadPixels: 1, privacyPassed: false});
    expect(transformed.image.h).toBe(mode === 'b' ? h - 62 : h);
    expect(privacyMetrics(found, mode, null)).toMatchObject({gtHeadPixels: null, exposedHeadPixels: null, privacyPassed: null});
  });
  it('rejects no-person, ambiguous disconnected people, and clipped-head geometry without label hints', () => {
    expect(detectHead(noPerson(), w, h)).toEqual({ok: false, reason: 'person_not_found'});
    const ambiguous = silhouette();
    for (let y = 0; y < h; y++) ambiguous.fill(255, y * w, y * w + 30);
    expect(detectHead(ambiguous, w, h)).toEqual({ok: false, reason: 'ambiguous_person'});
    const clipped = silhouette();
    for (let y = 0; y < 20; y++) clipped.fill(255, y * w + 60, y * w + 100);
    expect(detectHead(clipped, w, h)).toEqual({ok: false, reason: 'unsafe_boundary'});
    expect(detectFixtureHead([{pixels: noPerson(), score: 0.9}, {pixels: clipped, score: 0.8}, {pixels: ambiguous, score: 0.7}], w, h)).toEqual({ok: false, reason: 'unsafe_boundary'});
  });
  it('measures actual CIELAB color and contour offsets before feathering', () => {
    const found = geometry(), source = image(), provider = image();
    expect(measureComposition(source, provider, found, found)).toEqual({neckColorDeltaE95: 0, shoulderColorDeltaE95: 0, neckOffsetRatio95: 0, shoulderOffsetRatio95: 0});
    const changed = measureComposition(source, image([170, 20, 40, 255]), found, found);
    expect(changed.neckColorDeltaE95).toBeGreaterThan(30); expect(changed.shoulderColorDeltaE95).toBeGreaterThan(30);
    const shifted = {...found, neckY: found.neckY + 5};
    expect(measureComposition(source, provider, found, shifted).neckOffsetRatio95).toBeCloseTo(5 / Math.hypot(w, h));
    expect(measureComposition(source, image([70, 120, 170, 0]), found, found).neckColorDeltaE95).toBeNull();
  });
  it('crops generated head completely for faceless results and protects provider head during feathering', () => {
    const found = geometry(), source = image(), provider = image([250, 0, 0, 255]);
    const cropped = composeRaster(source, provider, found, found, false);
    expect(cropped.h).toBe(178);
    expect(cropped.rgba).toEqual(provider.rgba.slice(62 * w * 4));
    const composed = composeRaster(source, provider, found, found, true);
    expect(Array.from(composed.rgba.slice((30 * w + 80) * 4, (30 * w + 80) * 4 + 4))).toEqual([70, 120, 170, 255]);
    const at = (11 * w + 52) * 4;
    expect(Array.from(composed.rgba.slice(at, at + 4))).toEqual([70, 120, 170, 255]);
    expect(provider.rgba[(30 * w + 80) * 4]).toBe(250);
    expect(() => composeRaster(source, provider, found, found, true, found.headBox[1] + found.headBox[3])).toThrow();
    expect(decideComposition(measureComposition(source, provider, found, found, 62), thresholds)).toMatchObject({passed: false, decision: 'metrics_unavailable'});
    const uncovered = {...found, headBox: [found.headBox[0] - 1, found.headBox[1], found.headBox[2] + 1, found.headBox[3]] as HeadGeometry['headBox']};
    expect(decideComposition(measureComposition(source, provider, found, uncovered), thresholds)).toMatchObject({passed: false, decision: 'metrics_unavailable'});
    expect(() => composeRaster(source, provider, found, uncovered, true)).toThrow();
  });
});

describe('FaceMask web runtime', () => {
  it('rejects fixture threshold overrides rather than enabling synthetic calibration', async () => {
    const {face, context, asset} = await fixtureRuntime();
    context.setFixture('FaceMask.config', {mode: 'a', compositionThresholds: thresholds});
    await expect(face.register({asset})).rejects.toMatchObject({code: 'invalid_argument'});
    expect(storage.self).toBeNull();
  });
  it('registers actual metadata-free masks, evaluates without replacement, and retains the previous good self on rejection', async () => {
    const {face, context, asset} = await fixtureRuntime();
    const registered = await face.register({asset});
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;
    const masked = await decodeWebRaster(storage.files.get(registered.selfPhoto.maskedFile)!);
    expect(Array.from(masked.rgba.slice((30 * w + 80) * 4, (30 * w + 80) * 4 + 4))).toEqual([127, 127, 127, 255]);
    const head = binaryPixels(await decodeWebRaster(storage.files.get(registered.selfPhoto.headMask)!));
    expect(head[30 * w + 80]).toBe(255);
    const gt = new Uint8Array(w * h); gt[30 * w + 80] = 255;
    storage.files.set('blob:gt', await encodeWebPng(w, h, gt, true));
    expect(await face.evaluateFixture({asset, expectedPerson: true, groundTruthHeadMask: 'blob:gt'})).toMatchObject({registrationOk: true, passed: true, metrics: {exposedHeadPixels: 0}});
    expect(storage.self).toEqual(registered.selfPhoto);
    context.setFixture('Segmenter.asset:self', {person: masks(noPerson()), taps: []});
    expect(await face.register({asset})).toMatchObject({ok: false, reason: 'person_not_found'});
    expect(await face.evaluateFixture({asset, expectedPerson: false, groundTruthHeadMask: null})).toMatchObject({registrationOk: false, passed: true});
    expect(storage.self).toEqual(registered.selfPhoto);
  });
  it('returns safe faceless output while uncalibrated, preserves provider bytes, and refuses unsafe outputs and stale self versions', async () => {
    const {face, context, asset} = await fixtureRuntime(), registered = await face.register({asset});
    if (!registered.ok) throw new Error('fixture failed');
    const before = new Uint8Array(await storage.files.get('blob:provider')!.arrayBuffer());
    const result = await face.compose({providerFile: 'blob:provider', selfUpdatedAt: registered.selfPhoto.updatedAt});
    expect(result).toMatchObject({ok: true, faceless: true, metrics: {passed: false, decision: 'not_calibrated'}});
    if (!result.ok) throw new Error('composition failed');
    expect((await decodeWebRaster(storage.files.get(result.file)!)).h).toBe(178);
    expect(new Uint8Array(await storage.files.get('blob:provider')!.arrayBuffer())).toEqual(before);
    expect(storage.retained).toBe(0);
    context.setFixture('Segmenter.asset:blob:provider', {person: masks(noPerson()), taps: []});
    expect(await face.compose({providerFile: 'blob:provider', selfUpdatedAt: registered.selfPhoto.updatedAt})).toMatchObject({ok: false, reason: 'unsafe_output', metrics: {decision: 'not_calibrated'}});
    expect(await face.compose({providerFile: 'blob:provider', selfUpdatedAt: 0})).toMatchObject({ok: false, reason: 'self_photo_changed'});
  });
  it.each([
    {matching: true, debug: true, restored: true},
    {matching: false, debug: true, restored: false},
    {matching: true, debug: false, restored: false},
    {matching: false, debug: false, restored: false},
  ])('gates provisional restoration by stored bytes and build: %j', async ({matching, debug, restored}) => {
    vi.stubEnv('DEV', debug);
    // A verification environment flag alone must never enable a production web build.
    vi.stubEnv('VITE_SF_VERIFICATION', '1');
    const {face, asset} = await fixtureRuntime(), registered = await face.register({asset});
    if (!registered.ok) throw new Error('fixture failed');
    const savedSelf = structuredClone(storage.self), sidecar = storage.sidecar;
    const originalBlob = storage.files.get(registered.selfPhoto.file)!;
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await originalBlob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
    const otherOriginal = await encodeWebPng(w, h, image([1, 2, 3, 255]).rgba);
    const otherDigest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await otherOriginal.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
    const evidence = 'e'.repeat(64), measured = measureComposition(image(), image([90, 140, 190, 255]), geometry(), geometry());
    Object.assign(testConfig, parseCompositionConfig({
      schemaVersion: 1, configVersion: `local-composition-provisional-${evidence}`, mode: 'a',
      compositionThresholds: {version: `provisional-${evidence.slice(0, 16)}`, maxBoundaryColorDeltaE: Math.max(measured.neckColorDeltaE95!, measured.shoulderColorDeltaE95!), maxBoundaryOffsetRatio: Math.max(measured.neckOffsetRatio95!, measured.shoulderOffsetRatio95!)},
      provenance: {kind: 'provisional-synthetic', sourceRun: 'runtime-unit-only', evidenceSha256: evidence, sourceImageSha256: matching ? digest : otherDigest, providerSamples: 1, humanApproved: false},
    }));
    storage.files.set('blob:old-result', await encodeWebPng(w, h, image([5, 6, 7, 255]).rgba));
    const before = new Map(storage.files);
    const result = await face.compose({providerFile: 'blob:provider', selfUpdatedAt: registered.selfPhoto.updatedAt});
    expect(result).toMatchObject({ok: true, faceless: !restored, metrics: {passed: restored, decision: restored ? 'composited' : 'not_calibrated', thresholdVersion: restored ? `provisional-${evidence.slice(0, 16)}` : null}});
    if (!result.ok) throw new Error('composition failed');
    expect((await decodeWebRaster(storage.files.get(result.file)!)).h).toBe(restored ? h : 178);
    expect(storage.self).toEqual(savedSelf);
    expect(storage.sidecar).toBe(sidecar);
    for (const [file, blob] of before) expect(storage.files.get(file)).toBe(blob);
    expect(storage.retained).toBe(0);
  });
  it('faceMaskNoNetworkOnSuccessFailureCancel has no fetch calls for success, injected cancellation, or retry', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const {face, context, asset} = await fixtureRuntime();
    await face.register({asset});
    context.setFailure('FaceMask.register', {code: 'cancelled', message: 'cancelled', retryable: false});
    await expect(face.register({asset})).rejects.toMatchObject({code: 'cancelled'});
    context.setFailure('FaceMask.register', undefined);
    await face.register({asset});
    expect(fetch).not.toHaveBeenCalled();
  });
});
