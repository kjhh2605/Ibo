import type {Asset, BBox, ComposeMetrics, FaceMask as FaceMaskContract, MaskFailure, MaskMetrics} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';
import {getMockContext} from './web/context';
import type {MockContext} from './web/context';
import {getWebRepository, readBlob, writeBlob} from '../data/web/repository';
import {binaryPixels, checkMlFailure, decodeWebRaster, encodeWebPng, getSegmenterFixture, maskBounds, mlError, sortedFixtureMasks} from './segmenter';
import type {WebMask, WebRaster} from './segmenter';

export type CompositionThresholds = {version: string; maxBoundaryColorDeltaE: number; maxBoundaryOffsetRatio: number};
export type FaceMaskConfig = {mode: 'a' | 'b' | 'c'; compositionThresholds: CompositionThresholds | null};
export const faceMaskConfig: FaceMaskConfig = {mode: 'a', compositionThresholds: null};
export type HeadGeometry = {w: number; h: number; person: Uint8Array; head: Uint8Array; bbox: BBox; headBox: BBox; neckY: number; left: number[]; right: number[]};
export type HeadDetection = {ok: true; geometry: HeadGeometry} | {ok: false; reason: MaskFailure};
type BoundaryValues = Pick<ComposeMetrics, 'neckColorDeltaE95' | 'shoulderColorDeltaE95' | 'neckOffsetRatio95' | 'shoulderOffsetRatio95'>;
type XY = [number, number];

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}

/** No class labels, filenames, GT, or expectedPerson enter silhouette acceptance. */
export function detectHead(pixels: Uint8Array, w: number, h: number): HeadDetection {
  maskBounds(pixels, w, h);
  const labels = new Int32Array(w * h);
  const queue = new Int32Array(w * h);
  const sizes = [0];
  let label = 0;
  for (let start = 0; start < pixels.length; start++) {
    if (!pixels[start] || labels[start]) continue;
    label++;
    let read = 0, write = 1;
    queue[0] = start; labels[start] = label;
    while (read < write) {
      const i = queue[read++], x = i % w;
      const neighbors = [x > 0 ? i - 1 : -1, x + 1 < w ? i + 1 : -1, i - w, i + w];
      for (const next of neighbors) if (next >= 0 && next < pixels.length && pixels[next] && !labels[next]) {
        labels[next] = label; queue[write++] = next;
      }
    }
    sizes.push(write);
  }
  const center = labels[Math.floor(h / 2) * w + Math.floor(w / 2)];
  if (!center || sizes[center] < w * h * 0.1) return {ok: false, reason: 'person_not_found'};
  if (sizes.some((size, id) => id !== center && id !== 0 && size >= sizes[center] * 0.25)) return {ok: false, reason: 'ambiguous_person'};
  const person = new Uint8Array(w * h), left = Array<number>(h).fill(w), right = Array<number>(h).fill(-1);
  for (let i = 0; i < pixels.length; i++) if (labels[i] === center) {
    person[i] = 255;
    const x = i % w, y = Math.floor(i / w);
    left[y] = Math.min(left[y], x); right[y] = Math.max(right[y], x);
  }
  const bbox = maskBounds(person, w, h), [x, top, width, height] = bbox;
  if (top <= 1) return {ok: false, reason: 'unsafe_boundary'};
  if (height < h * 0.45) return {ok: false, reason: 'person_not_found'};
  const bottom = top + height - 1;
  const widths = Array<number>(h).fill(0);
  for (let y = top; y <= bottom; y++) {
    const values: number[] = [];
    for (let row = Math.max(top, y - 2); row <= Math.min(bottom, y + 2); row++) values.push(right[row] - left[row] + 1);
    widths[y] = median(values);
  }
  let neckY = -1;
  for (let y = Math.ceil(top + height * 0.12); y <= Math.floor(top + height * 0.38); y++) {
    const aboveStart = Math.max(top, Math.ceil(y - height * 0.12)), aboveEnd = Math.floor(y - height * 0.04);
    const belowStart = Math.ceil(y + height * 0.04), belowEnd = Math.min(bottom, Math.floor(y + height * 0.15));
    if (aboveStart > aboveEnd || belowStart > belowEnd) continue;
    let headRow = aboveStart, shoulderRow = belowStart;
    for (let row = aboveStart; row <= aboveEnd; row++) if (widths[row] > widths[headRow]) headRow = row;
    for (let row = belowStart; row <= belowEnd; row++) if (widths[row] > widths[shoulderRow]) shoulderRow = row;
    const headCenter = (left[headRow] + right[headRow]) / 2, shoulderCenter = (left[shoulderRow] + right[shoulderRow]) / 2;
    if (widths[y] <= widths[headRow] * 0.85 && widths[y] <= widths[shoulderRow] * 0.75 && Math.abs(headCenter - shoulderCenter) <= width * 0.2 && (neckY < 0 || widths[y] < widths[neckY])) neckY = y;
  }
  if (neckY < 0) return {ok: false, reason: 'head_not_found'};
  let headLeft = x + width, headRight = x;
  for (let y = top; y <= neckY; y++) { headLeft = Math.min(headLeft, left[y]); headRight = Math.max(headRight, right[y]); }
  const marginX = Math.max(8, width * 0.08), marginY = Math.max(8, height * 0.04);
  const l = Math.floor(headLeft - marginX), t = Math.floor(top - marginY);
  const r = Math.ceil(headRight + marginX), b = Math.ceil(neckY + height * 0.02);
  if (l < 0 || t < 0 || r >= w || b >= h || (r - l + 1) * (b - t + 1) > w * h * 0.4) return {ok: false, reason: 'unsafe_boundary'};
  const head = new Uint8Array(w * h);
  for (let y = t; y <= b; y++) head.fill(255, y * w + l, y * w + r + 1);
  return {ok: true, geometry: {w, h, person, head, bbox, headBox: [l, t, r - l + 1, b - t + 1], neckY, left, right}};
}

export function detectFixtureHead(masks: WebMask[], w: number, h: number): HeadDetection {
  let failure: MaskFailure = 'person_not_found';
  const priority: Record<MaskFailure, number> = {person_not_found: 0, head_not_found: 1, ambiguous_person: 2, unsafe_boundary: 3};
  for (const mask of sortedFixtureMasks(masks, w, h)) {
    const result = detectHead(Uint8Array.from(mask.pixels), w, h);
    if (result.ok) return result;
    if (priority[result.reason] > priority[failure]) failure = result.reason;
  }
  return {ok: false, reason: failure};
}

export function decideComposition(values: BoundaryValues, thresholds: CompositionThresholds | null): ComposeMetrics {
  const calibrated = thresholds !== null && thresholds.version.trim().length > 0 && Number.isFinite(thresholds.maxBoundaryColorDeltaE) && thresholds.maxBoundaryColorDeltaE >= 0 && Number.isFinite(thresholds.maxBoundaryOffsetRatio) && thresholds.maxBoundaryOffsetRatio >= 0;
  const valid = Object.values(values).every(value => value !== null && Number.isFinite(value) && value >= 0);
  const passed = calibrated && valid && values.neckColorDeltaE95! <= thresholds.maxBoundaryColorDeltaE && values.shoulderColorDeltaE95! <= thresholds.maxBoundaryColorDeltaE && values.neckOffsetRatio95! <= thresholds.maxBoundaryOffsetRatio && values.shoulderOffsetRatio95! <= thresholds.maxBoundaryOffsetRatio;
  return {...values, thresholdVersion: calibrated ? thresholds.version : null, passed, decision: !calibrated ? 'not_calibrated' : !valid ? 'metrics_unavailable' : passed ? 'composited' : 'threshold_exceeded'};
}

export function maskRaster(source: WebRaster, geometry: HeadGeometry, mode: FaceMaskConfig['mode']): {image: WebRaster; cropOffset: number} {
  const cropOffset = mode === 'b' ? geometry.headBox[1] + geometry.headBox[3] : 0;
  const rgba = source.rgba.slice(cropOffset * source.w * 4);
  for (let i = 0; i < source.w * (source.h - cropOffset); i++) {
    const original = i + cropOffset * source.w;
    if (geometry.head[original] || (mode === 'c' && !geometry.person[original])) rgba.set([127, 127, 127, 255], i * 4);
  }
  return {image: {w: source.w, h: source.h - cropOffset, rgba}, cropOffset};
}

export function privacyMetrics(geometry: HeadGeometry, mode: FaceMaskConfig['mode'], gt: Uint8Array | null): MaskMetrics {
  let count = 0, exposed = 0, headCount = 0;
  if (gt && gt.length !== geometry.w * geometry.h) mlError('invalid_argument');
  const crop = mode === 'b' ? geometry.headBox[1] + geometry.headBox[3] : 0;
  for (let i = 0; i < geometry.head.length; i++) {
    if (geometry.head[i]) headCount++;
    if (gt?.[i]) {
      count++;
      if (Math.floor(i / geometry.w) >= crop && !geometry.head[i] && !(mode === 'c' && !geometry.person[i])) exposed++;
    }
  }
  if (gt && count === 0) mlError('invalid_argument');
  return {personAccepted: true, headAreaRatio: headCount / geometry.head.length, gtHeadPixels: gt ? count : null, exposedHeadPixels: gt ? exposed : null, privacyPassed: gt ? exposed === 0 : null};
}

function resamplePath(points: XY[], count = 64): XY[] {
  if (points.length < 2) return [];
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = lengths[lengths.length - 1];
  if (!total) return [];
  const output: XY[] = [];
  let segment = 1;
  for (let i = 0; i < count; i++) {
    const distance = total * i / (count - 1);
    while (segment < lengths.length - 1 && lengths[segment] < distance) segment++;
    const ratio = (distance - lengths[segment - 1]) / (lengths[segment] - lengths[segment - 1]);
    output.push([points[segment - 1][0] + ratio * (points[segment][0] - points[segment - 1][0]), points[segment - 1][1] + ratio * (points[segment][1] - points[segment - 1][1])]);
  }
  return output;
}

function boundaries(geometry: HeadGeometry, width: number, height: number): {neck: XY[]; shoulder: XY[]} {
  const sx = width / geometry.w, sy = height / geometry.h;
  const neck = resamplePath([[geometry.left[geometry.neckY] * sx, geometry.neckY * sy], [geometry.right[geometry.neckY] * sx, geometry.neckY * sy]]);
  const start = Math.ceil(geometry.neckY + geometry.bbox[3] * 0.04), end = Math.floor(geometry.neckY + geometry.bbox[3] * 0.15);
  const left: XY[] = [], right: XY[] = [];
  for (let y = start; y <= end && y < geometry.h; y++) {
    if (geometry.right[y] < geometry.left[y]) return {neck, shoulder: []};
    left.push([geometry.left[y] * sx, y * sy]); right.push([geometry.right[y] * sx, y * sy]);
  }
  return {neck, shoulder: [...resamplePath(left, 32), ...resamplePath(right, 32)]};
}

function percentile95(values: number[]): number | null {
  if (!values.length || values.some(value => !Number.isFinite(value))) return null;
  values.sort((a, b) => a - b);
  return values[Math.ceil(values.length * 0.95) - 1];
}

function lab(rgb: number[]): number[] {
  const [r, g, b] = rgb.map(value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const xyz = [(r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047, r * 0.2126729 + g * 0.7151522 + b * 0.072175, (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883].map(value => value > (6 / 29) ** 3 ? Math.cbrt(value) : value / (3 * (6 / 29) ** 2) + 4 / 29);
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}

function band(image: WebRaster, point: XY, normal: XY, sign: number): number[] | null {
  const channels: number[][] = [[], [], []];
  for (let distance = 1; distance <= 3; distance++) {
    const x = Math.round(point[0] + normal[0] * distance * sign), y = Math.round(point[1] + normal[1] * distance * sign);
    if (x < 0 || x >= image.w || y < 0 || y >= image.h || image.rgba[(y * image.w + x) * 4 + 3] !== 255) return null;
    for (let channel = 0; channel < 3; channel++) channels[channel].push(image.rgba[(y * image.w + x) * 4 + channel]);
  }
  return lab(channels.map(values => median(values)));
}

/** Metrics are measured before feathering, in original-canvas coordinates. */
export function measureComposition(source: WebRaster, provider: WebRaster, original: HeadGeometry, generated: HeadGeometry, cropOffset = 0): BoundaryValues {
  const a = boundaries(original, source.w, source.h), b = boundaries(generated, source.w, source.h - cropOffset);
  for (const point of [...b.neck, ...b.shoulder]) point[1] += cropOffset;
  function measure(first: XY[], second: XY[], shoulder: boolean): {color: number | null; offset: number | null} {
    if (first.length !== 64 || second.length !== 64) return {color: null, offset: null};
    const distances: number[] = [], colors: number[] = [];
    for (const [from, to] of [[first, second], [second, first]]) for (const point of from) distances.push(Math.min(...to.map(other => Math.hypot(point[0] - other[0], point[1] - other[1]))) / Math.hypot(source.w, source.h));
    for (let i = 0; i < first.length; i++) {
      const start = shoulder && i >= 32 ? 32 : 0, end = shoulder && i < 32 ? 31 : 63;
      const previous = first[Math.max(start, i - 1)], next = first[Math.min(end, i + 1)];
      const dx = next[0] - previous[0], dy = next[1] - previous[1], length = Math.hypot(dx, dy);
      if (!length) return {color: null, offset: percentile95(distances)};
      const normal: XY = [-dy / length, dx / length];
      const sourceColor = band(source, first[i], normal, -1);
      const providerPoint: XY = [second[i][0] * provider.w / source.w, (second[i][1] - cropOffset) * provider.h / (source.h - cropOffset)];
      const providerNormal: XY = [normal[0] * provider.w / source.w, normal[1] * provider.h / (source.h - cropOffset)];
      const providerColor = band(provider, providerPoint, providerNormal, 1);
      if (!sourceColor || !providerColor) return {color: null, offset: percentile95(distances)};
      colors.push(Math.hypot(...sourceColor.map((value, channel) => value - providerColor[channel])));
    }
    return {color: percentile95(colors), offset: percentile95(distances)};
  }
  const neck = measure(a.neck, b.neck, false), shoulder = measure(a.shoulder, b.shoulder, true);
  return {neckColorDeltaE95: neck.color, shoulderColorDeltaE95: shoulder.color, neckOffsetRatio95: neck.offset, shoulderOffsetRatio95: shoulder.offset};
}

function scaleRaster(image: WebRaster, w: number, h: number): WebRaster {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = Math.max(0, Math.min(image.w - 1, (x + 0.5) * image.w / w - 0.5)), sy = Math.max(0, Math.min(image.h - 1, (y + 0.5) * image.h / h - 0.5));
    const left = Math.floor(sx), top = Math.floor(sy), right = Math.min(image.w - 1, left + 1), bottom = Math.min(image.h - 1, top + 1);
    const fx = sx - left, fy = sy - top;
    for (let c = 0; c < 4; c++) rgba[(y * w + x) * 4 + c] = image.rgba[(top * image.w + left) * 4 + c] * (1 - fx) * (1 - fy) + image.rgba[(top * image.w + right) * 4 + c] * fx * (1 - fy) + image.rgba[(bottom * image.w + left) * 4 + c] * (1 - fx) * fy + image.rgba[(bottom * image.w + right) * 4 + c] * fx * fy;
  }
  return {w, h, rgba};
}

export function composeRaster(source: WebRaster, provider: WebRaster, original: HeadGeometry, generated: HeadGeometry, passed: boolean, cropOffset = 0): WebRaster {
  if (!passed) {
    const crop = generated.headBox[1] + generated.headBox[3];
    if (crop >= provider.h) mlError('unsafe_output');
    return {w: provider.w, h: provider.h - crop, rgba: provider.rgba.slice(crop * provider.w * 4)};
  }
  const bodyHeight = source.h - cropOffset;
  const scaled = scaleRaster(provider, source.w, bodyHeight);
  const output: WebRaster = {w: source.w, h: source.h, rgba: new Uint8ClampedArray(source.w * source.h * 4)};
  for (let i = 0; i < source.w * cropOffset; i++) output.rgba.set([127, 127, 127, 255], i * 4);
  output.rgba.set(scaled.rgba, source.w * cropOffset * 4);
  // Never let feathering reveal a generated face outside the original protected rectangle.
  const [gx, gy, gw, gh] = generated.headBox;
  for (let y = cropOffset + Math.floor(gy * bodyHeight / provider.h); y < cropOffset + Math.ceil((gy + gh) * bodyHeight / provider.h); y++) for (let x = Math.floor(gx * source.w / provider.w); x < Math.ceil((gx + gw) * source.w / provider.w); x++) output.rgba.set([127, 127, 127, 255], (y * source.w + x) * 4);
  const [left, top, width, height] = original.headBox;
  for (let y = top; y < top + height; y++) for (let x = left; x < left + width; x++) {
    const distance = Math.min(x - left, left + width - 1 - x, y - top, top + height - 1 - y);
    const alpha = Math.min(1, (distance + 1) / 2), at = (y * source.w + x) * 4;
    for (let c = 0; c < 3; c++) output.rgba[at + c] = source.rgba[at + c] * alpha + output.rgba[at + c] * (1 - alpha);
    output.rgba[at + 3] = 255;
  }
  return output;
}

export function createWebFaceMask(context?: MockContext): FaceMaskContract {
  const listeners = new Set<(event: {stage: 'segmenting' | 'masking' | 'compositing'}) => void>();
  let registration: Promise<unknown> = Promise.resolve();
  const current = () => context ?? getMockContext();
  function stage(value: 'segmenting' | 'masking' | 'compositing'): void {
    for (const listener of listeners) listener({stage: value});
  }
  function config(ctx: MockContext): FaceMaskConfig {
    const value = ctx.fixture<FaceMaskConfig>('FaceMask.config') ?? faceMaskConfig;
    if (!['a', 'b', 'c'].includes(value.mode)) mlError('invalid_argument');
    return value;
  }
  async function core(asset: Asset, ctx: MockContext) {
    const image = await decodeWebRaster(await readBlob(asset.file));
    if (image.w !== asset.w || image.h !== asset.h) mlError('inference_failed');
    const fixture = getSegmenterFixture(ctx, asset);
    return {image, detection: detectFixtureHead(fixture.person, image.w, image.h)};
  }
  const emptyMask: MaskMetrics = {personAccepted: false, headAreaRatio: null, gtHeadPixels: null, exposedHeadPixels: null, privacyPassed: null};
  const emptyBoundaries: BoundaryValues = {neckColorDeltaE95: null, shoulderColorDeltaE95: null, neckOffsetRatio95: null, shoulderOffsetRatio95: null};
  return {
    async addListener(_name, listener) { listeners.add(listener); return {async remove() { listeners.delete(listener); }}; },
    register({asset}) {
      const ctx = current();
      const operation = registration.then(async () => {
        checkMlFailure(ctx, 'FaceMask.register');
        const settings = config(ctx), repository = getWebRepository(), files: string[] = [];
        stage('segmenting');
        const {image, detection} = await core(asset, ctx);
        if (!detection.ok) return {ok: false as const, reason: detection.reason, metrics: {...emptyMask}};
        stage('masking');
        const {geometry} = detection;
        const {image: masked, cropOffset} = maskRaster(image, geometry, settings.mode);
        try {
          const file = await writeBlob(await encodeWebPng(image.w, image.h, image.rgba), 'self-original'); files.push(file);
          const headMask = await writeBlob(await encodeWebPng(image.w, image.h, geometry.head, true), 'self-head-mask'); files.push(headMask);
          const maskedFile = await writeBlob(await encodeWebPng(masked.w, masked.h, masked.rgba), 'self-masked'); files.push(maskedFile);
          const sidecar = await writeBlob(new Blob([JSON.stringify({mode: settings.mode, cropOffset, w: image.w, h: image.h, person: Array.from(geometry.person)})], {type: 'application/json'}), 'self-sidecar'); files.push(sidecar);
          const previous = await repository.getSelfPhoto();
          const updatedAt = Math.max(ctx.clock.now(), (previous?.updatedAt ?? -1) + 1);
          const selfPhoto = await repository.replaceSelfPhoto({selfPhoto: {file, headMask, maskedFile, updatedAt}, sidecar});
          return {ok: true as const, selfPhoto, metrics: privacyMetrics(geometry, settings.mode, null)};
        } catch (error) {
          await Promise.all(files.map(file => repository.discardTemp({file})));
          throw error;
        }
      });
      registration = operation.catch(() => undefined);
      return operation;
    },
    async evaluateFixture({asset, expectedPerson, groundTruthHeadMask}) {
      const ctx = current();
      checkMlFailure(ctx, 'FaceMask.evaluateFixture');
      if (expectedPerson ? groundTruthHeadMask === null : groundTruthHeadMask !== null) mlError('invalid_argument');
      let gt: Uint8Array | null = null;
      if (groundTruthHeadMask !== null) {
        const raster = await decodeWebRaster(await readBlob(groundTruthHeadMask));
        if (raster.w !== asset.w || raster.h !== asset.h) mlError('invalid_argument');
        gt = binaryPixels(raster);
        if (!gt.some(value => value === 255)) mlError('invalid_argument');
      }
      const settings = config(ctx), {image, detection} = await core(asset, ctx);
      if (!detection.ok) return {registrationOk: false, reason: detection.reason, metrics: {...emptyMask, gtHeadPixels: gt ? gt.reduce((sum, value) => sum + (value ? 1 : 0), 0) : null}, passed: !expectedPerson};
      const {image: masked} = maskRaster(image, detection.geometry, settings.mode);
      // Exercise the same metadata-free transform as register without mutating the singleton or storing temporary files.
      await encodeWebPng(masked.w, masked.h, masked.rgba);
      const metrics = privacyMetrics(detection.geometry, settings.mode, gt);
      return {registrationOk: true, reason: null, metrics, passed: expectedPerson && metrics.privacyPassed === true};
    },
    async compose({providerFile, selfUpdatedAt}) {
      const ctx = current();
      checkMlFailure(ctx, 'FaceMask.compose');
      const settings = config(ctx), repository = getWebRepository();
      let metrics = decideComposition(emptyBoundaries, settings.compositionThresholds);
      let retained = false;
      try {
        let self;
        try { self = await repository.retainSelf({updatedAt: selfUpdatedAt}); retained = true; }
        catch (error) {
          if (error && typeof error === 'object' && 'code' in error && ['self_photo_changed', 'invalid_reference'].includes(String(error.code))) return {ok: false, reason: 'self_photo_changed', metrics};
          throw error;
        }
        stage('compositing');
        const sidecarFile = await repository.getSelfSidecar({updatedAt: selfUpdatedAt});
        if (!sidecarFile) mlError('io_error');
        const sidecar: {mode: 'a' | 'b' | 'c'; cropOffset: number; w: number; h: number; person: number[]} = JSON.parse(await (await readBlob(sidecarFile)).text());
        if (!sidecar || !['a', 'b', 'c'].includes(sidecar.mode) || !Array.isArray(sidecar.person) || !Number.isSafeInteger(sidecar.w) || !Number.isSafeInteger(sidecar.h) || sidecar.person.length !== sidecar.w * sidecar.h || sidecar.person.some(value => value !== 0 && value !== 255)) mlError('io_error');
        const source = await decodeWebRaster(await readBlob(self.file));
        if (source.w !== sidecar.w || source.h !== sidecar.h) mlError('io_error');
        const original = detectHead(Uint8Array.from(sidecar.person), source.w, source.h);
        if (!original.ok) mlError('io_error');
        const provider = await decodeWebRaster(await readBlob(providerFile));
        const fixture = getSegmenterFixture(ctx, {id: providerFile, file: providerFile, w: provider.w, h: provider.h});
        const generated = detectFixtureHead(fixture.person, provider.w, provider.h);
        if (!generated.ok) return {ok: false, reason: 'unsafe_output', metrics};
        const cropOffset = sidecar.mode === 'b' ? original.geometry.headBox[1] + original.geometry.headBox[3] : 0;
        if (sidecar.cropOffset !== cropOffset) mlError('io_error');
        metrics = decideComposition(measureComposition(source, provider, original.geometry, generated.geometry, cropOffset), settings.compositionThresholds);
        const output = composeRaster(source, provider, original.geometry, generated.geometry, metrics.passed, cropOffset);
        const file = await writeBlob(await encodeWebPng(output.w, output.h, output.rgba), 'composed');
        return {ok: true, file, faceless: !metrics.passed, metrics};
      } finally { if (retained) await repository.releaseSelf({updatedAt: selfUpdatedAt}); }
    },
  };
}

export const FaceMask = registerDevicePlugin<FaceMaskContract>('FaceMask', async () => createWebFaceMask());
