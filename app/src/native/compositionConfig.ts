import bundledConfig from '../../config/local-composition.json?raw';

export type CompositionThresholds = Readonly<{version: string; maxBoundaryColorDeltaE: number; maxBoundaryOffsetRatio: number}>;
export type ReviewedCompositionProvenance = Readonly<{
  sourceRun: string; completionRun: string; planSha256: string; callsSha256: string; evidenceSha256: string;
  calibrationReviewSha256: string; finalHumanReviewSha256: string;
  providerCalls: 16; frozenBeforeCall: 13; heldOutReplayed: 2; humanApproved: true;
}>;
export type ProvisionalCompositionProvenance = Readonly<{
  kind: 'provisional-synthetic'; sourceRun: string; evidenceSha256: string; sourceImageSha256: string;
  providerSamples: number; humanApproved: false;
}>;
export type CompositionProvenance = ReviewedCompositionProvenance | ProvisionalCompositionProvenance;
export type FaceMaskConfig = Readonly<{schemaVersion: 1; configVersion: string; mode: 'a' | 'b' | 'c'; compositionThresholds: CompositionThresholds | null; provenance: CompositionProvenance | null}>;
const hash = /^[a-f0-9]{64}$/;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_composition_config');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, expected: string[]): void {
  if (Object.keys(value).sort().join(',') !== expected.sort().join(',')) throw new Error('invalid_composition_config');
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function finite(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
/** Only the checked-in bundled asset controls calibration; provisional use is additionally source/build gated. */
export function parseCompositionConfig(input: unknown): FaceMaskConfig {
  const value = object(input);
  keys(value, ['schemaVersion', 'configVersion', 'mode', 'compositionThresholds', 'provenance']);
  if (value.schemaVersion !== 1 || !text(value.configVersion) || value.mode !== 'a') throw new Error('invalid_composition_config');
  if (value.compositionThresholds === null) {
    if (value.provenance !== null || value.configVersion !== 'local-composition-uncalibrated-v1') throw new Error('invalid_composition_config');
    return Object.freeze({...value}) as FaceMaskConfig;
  }
  const thresholds = object(value.compositionThresholds), proof = object(value.provenance);
  keys(thresholds, ['version', 'maxBoundaryColorDeltaE', 'maxBoundaryOffsetRatio']);
  if (!text(thresholds.version) || !finite(thresholds.maxBoundaryColorDeltaE) || !finite(thresholds.maxBoundaryOffsetRatio)) throw new Error('invalid_composition_config');
  if (proof.kind === 'provisional-synthetic') {
    keys(proof, ['kind', 'sourceRun', 'evidenceSha256', 'sourceImageSha256', 'providerSamples', 'humanApproved']);
    if (!text(proof.sourceRun) || !Number.isSafeInteger(proof.providerSamples) || (proof.providerSamples as number) <= 0 || proof.humanApproved !== false
      || !['evidenceSha256', 'sourceImageSha256'].every(key => typeof proof[key] === 'string' && hash.test(proof[key]))
      || value.configVersion !== `local-composition-provisional-${proof.evidenceSha256}`
      || thresholds.version !== `provisional-${(proof.evidenceSha256 as string).slice(0, 16)}`) throw new Error('invalid_composition_config');
  } else {
    keys(proof, ['sourceRun', 'completionRun', 'planSha256', 'callsSha256', 'evidenceSha256', 'calibrationReviewSha256', 'finalHumanReviewSha256', 'providerCalls', 'frozenBeforeCall', 'heldOutReplayed', 'humanApproved']);
    if (!text(proof.sourceRun) || !text(proof.completionRun) || proof.providerCalls !== 16 || proof.frozenBeforeCall !== 13 || proof.heldOutReplayed !== 2 || proof.humanApproved !== true
      || !['planSha256', 'callsSha256', 'evidenceSha256', 'calibrationReviewSha256', 'finalHumanReviewSha256'].every(key => typeof proof[key] === 'string' && hash.test(proof[key]))
      || value.configVersion !== `local-composition-${proof.evidenceSha256}`) throw new Error('invalid_composition_config');
  }
  return Object.freeze({...value, compositionThresholds: Object.freeze({...thresholds}), provenance: Object.freeze({...proof})}) as FaceMaskConfig;
}
/** The digest must describe the stored original bytes, not an import, ID, filename or decoded pixels. */
export function selectCompositionThresholds(config: FaceMaskConfig, sourceImageSha256: string | null, verificationBuild: boolean): CompositionThresholds | null {
  const proof = config.provenance;
  if (proof && 'kind' in proof && proof.kind === 'provisional-synthetic') {
    return verificationBuild && sourceImageSha256 === proof.sourceImageSha256 ? config.compositionThresholds : null;
  }
  return config.compositionThresholds;
}
export const localCompositionConfig = parseCompositionConfig(JSON.parse(bundledConfig));
