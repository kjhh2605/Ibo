"""Offline calibration invariants; these tests never approve real fixtures."""
import base64
import copy
import hashlib
import importlib
import json
from pathlib import Path
import sys

import pytest

from .conftest import fitting, image, image_output

# E2E tools intentionally run as scripts rather than as a second app package.
sys.path.insert(0, str(Path(__file__).resolve().parents[3]/'scripts/e2e'))
quality = importlib.import_module('quality')


def metrics(color=2.0, offset=0.02, *, passed=False, decision='not_calibrated'):
    return dict(zip(quality.METRICS, (color, color, offset, offset)), passed=passed, decision=decision)


def reviewed_experiment():
    plan={'calibration':['calibration-one','calibration-two'],'heldOut':['heldout-one','heldout-two']}
    best={'mode':'a','reasoning':'low'}
    rows=[]
    for index, planned in enumerate(quality.schedule(plan,best),1):
        accepted=index!=12
        tail=index>12
        rows.append({'id':f'call-{index:02}',**planned,'status':'passed',
                     'providerSha256':hashlib.sha256(f'provider-{index}'.encode()).hexdigest(),
                     'previewAvailable':True,'previewSha256':hashlib.sha256(f'preview-{index}'.encode()).hexdigest(),
                     'evaluation':{'ok':True,'compositionEligible':True,
                                   'metrics':metrics(2 if accepted else 10,0.02 if accepted else 0.1,
                                                     passed=tail,decision='composited' if tail else 'not_calibrated')}})
    approval={'humanAttestation':True,'sourceRun':'synthetic-test-run','reviewer':'test fixture, not a real reviewer',
              'reviewedAt':'2026-01-01T00:00:00Z','best':best,
              'outputs':{row['id']:{'providerSha256':row['providerSha256'],'previewSha256':row['previewSha256'],
                                    'acceptableComposition':row['id']!='call-12'} for row in rows[:12]}}
    freeze=quality.fit_freeze(rows[:12],approval,'synthetic-test-run')
    digest=quality.fingerprint(rows)
    final={'humanAttestation':True,'sourceRun':'synthetic-test-run','reviewer':'test fixture, not a real reviewer',
           'reviewedAt':'2026-01-02T00:00:00Z','callsSha256':digest,
           'outputs':{row['id']:{'providerSha256':row['providerSha256'],'previewSha256':row['previewSha256'],
                                'acceptableComposition':True} for row in rows[12:]}}
    replay=[{'call':row['id'],'providerSha256':row['providerSha256'],'identical':True,
             'decision':quality.decision(row['evaluation']['metrics'],freeze['thresholds'])} for row in rows]
    previous={'baseSource':'synthetic-test-run','plan':plan,'planSha256':'a'*64,'calls':rows,'freeze':freeze,
              'context':{'headReviewSha256':'b'*64},'nativeReplay':replay,'nativeReplayCallsSha256':digest}
    return previous,approval,final


def test_experiment_payload_matches_deployed_low_contract(provider):
    body=fitting(2)
    client,calls=provider(image_output())
    assert client.post('/v1/tryon',json=body).status_code==200
    wire=json.loads(calls[0].content)
    raw=base64.b64decode(body['selfPhoto']['image']['data'])
    garments=[base64.b64decode(piece['image']['data']) for piece in [body['target'],*body['companions']]]
    assert quality.edit_payload(raw,garments,'low',wire['user'])==wire
    high=quality.edit_payload(raw,garments,'high',wire['user'])
    assert {**high,'reasoning_strength':'low'}==wire
    assert 'store' not in high and 'tools' not in high and 'safety_identifier' not in high


@pytest.mark.parametrize('fmt',['PNG','JPEG'])
def test_provider_parser_preserves_original_encoded_bytes(fmt):
    encoded=image(metadata={'watermark':'synthetic-test-marker'},fmt=fmt)['data']
    assert quality.provider_image(image_output(encoded))==base64.b64decode(encoded)


@pytest.mark.parametrize('value',[{'output':[{'type':'image_generation_call','result':'abc'}]},
                                 {'data':[]},{'data':[{'url':'https://example.invalid/image.png'}]},
                                 {'data':[{'b64_json':'a'},{'b64_json':'b'}]},
                                 {'status':'failed','data':[]}])
def test_parser_rejects_old_contract_urls_and_ambiguous_outputs(value):
    with pytest.raises(Exception):quality.provider_image(value)


@pytest.mark.parametrize('label',[None,'true',1,0])
def test_review_requires_explicit_boolean_for_every_output(label):
    previous,approval,_=reviewed_experiment()
    if label is None:approval['outputs']['call-12'].pop('acceptableComposition')
    else:approval['outputs']['call-12']['acceptableComposition']=label
    with pytest.raises(AssertionError,match='explicit_boolean'):
        quality.thresholds_from_review(previous['calls'][:12],approval)


def test_human_labels_bind_exact_provider_and_composed_preview():
    previous,approval,_=reviewed_experiment()
    approval['outputs']['call-01']['providerSha256']='0'*64
    with pytest.raises(AssertionError,match='missing_or_stale'):
        quality.thresholds_from_review(previous['calls'][:12],approval)
    approval['outputs']['call-01']['providerSha256']=previous['calls'][0]['providerSha256']
    approval['outputs']['call-01']['previewSha256']='0'*64
    with pytest.raises(AssertionError,match='preview_missing_or_stale'):
        quality.thresholds_from_review(previous['calls'][:12],approval)


def test_threshold_fit_rejects_negative_inside_positive_rectangle():
    previous,approval,_=reviewed_experiment()
    previous['calls'][11]['evaluation']['metrics']=metrics(1,0.01)
    with pytest.raises(AssertionError,match='accepts_human_rejected'):
        quality.thresholds_from_review(previous['calls'][:12],approval)


def test_threshold_fit_rejects_cross_axis_false_positive():
    previous,approval,_=reviewed_experiment()
    previous['calls'][0]['evaluation']['metrics']=metrics(8,0.01)
    previous['calls'][1]['evaluation']['metrics']=metrics(1,0.08)
    previous['calls'][11]['evaluation']['metrics']=metrics(7,0.07)
    with pytest.raises(AssertionError,match='accepts_human_rejected'):
        quality.thresholds_from_review(previous['calls'][:12],approval)


def test_fit_keeps_rejected_samples_and_uses_all_accepted_samples():
    previous,approval,_=reviewed_experiment()
    rows=previous['calls'][:12]
    thresholds=quality.thresholds_from_review(rows,approval)
    assert thresholds['maxBoundaryColorDeltaE']==2
    assert thresholds['maxBoundaryOffsetRatio']==0.02
    assert quality.decision(rows[11]['evaluation']['metrics'],thresholds)=='threshold_exceeded'
    assert len(rows)==12


def test_best_pair_must_be_acceptable_for_both_calibration_cases():
    previous,approval,_=reviewed_experiment()
    approval['best']={'mode':'c','reasoning':'high'}
    with pytest.raises(AssertionError,match='not_acceptable_for_both'):
        quality.fit_freeze(previous['calls'][:12],approval,'synthetic-test-run')


@pytest.mark.parametrize('field',['previewAvailable','compositionEligible'])
def test_positive_cannot_be_approved_without_real_eligible_composition(field):
    previous,approval,_=reviewed_experiment()
    if field=='previewAvailable':previous['calls'][0][field]=False
    else:previous['calls'][0]['evaluation'][field]=False
    with pytest.raises(AssertionError,match='no_composition_preview'):
        quality.thresholds_from_review(previous['calls'][:12],approval)


@pytest.mark.parametrize('invalid',[None,True,float('nan'),float('inf'),-1])
def test_accepted_metrics_must_be_available_finite_nonnegative_numbers(invalid):
    previous,approval,_=reviewed_experiment()
    previous['calls'][0]['evaluation']['metrics'][quality.METRICS[0]]=invalid
    with pytest.raises(AssertionError,match='unavailable_metrics'):
        quality.thresholds_from_review(previous['calls'][:12],approval)


def test_schedule_resume_keeps_exact_prefix_and_only_unstarted_calls():
    previous,_,_=reviewed_experiment()
    rows=previous['calls'];planned=quality.schedule(previous['plan'],previous['freeze']['best'])
    for count in range(17):
        quality.validate_rows(rows[:count],planned)
        assert len(planned[count:])==16-count
    changed=copy.deepcopy(rows[:5]);changed[3]['reasoning']='low'
    with pytest.raises(AssertionError,match='schedule_changed'):quality.validate_rows(changed,planned)


@pytest.fixture
def completed(monkeypatch):
    monkeypatch.setattr(quality,'cached_provider',lambda row:b'provider-test-only')
    monkeypatch.setattr(quality,'cached_preview',lambda row:b'preview-test-only')
    return reviewed_experiment()


def test_only_complete_frozen_reproduced_evidence_is_exported(completed):
    previous,approval,final=completed
    evidence=quality.completed_evidence(previous,approval,final,'synthetic-completion')
    assert evidence['schemaVersion']==1 and len(evidence['calls'])==16
    assert len(evidence['heldOut'])==2
    assert all(row['decision']=='composited' for row in evidence['heldOut'])
    assert evidence['calls'][0]['evaluation']['metrics']['decision']=='not_calibrated'
    assert evidence['nativeReplay'][0]['decision']=='composited'


@pytest.mark.parametrize('index',[12,13,14,15])
def test_every_validation_output_requires_human_acceptance(completed,index):
    previous,approval,final=completed
    final['outputs'][previous['calls'][index]['id']]['acceptableComposition']=False
    with pytest.raises(AssertionError,match='human_rejected'):
        quality.completed_evidence(previous,approval,final,'synthetic-completion')


def test_validation_rejects_threshold_exceeded_even_if_replay_is_identical(completed):
    previous,approval,final=completed
    row=previous['calls'][12]
    row['evaluation']['metrics']=metrics(100,1,passed=False,decision='threshold_exceeded')
    digest=quality.fingerprint(previous['calls'])
    final['callsSha256']=digest;previous['nativeReplayCallsSha256']=digest
    previous['nativeReplay'][12]['decision']='threshold_exceeded'
    with pytest.raises(AssertionError,match='not_composited'):
        quality.completed_evidence(previous,approval,final,'synthetic-completion')


def test_validation_rejects_changed_calibration_review_after_freeze(completed):
    previous,approval,final=completed
    approval['reviewedAt']='2026-01-03T00:00:00Z'
    with pytest.raises(AssertionError,match='frozen_calibration_changed'):
        quality.completed_evidence(previous,approval,final,'synthetic-completion')


def test_validation_rejects_stale_full_run_review_and_missing_native_replay(completed):
    previous,approval,final=completed
    final['callsSha256']='0'*64
    with pytest.raises(AssertionError,match='not_bound_to_complete_calls'):
        quality.completed_evidence(previous,approval,final,'synthetic-completion')
    final['callsSha256']=quality.fingerprint(previous['calls'])
    previous['nativeReplay']=[]
    with pytest.raises(AssertionError,match='replay_missing_or_stale'):
        quality.completed_evidence(previous,approval,final,'synthetic-completion')


@pytest.mark.parametrize('status',['attempted','failed'])
def test_resume_never_rebills_indeterminate_or_failed_recorded_attempts(monkeypatch,tmp_path,status):
    previous,_,_=reviewed_experiment()
    plan=previous['plan']
    previous.update(schemaVersion=1,context={},planSha256=hashlib.sha256((quality.FIX/'quality/cases.json').read_bytes()).hexdigest())
    previous['calls']=previous['calls'][:5]
    previous['calls'][-1]['status']=status
    previous['freeze']=None
    def fixture_load(path):
        if Path(path).name=='poc-progress.json':return previous
        if Path(path).name=='cases.json':return plan
        if Path(path).name=='head.json':return {'cases':[]}
        raise AssertionError('Unexpected input read')
    monkeypatch.setattr(quality,'load',fixture_load)
    monkeypatch.setattr(quality,'human_head_inputs',lambda:None)
    monkeypatch.setattr(quality,'approved_assets',lambda paths:None)
    monkeypatch.setattr(quality,'experiment_context',lambda plan:{})
    monkeypatch.setattr(quality,'run_path',lambda run_id:tmp_path)
    monkeypatch.setattr(quality,'cached_provider',lambda row:b'unchanged-test-bytes')
    def forbidden(*args,**kwargs):
        pytest.fail('Resume must not contact provider or device for failed/unknown attempts')
    monkeypatch.setattr(quality,'install_driver',forbidden)
    monkeypatch.setattr(quality.httpx,'Client',forbidden)
    args=quality.SimpleNamespace(plan=16,mode='live',resume='synthetic-previous')
    run=quality.SimpleNamespace(id='synthetic-resume')
    with pytest.raises((quality.Blocked,AssertionError),match='unknown provider outcome|cannot_hide_failed_provider'):
        quality.poc(run,args)
