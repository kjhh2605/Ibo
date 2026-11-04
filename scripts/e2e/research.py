"""Actual research gates, joining native/live evidence without inventing accuracy SLAs."""
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from zoneinfo import ZoneInfo
import hashlib
import json
import math
import os
import re
import struct
from PIL import Image
from runtime import ROOT,FIX,Blocked,adb,approved_assets,digest,load,require,run_path
from instrumentation import PKG,install_driver,seed

CASES={'normal','shop-specific','time-specific','note-specific','past-trip','not-found','storefront-1','storefront-2','storefront-3'}


def inputs(args):
    if not args.full_run or not args.poc_run:
        raise Blocked('research10 needs --full-run <successful-live-full-run> and --poc-run <completed-16-call-run>; no repeated provider calls are synthesized')
    if not args.seed_search:
        raise Blocked('Pass --seed-search to explicitly authorize S11-only native synthetic historical import into an empty trip database')
    source=run_path(args.full_run);full=load(source/'summary.json')
    require(full.get('status')=='passed' and full.get('mode')=='live' and full.get('operation')=='run','research_full_source_not_live_pass')
    require({row['step'] for row in full.get('steps',[])}==set(range(19)),'research_full_source_missing_steps')
    from backends import privacy
    privacy(None,SimpleNamespace(run=args.full_run))
    poc=load(run_path(args.poc_run)/'summary.json')
    require(poc.get('status')=='passed' and poc.get('operation')=='tryon-poc' and poc.get('providerCalls')==16 and len(poc.get('calls',[]))==16,'research_poc_source_incomplete')
    review_path=FIX/'review/search.json'
    if not review_path.is_file():raise Blocked('Human semantic/retrieval/SAM ground truth required: verification/fixtures/review/search.json (schema in acceptance.md)')
    review=load(review_path)
    require(review.get('humanAttestation') is True and review.get('reviewer') and review.get('reviewedAt'),'research_review_not_human')
    require(review.get('fixtureSha256')==digest(FIX/'store/search.json'),'research_review_seed_changed')
    require({row['id'] for row in review['cases']}==CASES and len(review['cases'])==len(CASES),'research_case_coverage_incomplete')
    paths=[]
    for row in review['cases']:
        require(row.get('query') and row.get('expectedStatus') in {'results','not_found'},'research_expected_query_status_missing')
        require(isinstance(row.get('relevantPhotoIds'),list),'research_relevant_photo_gt_missing')
        require(row['expectedStatus']!='results' or row['relevantPhotoIds'],'research_positive_gt_empty')
        if row['id'] in {'time-specific','past-trip'}:
            require(row.get('expectedTime',{}).get('kind')==('relative-minutes' if row['id']=='time-specific' else 'saturday'),'research_temporal_ground_truth_missing')
        for file,sha in row.get('groundTruthSha256',{}).items():
            require((FIX/file).resolve().is_relative_to(FIX.resolve()) and digest(FIX/file)==sha,'research_gt_mask_hash_changed');paths.append(file)
        require(set(row.get('maskGroundTruth',{}).values())<=set(row.get('groundTruthSha256',{})),'research_mask_not_hash_bound')
    storefronts=review.get('storefronts',[])
    require(len(storefronts)==3 and len({row['shopId'] for row in storefronts})==3,'research_requires_three_storefront_shops')
    for row in storefronts:
        require(digest(FIX/row['image'])==row['sha256'],'research_storefront_hash_changed');paths.append(row['image'])
    assets=load(FIX/'store/search.json')['nativeSeed']['Photo'];paths.extend(row['file'] for row in assets)
    approved_assets(paths)
    proof_dir=Path(os.environ.get('SF_ML_PROOF_DIR',str(FIX/'research/native-proof'))).expanduser().resolve()
    if not (proof_dir/'research.json').is_file():raise Blocked('Original native research proof bundle required: on M1 set SF_ML_PROOF_DIR=/tmp/sf-s05-proof; no synthetic vectors, re-exported research or generated ground truth permitted')
    return source,poc,review,proof_dir


def proof_files(directory):
    directory=directory.resolve()
    proof=load(directory/'research.json');require(len(proof['images'])==22 and len(proof['queries'])==7 and len(proof['segmentation'])==2,'native_research_bundle_cardinality')
    require(proof.get('checkpointSha256')=='868f89f066b7c1ae51add02d2cb7b925fd051076282773f2ec3c71359fbdaf3b','native_research_checkpoint_changed')
    files={'research.json'}
    def file(name):
        path=(directory/name).resolve();require(path.is_relative_to(directory) and path.is_file() and re.fullmatch(r'[A-Za-z0-9_./-]+',name) is not None,'native_research_bundle_path_invalid');files.add(name);return path
    for row in proof['images']:
        original=file(row['source']);require(digest(original)==row['sourceSha256'],'original_research_source_changed')
        canonical_path=file(row['canonical']);require(digest(canonical_path)==row['canonicalSha256'],'canonical_research_source_changed')
        with Image.open(original) as source,Image.open(canonical_path) as canonical:
            require(source.size==canonical.size and source.convert('RGB').tobytes()==canonical.convert('RGB').tobytes(),'canonical_research_pixels_changed')
        raw=file(row['vector']).read_bytes();require(len(raw)==2048,'reference_vector_dimension')
        values=struct.unpack('<512f',raw);require(all(math.isfinite(v) for v in values) and abs(sum(v*v for v in values)-1)<2e-4,'reference_vector_not_normalized')
    for row in proof['queries']:
        require(row.get('relevant_ids'),'research_query_ground_truth_missing');require(len(file(row['vector']).read_bytes())==2048,'text_reference_vector_dimension')
    for row in proof['segmentation']:
        file(row['image']);require(len(row['masks'])==3,'research_requires_three_masks')
        for name in row['masks']:file(name)
    return sorted(files)


def native_research(run,directory):
    files=proof_files(directory);created=[]
    try:
        for name in files:
            target='files/ml-proof/'+name;expected=(directory/name).read_bytes()
            try:existing=adb('exec-out','run-as',PKG,'cat',target)
            except RuntimeError:existing=None
            if existing is not None:require(hashlib.sha256(existing).digest()==hashlib.sha256(expected).digest(),'existing_native_proof_differs_do_not_overwrite')
            else:
                adb('shell','run-as',PKG,'mkdir','-p',str(Path(target).parent))
                adb('shell','run-as',PKG,'sh','-c',"'cat > "+target+"'",input=expected);created.append(target)
        runner=adb('shell','pm','list','instrumentation').decode();matches=re.findall(r'instrumentation:([^\s]+) \(target='+re.escape(PKG)+r'\)',runner)
        require(len(matches)==1,'research_instrumentation_runner_ambiguous')
        classes='com.streetfitting.app.plugins.photoindex.PhotoIndexResearchTest,com.streetfitting.app.plugins.segmenter.SegmenterResearchTest'
        output=adb('shell','am','instrument','-w','-r','-e','class',classes,matches[0],timeout=1800)
        require(b'OK (2 tests)' in output and b'FAILURES!!!' not in output,'native_frozen_research_failed')
        reports={}
        for name in ('photo-index-research','segmenter-research'):
            reports[name]=json.loads(adb('exec-out','run-as',PKG,'cat','files/ml-proof/results/'+name+'.json'))
        run.save('native-research.json',reports)
        require(reports['photo-index-research']['hit3']==7 and reports['photo-index-research']['hit1']==6 and reports['segmenter-research']['allExact'] is True,'native_research_baseline_not_reproduced')
        return reports
    finally:
        for target in created:adb('shell','run-as',PKG,'rm','-f',target)


def temporal(case,observation):
    calls=[call for call in observation['calls'] if call['name']=='find_photos']
    require(calls,'research_find_photos_missing')
    expected=case.get('expectedTime')
    if expected is None:return
    now=datetime.fromisoformat(observation['context']['now']);zone=ZoneInfo(observation['context']['timeZone']);local=now.astimezone(zone)
    if expected['kind']=='relative-minutes':
        center=now-timedelta(minutes=expected['minutes']);start=center-timedelta(minutes=5);end=center+timedelta(minutes=5)
    elif expected['kind']=='saturday':
        day=local.date()-timedelta(days=(local.weekday()-5)%7)
        if expected.get('last') and local.weekday()==5:day-=timedelta(days=7)
        start=datetime.combine(day,datetime.min.time(),zone);end=datetime.combine(day+timedelta(days=1),datetime.min.time(),zone)
    else:raise AssertionError('unknown_research_time_expectation')
    for call in calls:
        require('timeFrom' in call and 'timeTo' in call,'research_time_filter_missing')
        require(datetime.fromisoformat(call['timeFrom'])==start and datetime.fromisoformat(call['timeTo'])==end,'research_time_interpretation_wrong')


def measure(run,args):
    require(os.environ.get('RELAY_MODE')=='live' and os.environ.get('RELAY_MOCK_SKIP_AUTH','0')=='0','research_requires_authenticated_live')
    source,poc,review,proof_dir=inputs(args)
    from backends import human_head_inputs,device_run
    human_head_inputs();proof_files(proof_dir);install_driver()
    native=native_research(run,proof_dir)
    seeded=seed('search',relative_time=True,storefronts=review['storefronts']);run.save('seed.json',seeded)
    from observed_relay import observed_relay
    try:
        with observed_relay(run):
            adb('shell','am','start','-W','-n',PKG+'/.MainActivity')
            device=device_run(run,operation='research',seed=seeded)
    finally:
        report=run.path/'privacy-observer.json'
        run.data['providerCalls']=sum(row['boundary']=='outbound' for row in load(report)['records']) if report.exists() else None
    for case,row in zip(review['cases'],device['queries'],strict=True):
        require(case['id']==row['id'],'research_case_order_changed');temporal(case,row['observed'])
    obs=load(run.path/'privacy-observer.json')
    require(obs['status']=='passed' and len(obs['modelLoads'])==1 and len(obs['textEncodes'])>=2,'research_model_lifecycle_not_observed')
    full_observer=load(source/'privacy-observer.json');latency={}
    for row in full_observer['records']+obs['records']:
        if row['boundary']=='response' and row.get('method')=='POST':latency.setdefault(row['operation'].removeprefix('/v1/').replace('/','-'),[]).append(row)
    required={'search-turn','search-segment','transcribe','describe-storefront','describe-piece','tryon','route'}
    require(set(latency)>=required,'research_endpoint_measurements_incomplete')
    measures={}
    for name,rows in latency.items():
        values=sorted(row['elapsedMs'] for row in rows)
        measures[name]={'count':len(rows),'successes':sum(200<=row['statusCode']<300 for row in rows),'failures':sum(row['statusCode']>=300 for row in rows),'p50Ms':values[math.ceil(len(values)*.5)-1],'p95Ms':values[math.ceil(len(values)*.95)-1],'samplesMs':values}
    positive=[row for row in device['queries'] if row['relevantCount']]
    require(positive,'research_retrieval_denominator_missing')
    return {'suite':'research10','sourceFullRun':args.full_run,'sourcePoCRun':args.poc_run,'nativeResearch':native,'queries':device['queries'],'retrieval':{'denominator':len(positive),'top1':sum(row['hit1'] for row in positive),'top3':sum(row['hit3'] for row in positive),'scope':'reviewed synthetic fixture; no real-store accuracy claim'},'foreground':device['foreground'],'endpointLatency':measures,'appMemory':load(run.path/'app-memory.json'),'relayMemory':load(run.path/'relay-memory.json'),'relayStartup':load(run.path/'relay-startup.json'),'modelLoads':obs['modelLoads'],'textEncodes':obs['textEncodes'],'thresholdVersion':poc['thresholds']['version'],'unverified':['physical-device one-hour battery drain','real-store search generalization','physical destination rediscovery','watermark semantics; result download remains OFF']}
