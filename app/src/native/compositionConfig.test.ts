import {describe, expect, it} from 'vitest';
import {parseCompositionConfig, selectCompositionThresholds} from './compositionConfig';

const disabled = {schemaVersion: 1, configVersion: 'local-composition-uncalibrated-v1', mode: 'a', compositionThresholds: null, provenance: null};
// Parser-only schema sample, never written to the production asset or used as calibration evidence.
function parserSample() {
  const hash = 'a'.repeat(64);
  return {schemaVersion: 1, configVersion: `local-composition-${hash}`, mode: 'a', compositionThresholds: {version: 'parser-unit-only', maxBoundaryColorDeltaE: 0, maxBoundaryOffsetRatio: 0}, provenance: {sourceRun: 'parser-unit-only', completionRun: 'parser-unit-only', planSha256: hash, callsSha256: hash, evidenceSha256: hash, calibrationReviewSha256: hash, finalHumanReviewSha256: hash, providerCalls: 16, frozenBeforeCall: 13, heldOutReplayed: 2, humanApproved: true}};
}
function provisionalSample() {
  const evidence = 'b'.repeat(64);
  return {schemaVersion: 1, configVersion: `local-composition-provisional-${evidence}`, mode: 'a', compositionThresholds: {version: `provisional-${evidence.slice(0, 16)}`, maxBoundaryColorDeltaE: 0, maxBoundaryOffsetRatio: 0}, provenance: {kind: 'provisional-synthetic', sourceRun: 'parser-unit-only', evidenceSha256: evidence, sourceImageSha256: 'c'.repeat(64), providerSamples: 2, humanApproved: false}};
}
describe('bundled local composition configuration', () => {
  it.each([
    {...disabled, schemaVersion: 2}, {...disabled, mode: 'b'}, {...disabled, configVersion: 'unknown'},
    {...disabled, debugThreshold: 100}, {...disabled, provenance: {}},
    {...parserSample(), provenance: null}, {...parserSample(), configVersion: 'stale'},
    {...parserSample(), compositionThresholds: {...parserSample().compositionThresholds, maxBoundaryColorDeltaE: Infinity}},
    {...parserSample(), compositionThresholds: {...parserSample().compositionThresholds, maxBoundaryOffsetRatio: -1}},
    {...parserSample(), provenance: {...parserSample().provenance, humanApproved: false}},
    {...parserSample(), provenance: {...parserSample().provenance, providerCalls: 12}},
    {...parserSample(), provenance: {...parserSample().provenance, evidenceSha256: 'not-a-sha'}},
    {...provisionalSample(), configVersion: 'stale'},
    {...provisionalSample(), compositionThresholds: {...provisionalSample().compositionThresholds, version: 'unbound'}},
    ...[true, null, 'false'].map(humanApproved => ({...provisionalSample(), provenance: {...provisionalSample().provenance, humanApproved}})),
    ...[0, -1, 1.5, Infinity, '2', Number.MAX_SAFE_INTEGER + 1].map(providerSamples => ({...provisionalSample(), provenance: {...provisionalSample().provenance, providerSamples}})),
    ...['', 'A'.repeat(64), 'not-a-sha'].map(sourceImageSha256 => ({...provisionalSample(), provenance: {...provisionalSample().provenance, sourceImageSha256}})),
    {...provisionalSample(), provenance: {...provisionalSample().provenance, kind: 'reviewed'}},
    {...provisionalSample(), provenance: {...provisionalSample().provenance, humanReview: true}},
  ])('fails closed for malformed or unbound configuration %#', value => {
    expect(() => parseCompositionConfig(value)).toThrow('invalid_composition_config');
  });
  it('keeps the genuine reviewed schema and its production eligibility unchanged', () => {
    const config = parseCompositionConfig(parserSample());
    expect(config.provenance?.humanApproved).toBe(true);
    expect(selectCompositionThresholds(config, null, false)).toBe(config.compositionThresholds);
  });
  it('enables provisional thresholds only for the exact stored source digest in a verification build', () => {
    const sample = provisionalSample(), config = parseCompositionConfig(sample);
    expect(config.provenance).toEqual(sample.provenance);
    expect(selectCompositionThresholds(config, sample.provenance.sourceImageSha256, true)).toBe(config.compositionThresholds);
    expect(selectCompositionThresholds(config, sample.provenance.sourceImageSha256, false)).toBeNull();
    expect(selectCompositionThresholds(config, 'd'.repeat(64), true)).toBeNull();
    expect(selectCompositionThresholds(config, null, true)).toBeNull();
    expect(selectCompositionThresholds(parseCompositionConfig(disabled), null, true)).toBeNull();
  });
});
