#!/usr/bin/env python3
"""Promote formal human-reviewed evidence or explicitly provisional synthetic evidence."""
from __future__ import annotations
import argparse
import hashlib
from datetime import datetime
import json
import math
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
METRICS = ('neckColorDeltaE95', 'shoulderColorDeltaE95', 'neckOffsetRatio95', 'shoulderOffsetRatio95')
HASH = re.compile(r'[a-f0-9]{64}\Z')
RUN = re.compile(r'[A-Za-z0-9][A-Za-z0-9._-]*\Z')

def require(value, reason):
    if not value:
        raise ValueError(reason)

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()

def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()

def load(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'duplicate_json_key')
            result[key] = value
        return result
    return json.loads(path.read_text(), object_pairs_hook=unique, parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite_json')))

def valid_metrics(value):
    return isinstance(value, dict) and all(type(value.get(k)) in (int, float) and math.isfinite(value[k]) and value[k] >= 0 for k in METRICS)

def decision(metrics, thresholds):
    if not valid_metrics(metrics):
        return 'metrics_unavailable'
    return 'composited' if all(metrics[k] <= thresholds['maxBoundaryColorDeltaE'] for k in METRICS[:2]) and all(metrics[k] <= thresholds['maxBoundaryOffsetRatio'] for k in METRICS[2:]) else 'threshold_exceeded'

def review(value, source_run, rows):
    require(value.get('humanAttestation') is True and value.get('reviewer') and value.get('reviewedAt') and value.get('sourceRun') == source_run, 'human_review_not_bound_to_run')
    require(set(value.get('outputs', {})) == {row['id'] for row in rows}, 'human_review_coverage_incomplete')
    for row in rows:
        label = value['outputs'][row['id']]
        require(label.get('providerSha256') == row['providerSha256'] and type(label.get('acceptableComposition')) is bool, 'human_review_stale_or_not_boolean')
        if row.get('previewAvailable') is True:
            require(label.get('previewSha256') == row.get('previewSha256'), 'human_review_preview_stale')
        if label['acceptableComposition']:
            require(row.get('previewAvailable') is True and row.get('evaluation', {}).get('compositionEligible') is True, 'accepted_output_has_no_safe_composed_preview')

def validate_evidence(evidence, plan, plan_sha256, head_review_sha256, cache):
    """Pure validation plus immutable local provider-cache hashes; never writes configuration."""
    require(evidence.get('schemaVersion') == 1, 'unsupported_evidence_schema')
    require(evidence.get('planSha256') == plan_sha256 and evidence.get('headReviewSha256') == head_review_sha256, 'frozen_inputs_changed')
    context = evidence.get('context', {})
    require(context.get('headReviewSha256') == head_review_sha256, 'context_head_review_changed')
    sources, assets = context.get('sources', {}), context.get('assets', {})
    required_sources = {'scripts/e2e/quality.py', 'scripts/e2e/instrumentation.py', 'scripts/e2e/android-src/com/streetfitting/verification/NativeVerificationTest.java', 'relay/app/routes/tryon.py', 'relay/app/meta_client.py'}
    required_sources.update('app/android/app/src/main/java/com/streetfitting/app/plugins/facemask/' + name + '.java' for name in ('BoundaryMetrics', 'FaceMaskCore', 'HeadGeometry'))
    require(required_sources <= set(sources) and assets, 'measurement_source_provenance_incomplete')
    for mapping, root in ((sources, ROOT), (assets, ROOT / 'verification/fixtures')):
        for relative, sha in mapping.items():
            require(isinstance(relative, str) and not Path(relative).is_absolute() and '..' not in Path(relative).parts, 'invalid_bound_path')
            path = root / relative
            require(isinstance(sha, str) and HASH.fullmatch(sha) and path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == sha, 'measurement_source_or_asset_changed')
    require(all(isinstance(evidence.get(k), str) and RUN.fullmatch(evidence[k]) for k in ('sourceRun', 'completionRun')), 'invalid_source_run')
    calibration, held_out = plan['calibration'], plan['heldOut']
    require(len(calibration) == len(held_out) == 2 and len(set(calibration + held_out)) == 4, 'invalid_frozen_split')
    rows = evidence.get('calls', [])
    require(len(rows) == 16 and [r.get('id') for r in rows] == [f'call-{n:02}' for n in range(1, 17)], 'full_16_calls_required')
    require(evidence.get('callsSha256') == digest(rows), 'calls_digest_changed')
    expected = [(case, mode, reasoning, 'calibration') for case in calibration for mode in ('a', 'b', 'c') for reasoning in ('low', 'high')]
    freeze = evidence.get('freeze', {})
    require(freeze.get('best') == {'mode': 'a', 'reasoning': 'low'}, 'winner_does_not_match_production_a_low')
    expected += [(case, 'a', 'low', 'best-repeat') for case in held_out + calibration[:1]] + [(calibration[0], 'a', 'low', 'top-only')]
    for row, combination in zip(rows, expected):
        require(tuple(row.get(k) for k in ('case', 'maskMode', 'reasoning', 'kind')) == combination, 'call_plan_changed')
        require(row.get('status') == 'passed' and row.get('statusCode') == 200 and row.get('maskExposure') == 0, 'provider_or_privacy_gate_failed')
        sha, run = row.get('providerSha256', ''), row.get('localCacheRun', '')
        require(isinstance(sha, str) and HASH.fullmatch(sha) and isinstance(run, str) and RUN.fullmatch(run), 'invalid_provider_provenance')
        provider = cache / run / (sha + '.png')
        require(provider.is_file() and hashlib.sha256(provider.read_bytes()).hexdigest() == sha, 'provider_cache_missing_or_changed')
        require(type(row.get('providerBytes')) is int and provider.stat().st_size == row['providerBytes'], 'provider_size_changed')
        if row.get('previewAvailable') is True:
            preview_sha, preview_run = row.get('previewSha256', ''), row.get('previewCacheRun', '')
            require(isinstance(preview_sha, str) and HASH.fullmatch(preview_sha) and isinstance(preview_run, str) and RUN.fullmatch(preview_run), 'invalid_composed_preview_provenance')
            preview = cache / preview_run / (preview_sha + '.png')
            require(preview.is_file() and hashlib.sha256(preview.read_bytes()).hexdigest() == preview_sha and type(row.get('previewBytes')) is int and preview.stat().st_size == row['previewBytes'], 'composed_preview_missing_or_changed')
    calibration_review, final_review = evidence.get('calibrationReview', {}), evidence.get('finalHumanReview', {})
    review(calibration_review, evidence['sourceRun'], rows[:12])
    review(final_review, evidence['sourceRun'], rows[12:])
    require(final_review.get('callsSha256') == digest(rows), 'final_review_not_bound_to_all_16_calls')
    require(freeze.get('frozenBeforeCall') == 13 and freeze.get('calibrationCallsSha256') == digest(rows[:12]) and freeze.get('calibrationReviewSha256') == digest(calibration_review), 'threshold_freeze_missing_or_changed')
    require(calibration_review.get('best') == freeze['best'], 'reviewed_winner_changed')
    thresholds = evidence.get('thresholds', {})
    require(set(thresholds) == {'version', 'maxBoundaryColorDeltaE', 'maxBoundaryOffsetRatio'} and thresholds == freeze.get('thresholds'), 'frozen_thresholds_changed')
    maxima = {key: thresholds[key] for key in ('maxBoundaryColorDeltaE', 'maxBoundaryOffsetRatio')}
    require(all(type(value) in (int, float) and math.isfinite(value) and value >= 0 for value in maxima.values()), 'invalid_measured_thresholds')
    require(thresholds.get('version') == 's11-' + digest(maxima)[:16], 'threshold_version_not_bound_to_measured_fit')
    accepted = [r['evaluation']['metrics'] for r in rows[:12] if calibration_review['outputs'][r['id']]['acceptableComposition']]
    require(accepted and all(valid_metrics(m) for m in accepted), 'accepted_calibration_metrics_missing')
    require(thresholds['maxBoundaryColorDeltaE'] == max(m[k] for m in accepted for k in METRICS[:2]) and thresholds['maxBoundaryOffsetRatio'] == max(m[k] for m in accepted for k in METRICS[2:]), 'thresholds_not_measured_fit')
    require(all(calibration_review['outputs'][r['id']]['acceptableComposition'] for r in rows[:12] if r['maskMode'] == 'a' and r['reasoning'] == 'low'), 'production_pair_not_human_accepted')
    require(all(decision(r.get('evaluation', {}).get('metrics'), thresholds) != 'composited' for r in rows[:12] if not calibration_review['outputs'][r['id']]['acceptableComposition']), 'fitted_thresholds_accept_rejected_output')
    replay = evidence.get('nativeReplay', [])
    require(len(replay) == 16 and {r.get('call') for r in replay} == {r['id'] for r in rows}, 'native_replay_incomplete')
    replay_by_id = {r['call']: r for r in replay}
    for row in rows:
        replayed = replay_by_id[row['id']]
        evaluation = row.get('evaluation', {})
        expected_decision = decision(evaluation.get('metrics'), thresholds)
        require(replayed.get('identical') is True and replayed.get('providerSha256') == row['providerSha256'] and replayed.get('decision') == expected_decision, 'native_replay_not_reproducible')
    require(all(final_review['outputs'][r['id']]['acceptableComposition'] is True and replay_by_id[r['id']]['decision'] == 'composited' for r in rows[12:]), 'final_validation_not_accepted')
    held = evidence.get('heldOut', [])
    require(len(held) == 2 and {r.get('call') for r in held} == {'call-13', 'call-14'} and all(r.get('identical') is True and r.get('decision') == 'composited' for r in held), 'frozen_heldout_replay_failed')
    evidence_sha = digest(evidence)
    return {'schemaVersion': 1, 'configVersion': 'local-composition-' + evidence_sha, 'mode': 'a', 'compositionThresholds': thresholds, 'provenance': {'sourceRun': evidence['sourceRun'], 'completionRun': evidence['completionRun'], 'planSha256': plan_sha256, 'callsSha256': digest(rows), 'evidenceSha256': evidence_sha, 'calibrationReviewSha256': digest(calibration_review), 'finalHumanReviewSha256': digest(final_review), 'providerCalls': 16, 'frozenBeforeCall': 13, 'heldOutReplayed': 2, 'humanApproved': True}}

def cached_image(cache, run, sha, size, label):
    require(isinstance(run, str) and RUN.fullmatch(run) and isinstance(sha, str) and HASH.fullmatch(sha), 'invalid_' + label + '_provenance')
    require(type(size) is int and size > 0, 'invalid_' + label + '_size')
    path = cache / run / (sha + '.png')
    require(path.is_file() and path.stat().st_size == size and hashlib.sha256(path.read_bytes()).hexdigest() == sha, label + '_cache_missing_or_changed')
    return path

def utc_time(value):
    require(isinstance(value, str), 'invalid_evidence_timestamp')
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        raise ValueError('invalid_evidence_timestamp') from None
    require(parsed.tzinfo is not None and parsed.utcoffset().total_seconds() == 0, 'evidence_timestamp_must_be_utc')
    return parsed

def provisional_decision(evaluation, thresholds):
    if evaluation.get('ok') is not True or evaluation.get('compositionEligible') is not True:
        return 'unsafe_output'
    return decision(evaluation.get('metrics'), thresholds)

def validate_provisional(evidence, cache):
    """Validate synthetic-only measurements and a pre-validation freeze without human GT."""
    require(evidence.get('schemaVersion') == 1 and evidence.get('kind') == 'provisional-synthetic', 'unsupported_provisional_schema')
    require(evidence.get('syntheticOnly') is True and evidence.get('humanApproved') is False, 'provisional_must_be_synthetic_and_not_human_approved')
    require(evidence.get('humanAttestation') is not True and not any(k in evidence for k in ('calibrationReview', 'finalHumanReview')), 'provisional_cannot_claim_human_review')
    run = evidence.get('sourceRun')
    require(isinstance(run, str) and RUN.fullmatch(run), 'invalid_source_run')
    source = evidence.get('sourceImage', {})
    source_sha = source.get('sha256')
    cached_image(cache, source.get('cacheRun'), source_sha, source.get('bytes'), 'source_image')
    sources = evidence.get('context', {}).get('sources', {})
    required_sources = {'scripts/e2e/quality.py', 'scripts/e2e/instrumentation.py', 'scripts/e2e/android-src/com/streetfitting/verification/NativeVerificationTest.java', 'relay/app/routes/tryon.py', 'relay/app/meta_client.py'}
    required_sources.update('app/android/app/src/main/java/com/streetfitting/app/plugins/facemask/' + name + '.java' for name in ('BoundaryMetrics', 'FaceMaskCore', 'HeadGeometry'))
    require(isinstance(sources, dict) and required_sources <= set(sources), 'measurement_source_provenance_incomplete')
    for relative, sha in sources.items():
        require(isinstance(relative, str) and not Path(relative).is_absolute() and '..' not in Path(relative).parts, 'invalid_bound_path')
        path = ROOT / relative
        require(isinstance(sha, str) and HASH.fullmatch(sha) and path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == sha, 'measurement_source_or_asset_changed')
    fit, validation = evidence.get('fit'), evidence.get('validation')
    require(isinstance(fit, list) and len(fit) >= 2 and isinstance(validation, list) and validation and all(isinstance(r, dict) for r in fit + validation), 'provisional_fit_and_heldout_required')
    freeze = evidence.get('freeze', {})
    freeze_sha = digest(freeze)
    require(evidence.get('freezeSha256') == freeze_sha, 'provisional_freeze_digest_changed')
    require(freeze.get('sourceRun') == run and freeze.get('sourceImageSha256') == source_sha and freeze.get('fitSha256') == digest(fit), 'provisional_freeze_inputs_changed')
    relative = evidence.get('freezeFile')
    require(isinstance(relative, str) and not Path(relative).is_absolute() and '..' not in Path(relative).parts, 'invalid_freeze_file')
    freeze_path = ROOT / relative
    require(freeze_path.resolve().is_relative_to((ROOT / 'verification/results').resolve()) and freeze_path.is_file(), 'freeze_file_must_be_in_verification_results')
    require(load(freeze_path) == freeze, 'immutable_freeze_file_changed')
    frozen_at = utc_time(freeze.get('frozenAt'))
    thresholds = freeze.get('thresholds', {})
    require(set(thresholds) == {'maxBoundaryColorDeltaE', 'maxBoundaryOffsetRatio'} and all(type(v) in (int, float) and math.isfinite(v) and v >= 0 for v in thresholds.values()), 'invalid_measured_thresholds')
    ids, provider_hashes, accepted = set(), set(), []
    rejected = 0
    fit_providers = {r.get('providerSha256') for r in fit}
    for held_out, rows in ((False, fit), (True, validation)):
        for row in rows:
            sample_id = row.get('id')
            require(isinstance(sample_id, str) and RUN.fullmatch(sample_id) and sample_id not in ids, 'duplicate_or_invalid_sample_id')
            ids.add(sample_id)
            require(row.get('sourceImageSha256') == source_sha, 'sample_source_image_changed')
            require(row.get('status') == 'passed' and row.get('statusCode') == 200 and row.get('maskMode') == 'a' and row.get('reasoning') == 'low', 'provider_or_privacy_gate_failed')
            mask_check = row.get('maskCheck', {})
            require(isinstance(mask_check, dict) and set(mask_check) == {'kind', 'protectedPixelsOpaque'} and mask_check.get('kind') == 'native-auto-mask' and mask_check.get('protectedPixelsOpaque') is True and 'maskExposure' not in row, 'automatic_mask_check_required_not_human_gt')
            cached_image(cache, row.get('localCacheRun'), row.get('providerSha256'), row.get('providerBytes'), 'provider')
            provider_hashes.add(row['providerSha256'])
            require(type(row.get('previewAvailable')) is bool, 'preview_availability_required')
            if row['previewAvailable']:
                cached_image(cache, row.get('previewCacheRun'), row.get('previewSha256'), row.get('previewBytes'), 'composed_preview')
            else:
                require(row.get('previewSha256') is None and row.get('previewBytes') is None, 'unavailable_preview_has_hash')
            evaluation = row.get('evaluation', {})
            require(isinstance(evaluation, dict) and row.get('metricsSha256') == digest(evaluation.get('metrics')), 'measurement_metrics_hash_changed')
            require(evaluation.get('previewWritten', False) is row['previewAvailable'], 'native_preview_availability_changed')
            label = row.get('review', {})
            require(label.get('kind') == 'assistant-visual' and label.get('humanApproved') is False and label.get('humanAttestation') is not True and isinstance(label.get('reviewer'), str) and label['reviewer'].strip(), 'assistant_review_must_not_claim_human_approval')
            require(label.get('providerSha256') == row['providerSha256'] and label.get('previewSha256') == row.get('previewSha256') and type(label.get('acceptableComposition')) is bool, 'assistant_review_stale_or_not_boolean')
            measured_at = utc_time(row.get('measuredAt'))
            reviewed_at = utc_time(label.get('reviewedAt'))
            require(reviewed_at >= measured_at, 'review_precedes_measurement')
            acceptable = label['acceptableComposition']
            predicted = provisional_decision(evaluation, thresholds)
            if acceptable:
                require(row['previewAvailable'] and evaluation.get('ok') is True and evaluation.get('compositionEligible') is True and valid_metrics(evaluation.get('metrics')), 'accepted_output_has_no_safe_composed_preview')
                require(predicted == 'composited', 'accepted_output_exceeds_frozen_thresholds')
            else:
                require(predicted != 'composited', 'fitted_thresholds_accept_rejected_output')
            if held_out:
                require(row['providerSha256'] not in fit_providers, 'validation_provider_not_held_out')
                require(measured_at > frozen_at and freeze_path.stat().st_mtime <= measured_at.timestamp(), 'validation_not_measured_after_freeze')
                require(row.get('freezeSha256') == freeze_sha and row.get('thresholds') == thresholds, 'validation_frozen_thresholds_changed')
                metrics = evaluation.get('metrics', {})
                require(acceptable and metrics.get('passed') is True and metrics.get('decision') == 'composited' and metrics.get('thresholdVersion') == 'provisional-fit-' + digest(thresholds)[:16], 'frozen_heldout_validation_failed')
            else:
                require(measured_at <= frozen_at and reviewed_at <= frozen_at and row.get('freezeSha256') is None and row.get('thresholds') is None, 'fit_not_complete_before_freeze')
                if acceptable:
                    accepted.append(evaluation['metrics'])
                else:
                    rejected += 1
    require(accepted and rejected, 'positive_fit_and_negative_reject_required')
    measured = {'maxBoundaryColorDeltaE': max(m[k] for m in accepted for k in METRICS[:2]), 'maxBoundaryOffsetRatio': max(m[k] for m in accepted for k in METRICS[2:])}
    require(thresholds == measured, 'thresholds_not_measured_fit')
    evidence_sha = digest(evidence)
    return {'schemaVersion': 1, 'configVersion': 'local-composition-provisional-' + evidence_sha, 'mode': 'a', 'compositionThresholds': {'version': 'provisional-' + evidence_sha[:16], **thresholds}, 'provenance': {'kind': 'provisional-synthetic', 'sourceRun': run, 'evidenceSha256': evidence_sha, 'sourceImageSha256': source_sha, 'providerSamples': len(provider_hashes), 'humanApproved': False}}

def install_config(config, destination):
    """Only called after every evidence check; replace on the destination filesystem."""
    temporary = destination.with_suffix('.json.tmp')
    try:
        temporary.write_text(json.dumps(config, indent=2, allow_nan=False) + '\n')
        temporary.replace(destination)
    finally:
        temporary.unlink(missing_ok=True)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', type=Path, required=True, help='Completed native evidence JSON')
    parser.add_argument('--provisional-synthetic', action='store_true', help='Synthetic source only; assistant review, frozen measured fit and held-out validation; no human approval')
    args = parser.parse_args()
    cache = Path.home() / '.cache/street-fitting/poc'
    evidence = load(args.evidence)
    if args.provisional_synthetic:
        require(args.evidence.resolve().is_relative_to((ROOT / 'verification/results').resolve()), 'provisional_evidence_must_be_in_verification_results')
        config = validate_provisional(evidence, cache)
    else:
        # Formal promotion retains mandatory human GT and licensed-source gates.
        sys.path.insert(0, str(ROOT / 'scripts/e2e'))
        from backends import human_head_inputs
        from runtime import approved_assets
        human_head_inputs()
        plan_path = ROOT / 'verification/fixtures/quality/cases.json'
        head_path = ROOT / 'verification/fixtures/review/head.json'
        plan, head = load(plan_path), load(head_path)
        cases = {case['id']: case for case in head['cases']}
        expected_assets = {'images/derived/shop-2-candidate-1.png', 'images/wardrobe/jeans-cutout.png', 'images/wardrobe/shoes-cutout.png'}
        approved_assets(expected_assets)
        expected_assets.update(cases[case][field] for case in plan['calibration'] + plan['heldOut'] for field in ('image', 'groundTruthMask'))
        require(expected_assets <= set(evidence.get('context', {}).get('assets', {})), 'frozen_source_or_gt_binding_missing')
        config = validate_evidence(evidence, plan, hashlib.sha256(plan_path.read_bytes()).hexdigest(), hashlib.sha256(head_path.read_bytes()).hexdigest(), cache)
    destination = ROOT / 'app/config/local-composition.json'
    # Validation is complete before replacing the only production configuration.
    install_config(config, destination)
    print(json.dumps({'configVersion': config['configVersion'], 'thresholdVersion': config['compositionThresholds']['version'], 'config': str(destination.relative_to(ROOT))}))

if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError) as error:
        raise SystemExit('Composition promotion rejected: ' + str(error)) from None
