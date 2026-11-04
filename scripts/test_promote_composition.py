"""Unit-only evidence mutations; CLI regressions replace only temporary bundled config."""
import copy
import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import promote_composition as promotion


class PromotionValidationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.patch = patch.object(promotion, 'ROOT', self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.cache = self.root / 'cache'
        raw = b'unit-only-cache-not-provider-evidence'
        sha = hashlib.sha256(raw).hexdigest()
        (self.cache / 'unit').mkdir(parents=True)
        (self.cache / 'unit' / (sha + '.png')).write_bytes(raw)
        self.plan = {'calibration': ['fit-a', 'fit-b'], 'heldOut': ['hold-a', 'hold-b']}
        self.evidence = {'schemaVersion': 1, 'planSha256': 'a' * 64, 'headReviewSha256': 'b' * 64, 'sourceRun': 'unit', 'completionRun': 'unit'}
        paths = ['scripts/e2e/quality.py', 'scripts/e2e/instrumentation.py', 'scripts/e2e/android-src/com/streetfitting/verification/NativeVerificationTest.java', 'relay/app/routes/tryon.py', 'relay/app/meta_client.py']
        paths += ['app/android/app/src/main/java/com/streetfitting/app/plugins/facemask/' + name + '.java' for name in ('BoundaryMetrics', 'FaceMaskCore', 'HeadGeometry')]
        sources = {}
        for relative in paths:
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(raw)
            sources[relative] = sha
        asset = self.root / 'verification/fixtures/unit-asset'
        asset.parent.mkdir(parents=True)
        asset.write_bytes(raw)
        self.evidence['context'] = {'headReviewSha256': 'b' * 64, 'sources': sources, 'assets': {'unit-asset': sha}}
        combinations = [(case, mode, reasoning, 'calibration') for case in self.plan['calibration'] for mode in ('a', 'b', 'c') for reasoning in ('low', 'high')]
        combinations += [(case, 'a', 'low', 'best-repeat') for case in self.plan['heldOut'] + self.plan['calibration'][:1]] + [('fit-a', 'a', 'low', 'top-only')]
        rows = []
        for n, (case, mode, reasoning, kind) in enumerate(combinations, 1):
            eligible = mode != 'b'
            metrics = {k: 1 if eligible else None for k in promotion.METRICS}
            rows.append({'id': f'call-{n:02}', 'case': case, 'maskMode': mode, 'reasoning': reasoning, 'kind': kind, 'status': 'passed', 'statusCode': 200, 'maskExposure': 0, 'providerSha256': sha, 'providerBytes': len(raw), 'localCacheRun': 'unit', 'previewAvailable': eligible, 'previewSha256': sha if eligible else None, 'previewBytes': len(raw), 'previewCacheRun': 'unit', 'evaluation': {'compositionEligible': eligible, 'metrics': metrics}})
        self.evidence['calls'] = rows
        self.evidence['callsSha256'] = promotion.digest(rows)
        def review(rows):
            return {'humanAttestation': True, 'reviewer': 'unit-schema-sample-not-human', 'reviewedAt': 'unit-only', 'sourceRun': 'unit', 'outputs': {r['id']: {'providerSha256': sha, 'previewSha256': r['previewSha256'], 'acceptableComposition': r['previewAvailable']} for r in rows}}
        calibration_review = review(rows[:12])
        calibration_review['best'] = {'mode': 'a', 'reasoning': 'low'}
        final_review = review(rows[12:])
        final_review['callsSha256'] = promotion.digest(rows)
        self.evidence.update(calibrationReview=calibration_review, finalHumanReview=final_review)
        thresholds = {'maxBoundaryColorDeltaE': 1, 'maxBoundaryOffsetRatio': 1}
        thresholds['version'] = 's11-' + promotion.digest(thresholds)[:16]
        self.evidence['thresholds'] = thresholds
        self.evidence['freeze'] = {'thresholds': copy.deepcopy(thresholds), 'best': {'mode': 'a', 'reasoning': 'low'}, 'frozenBeforeCall': 13, 'calibrationCallsSha256': promotion.digest(rows[:12]), 'calibrationReviewSha256': promotion.digest(calibration_review)}
        self.evidence['nativeReplay'] = [{'call': r['id'], 'providerSha256': sha, 'identical': True, 'decision': promotion.decision(r['evaluation']['metrics'], thresholds)} for r in rows]
        self.evidence['heldOut'] = [{'call': f'call-{n}', 'identical': True, 'decision': 'composited'} for n in (13, 14)]

    def validate(self, evidence=None):
        return promotion.validate_evidence(evidence or self.evidence, self.plan, 'a' * 64, 'b' * 64, self.cache)

    def test_validation_is_nonmutating_and_never_installs_unit_labels(self):
        original = copy.deepcopy(self.evidence)
        self.validate()
        self.assertEqual(self.evidence, original)
        self.assertFalse((self.root / 'app/config/local-composition.json').exists())

    def test_unsafe_calibration_negative_does_not_block_valid_frozen_fit(self):
        row = self.evidence['calls'][2]
        row['evaluation'] = {'ok': False, 'reason': 'unsafe_output', 'decision': 'unsafe_output', 'metrics': None}
        calls_digest = promotion.digest(self.evidence['calls'])
        self.evidence['callsSha256'] = calls_digest
        self.evidence['finalHumanReview']['callsSha256'] = calls_digest
        self.evidence['freeze']['calibrationCallsSha256'] = promotion.digest(self.evidence['calls'][:12])
        config = self.validate()
        self.assertEqual(config['compositionThresholds'], self.evidence['freeze']['thresholds'])
        self.assertEqual(config['provenance']['callsSha256'], calls_digest)

    def test_rejects_incomplete_calls_changed_freeze_stale_review_and_wrong_mode(self):
        changes = [
            lambda e: e['calls'].pop(),
            lambda e: e['freeze'].update(frozenBeforeCall=14),
            lambda e: e['freeze']['thresholds'].update(maxBoundaryColorDeltaE=2),
            lambda e: e['freeze']['best'].update(reasoning='high'),
            lambda e: e['finalHumanReview'].update(callsSha256='c' * 64),
            lambda e: e['finalHumanReview']['outputs']['call-13'].update(previewSha256='c' * 64),
            lambda e: e['finalHumanReview']['outputs']['call-13'].update(acceptableComposition=False),
            lambda e: e['nativeReplay'][12].update(identical=False),
            lambda e: e['heldOut'].pop(),
            lambda e: e.update(headReviewSha256='c' * 64),
        ]
        for change in changes:
            evidence = copy.deepcopy(self.evidence)
            change(evidence)
            with self.subTest(change=changes.index(change)), self.assertRaises(ValueError):
                self.validate(evidence)

    def test_rejects_changed_native_algorithm_and_provider_bytes(self):
        source = self.root / 'app/android/app/src/main/java/com/streetfitting/app/plugins/facemask/FaceMaskCore.java'
        source.write_text('changed')
        with self.assertRaisesRegex(ValueError, 'measurement_source_or_asset_changed'):
            self.validate()
        source.write_bytes(b'unit-only-cache-not-provider-evidence')
        next((self.cache / 'unit').iterdir()).write_text('changed')
        with self.assertRaisesRegex(ValueError, 'provider_cache_missing_or_changed'):
            self.validate()

    def test_rejects_duplicate_and_nonfinite_json(self):
        path = self.root / 'bad.json'
        for text in ('{"a":1,"a":2}', '{"a":NaN}'):
            path.write_text(text)
            with self.assertRaises(ValueError):
                promotion.load(path)


class ProvisionalPromotionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        root_patch = patch.object(promotion, 'ROOT', self.root)
        root_patch.start()
        self.addCleanup(root_patch.stop)
        self.cache = self.root / '.cache/street-fitting/poc'
        (self.cache / 'unit').mkdir(parents=True)
        sources = {}
        paths = ['scripts/e2e/quality.py', 'scripts/e2e/instrumentation.py', 'scripts/e2e/android-src/com/streetfitting/verification/NativeVerificationTest.java', 'relay/app/routes/tryon.py', 'relay/app/meta_client.py']
        paths += ['app/android/app/src/main/java/com/streetfitting/app/plugins/facemask/' + name + '.java' for name in ('BoundaryMetrics', 'FaceMaskCore', 'HeadGeometry')]
        for relative in paths:
            path = self.root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'unit-only-measurement-source')
            sources[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
        source_sha, source_size = self.cache_bytes(b'unit-only-canonical-synthetic-source')
        self.source_sha = source_sha
        self.thresholds = {'maxBoundaryColorDeltaE': 2, 'maxBoundaryOffsetRatio': 0.03}
        fit = [self.sample('fit-positive', True), self.sample('fit-negative', False)]
        validation = [self.sample('validation-positive', True, held_out=True)]
        self.freeze_path = self.root / 'verification/results/unit/provisional-freeze.json'
        self.freeze_path.parent.mkdir(parents=True)
        self.evidence = {'schemaVersion': 1, 'kind': 'provisional-synthetic', 'syntheticOnly': True, 'humanApproved': False, 'sourceRun': 'unit',
                         'sourceImage': {'sha256': source_sha, 'bytes': source_size, 'cacheRun': 'unit'}, 'context': {'sources': sources},
                         'fit': fit, 'validation': validation,
                         'freeze': {'sourceRun': 'unit', 'sourceImageSha256': source_sha, 'fitSha256': '', 'frozenAt': '2026-01-01T00:02:00Z', 'thresholds': copy.deepcopy(self.thresholds)},
                         'freezeFile': 'verification/results/unit/provisional-freeze.json'}
        self.refresh_bindings(self.evidence)

    def cache_bytes(self, raw):
        sha = hashlib.sha256(raw).hexdigest()
        (self.cache / 'unit' / (sha + '.png')).write_bytes(raw)
        return sha, len(raw)

    def sample(self, name, accepted, held_out=False):
        provider_sha, provider_size = self.cache_bytes(('unit-only-provider-' + name).encode())
        preview_sha, preview_size = self.cache_bytes(('unit-only-preview-' + name).encode())
        metrics = dict(zip(promotion.METRICS, (1, 2, 0.02, 0.03) if accepted else (6, 7, 0.1, 0.2)))
        if held_out:
            metrics.update(passed=True, decision='composited', thresholdVersion='provisional-fit-' + promotion.digest(self.thresholds)[:16])
        return {'id': name, 'sourceImageSha256': self.source_sha, 'providerSha256': provider_sha, 'providerBytes': provider_size, 'localCacheRun': 'unit',
                'previewAvailable': True, 'previewSha256': preview_sha, 'previewBytes': preview_size, 'previewCacheRun': 'unit',
                'status': 'passed', 'statusCode': 200, 'maskMode': 'a', 'reasoning': 'low',
                'maskCheck': {'kind': 'native-auto-mask', 'protectedPixelsOpaque': True},
                'evaluation': {'ok': True, 'compositionEligible': True, 'previewWritten': True, 'metrics': metrics},
                'measuredAt': '2026-01-01T00:03:00Z' if held_out else '2026-01-01T00:00:00Z',
                'review': {'kind': 'assistant-visual', 'humanApproved': False, 'reviewer': 'unit-schema-sample-not-a-review',
                           'reviewedAt': '2026-01-01T00:04:00Z' if held_out else '2026-01-01T00:01:00Z',
                           'providerSha256': provider_sha, 'previewSha256': preview_sha, 'acceptableComposition': accepted},
                'freezeSha256': None, 'thresholds': None}

    def refresh_bindings(self, evidence):
        """Model a new honest freeze, so mutations exercise downstream safety checks."""
        for row in evidence['fit'] + evidence['validation']:
            row['metricsSha256'] = promotion.digest(row['evaluation'].get('metrics'))
        evidence['freeze']['fitSha256'] = promotion.digest(evidence['fit'])
        evidence['freezeSha256'] = promotion.digest(evidence['freeze'])
        for row in evidence['validation']:
            row['freezeSha256'] = evidence['freezeSha256']
            row['thresholds'] = copy.deepcopy(evidence['freeze']['thresholds'])
        self.freeze_path.write_text(json.dumps(evidence['freeze']))
        os.utime(self.freeze_path, (0, 0))

    def validate(self, evidence=None):
        return promotion.validate_provisional(self.evidence if evidence is None else evidence, self.cache)

    def test_provisional_output_is_exact_hash_bound_and_nonmutating(self):
        original = copy.deepcopy(self.evidence)
        config = self.validate()
        sha = promotion.digest(self.evidence)
        self.assertEqual(config, {'schemaVersion': 1, 'configVersion': 'local-composition-provisional-' + sha, 'mode': 'a',
                                 'compositionThresholds': {'version': 'provisional-' + sha[:16], **self.thresholds},
                                 'provenance': {'kind': 'provisional-synthetic', 'sourceRun': 'unit', 'evidenceSha256': sha,
                                                'sourceImageSha256': self.source_sha, 'providerSamples': 3, 'humanApproved': False}})
        self.assertEqual(self.evidence, original)
        self.assertFalse((self.root / 'app/config/local-composition.json').exists())

    def test_safe_negative_and_unsafe_geometry_negative_are_rejected(self):
        self.validate()
        negative = self.evidence['fit'][1]
        negative.update(previewAvailable=False, previewSha256=None, previewBytes=None)
        negative['review']['previewSha256'] = None
        negative['evaluation'] = {'ok': False, 'reason': 'unsafe_output', 'decision': 'unsafe_output', 'metrics': None}
        self.refresh_bindings(self.evidence)
        self.validate()

    def test_rejects_negative_admitted_by_proposed_thresholds(self):
        negative = self.evidence['fit'][1]
        negative['evaluation']['metrics'] = copy.deepcopy(self.evidence['fit'][0]['evaluation']['metrics'])
        self.refresh_bindings(self.evidence)
        with self.assertRaisesRegex(ValueError, 'fitted_thresholds_accept_rejected_output'):
            self.validate()

    def test_rejects_padded_thresholds_even_when_native_validation_claims_pass(self):
        self.evidence['freeze']['thresholds']['maxBoundaryColorDeltaE'] = 3
        self.refresh_bindings(self.evidence)
        metrics = self.evidence['validation'][0]['evaluation']['metrics']
        metrics['thresholdVersion'] = 'provisional-fit-' + promotion.digest(self.evidence['freeze']['thresholds'])[:16]
        self.refresh_bindings(self.evidence)
        with self.assertRaisesRegex(ValueError, 'thresholds_not_measured_fit'):
            self.validate()

    def test_rejects_human_approval_real_sources_and_missing_automatic_mask_proof(self):
        changes = [
            lambda e: e.update(humanApproved=True),
            lambda e: e.update(humanAttestation=True),
            lambda e: e.update(syntheticOnly=False),
            lambda e: e['fit'][0]['review'].update(humanApproved=True),
            lambda e: e['fit'][0]['review'].update(kind='human'),
            lambda e: e['fit'][0]['maskCheck'].update(protectedPixelsOpaque=False),
            lambda e: e['fit'][0].update(maskExposure=0),
        ]
        for change in changes:
            evidence = copy.deepcopy(self.evidence)
            change(evidence)
            self.refresh_bindings(evidence)
            with self.subTest(change=changes.index(change)), self.assertRaises(ValueError):
                self.validate(evidence)

    def test_rejects_changed_provider_preview_source_and_measurement_bytes(self):
        rows = self.evidence['fit']
        files = [self.cache / 'unit' / (sha + '.png') for sha in (rows[0]['providerSha256'], rows[0]['previewSha256'], self.source_sha)]
        for path in files:
            original = path.read_bytes()
            path.write_bytes(b'changed')
            with self.subTest(path=path), self.assertRaises(ValueError):
                self.validate()
            path.write_bytes(original)
        self.evidence['validation'][0]['evaluation']['metrics']['neckColorDeltaE95'] = 0
        with self.assertRaisesRegex(ValueError, 'measurement_metrics_hash_changed'):
            self.validate()

    def test_rejects_mismatched_source_and_stale_visual_review(self):
        changes = [
            lambda e: e['fit'][0].update(sourceImageSha256='a' * 64),
            lambda e: e['validation'][0].update(sourceImageSha256='a' * 64),
            lambda e: e['sourceImage'].update(sha256='a' * 64),
            lambda e: e['fit'][0]['review'].update(providerSha256='a' * 64),
            lambda e: e['fit'][0]['review'].update(previewSha256='a' * 64),
        ]
        for change in changes:
            evidence = copy.deepcopy(self.evidence)
            change(evidence)
            self.refresh_bindings(evidence)
            with self.subTest(change=changes.index(change)), self.assertRaises(ValueError):
                self.validate(evidence)

    def test_rejects_invalid_failing_or_unfrozen_heldout_validation(self):
        changes = [
            lambda e: e.update(validation=[]),
            lambda e: e['validation'][0].update(measuredAt='2026-01-01T00:01:00Z'),
            lambda e: e['validation'][0].update(freezeSha256='a' * 64),
            lambda e: e['validation'][0]['thresholds'].update(maxBoundaryColorDeltaE=3),
            lambda e: e['validation'][0]['review'].update(acceptableComposition=False),
            lambda e: e['validation'][0]['evaluation']['metrics'].update(passed=False),
            lambda e: e['validation'][0]['evaluation']['metrics'].update(decision='threshold_exceeded'),
            lambda e: e['validation'][0]['evaluation']['metrics'].update(thresholdVersion='unfrozen'),
            lambda e: e['validation'][0]['evaluation'].update(compositionEligible=False),
            lambda e: e['validation'][0]['evaluation']['metrics'].update(neckColorDeltaE95=10),
        ]
        for change in changes:
            evidence = copy.deepcopy(self.evidence)
            change(evidence)
            # Do not repair intentionally corrupted frozen bindings.
            for row in evidence['validation']:
                row['metricsSha256'] = promotion.digest(row['evaluation'].get('metrics'))
            with self.subTest(change=changes.index(change)), self.assertRaises(ValueError):
                self.validate(evidence)

    def test_rejects_fit_provider_reused_as_validation(self):
        held, fit = self.evidence['validation'][0], self.evidence['fit'][0]
        for key in ('providerSha256', 'providerBytes', 'localCacheRun'):
            held[key] = fit[key]
        held['review']['providerSha256'] = fit['providerSha256']
        with self.assertRaisesRegex(ValueError, 'validation_provider_not_held_out'):
            self.validate()

    def test_rejects_changed_freeze_file_or_file_written_after_measurement(self):
        self.freeze_path.write_text('{}')
        with self.assertRaisesRegex(ValueError, 'immutable_freeze_file_changed'):
            self.validate()
        self.refresh_bindings(self.evidence)
        validation_time = promotion.utc_time(self.evidence['validation'][0]['measuredAt']).timestamp()
        os.utime(self.freeze_path, (validation_time + 1, validation_time + 1))
        with self.assertRaisesRegex(ValueError, 'validation_not_measured_after_freeze'):
            self.validate()

    def test_cli_rejection_never_mutates_bundled_config(self):
        destination = self.root / 'app/config/local-composition.json'
        destination.parent.mkdir(parents=True)
        original = b'{"existing":"do-not-mutate"}\n'
        destination.write_bytes(original)
        evidence_path = self.freeze_path.with_name('provisional-composition.json')
        changes = [
            lambda e: e.update(humanApproved=True),
            lambda e: e['validation'][0]['evaluation']['metrics'].update(passed=False),
            lambda e: e['fit'][1]['evaluation'].update(metrics=copy.deepcopy(e['fit'][0]['evaluation']['metrics'])),
            lambda e: e['fit'][0].update(sourceImageSha256='a' * 64),
        ]
        for change in changes:
            evidence = copy.deepcopy(self.evidence)
            change(evidence)
            self.refresh_bindings(evidence)
            evidence_path.write_text(json.dumps(evidence))
            with self.subTest(change=changes.index(change)), patch('sys.argv', ['promote_composition.py', '--provisional-synthetic', '--evidence', str(evidence_path)]), patch.object(Path, 'home', return_value=self.root), patch.object(promotion, 'install_config') as install:
                with self.assertRaises(ValueError):
                    promotion.main()
                install.assert_not_called()
            self.assertEqual(destination.read_bytes(), original)
            self.assertFalse(destination.with_suffix('.json.tmp').exists())

    def test_cli_promotes_only_after_complete_validation(self):
        destination = self.root / 'app/config/local-composition.json'
        destination.parent.mkdir(parents=True)
        destination.write_text('old')
        evidence_path = self.freeze_path.with_name('provisional-composition.json')
        evidence_path.write_text(json.dumps(self.evidence))
        with patch('sys.argv', ['promote_composition.py', '--provisional-synthetic', '--evidence', str(evidence_path)]), patch.object(Path, 'home', return_value=self.root), patch('builtins.print'):
            promotion.main()
        self.assertEqual(promotion.load(destination), self.validate())
        self.assertFalse(destination.with_suffix('.json.tmp').exists())


if __name__ == '__main__':
    unittest.main()
