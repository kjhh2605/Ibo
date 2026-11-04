"""Opt-in approved-synthetic live recorder, independent from the relay server.
Credentials are read from environment at request time and never serialized.
"""
from __future__ import annotations
import base64
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import time
from datetime import datetime, timezone
import httpx
from pydantic import TypeAdapter
from runtime import ROOT, FIX, Blocked, approved_assets, load, require, run_path
from relay_fixtures import MODELS, child, expand, ignored

PATHS={'search-turn':'/v1/search/turn','search-segment':'/v1/search/segment','transcribe':'/v1/transcribe','describe-storefront':'/v1/describe/storefront','describe-piece':'/v1/describe/piece','tryon':'/v1/tryon','route':'/v1/route'}


def refs(value, at=''):
    if isinstance(value,dict):
        for key,child_value in value.items():
            location=at+'.'+key if at else key
            if key in {'photoRef','shopRef','tripRef','pieceRef','toolCallId'} and isinstance(child_value,str):
                yield child_value,location
            yield from refs(child_value,location)
    elif isinstance(value,list):
        for index,item in enumerate(value):yield from refs(item,f'{at}[{index}]')


def asset_paths(value):
    if isinstance(value,dict):
        if set(value)=={'asset'}:yield value['asset']
        else:
            for child_value in value.values():yield from asset_paths(child_value)
    elif isinstance(value,list):
        for child_value in value:yield from asset_paths(child_value)


def normalize(value, directory, reference_paths, *, key='', generated=None):
    if isinstance(value,dict):
        # Every token is runtime-only, including provider/authentication tokens.
        require(not set(value)&{'authorization','access_token','id_token','uid'},'secret_in_recording')
        return {k:normalize(v,directory,reference_paths,key=k,generated=generated) for k,v in value.items() if k!='queryToken'}
    if isinstance(value,list):return [normalize(v,directory,reference_paths,key=key,generated=generated) for v in value]
    if key=='data' and isinstance(value,str):
        raw=base64.b64decode(value,validate=True)
        name=hashlib.sha256(raw).hexdigest()+('.png' if raw.startswith(b'\x89PNG') else '.jpg' if raw.startswith(b'\xff\xd8') else '.wav' if raw.startswith(b'RIFF') else '.bin')
        path=directory/'assets'/name;path.parent.mkdir(parents=True,exist_ok=True)
        if not path.exists():path.write_bytes(raw)
        if generated is not None:generated.append({'path':'assets/'+name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)})
        return {'asset':'assets/'+name}
    if key in {'photoRef','shopRef','tripRef','pieceRef','toolCallId','photoRefs','shopRefs'} and isinstance(value,str) and value in reference_paths:
        return '{{'+reference_paths[value]+'}}'
    return value


def record(run,args):
    require(args.source=='live' and os.environ.get('RELAY_MODE')=='live','recording_requires_live')
    require(os.environ.get('RELAY_MOCK_SKIP_AUTH','0')=='0','live_auth_skip_forbidden')
    require(re.fullmatch('[a-z][a-z0-9-]*',args.scenario),'invalid_scenario_name')
    source=FIX/'relay'/args.scenario
    if not source.is_dir():raise Blocked('Unknown approved synthetic scenario: '+args.scenario)
    requests=sorted(source.glob('*.request.json'))
    require(requests,'recording_scenario_has_no_requests')
    requested=[]
    for file in requests:
        for relative in asset_paths(load(file)['expected']):requested.append(str((source/relative).relative_to(FIX)))
    approved_assets(requested)
    # Explicit review approval binds this recorder invocation to the entire
    # expected scenario, including synthetic route coordinates and query text.
    approval=source/'recording-approval.json'
    if not approval.exists():raise Blocked('Human recording approval required: '+str(approval.relative_to(ROOT)))
    approved=load(approval)
    require(approved.get('reviewer') and approved.get('reviewedAt') and approved.get('approved') is True,'recording_not_approved')
    for file in requests:require(approved.get('requestSha256',{}).get(file.name)==hashlib.sha256(file.read_bytes()).hexdigest(),'recording_approval_stale')
    from privacy_capture import Observer, media, pixel_hash
    privacy=Observer()
    sensitive=any(file.name.startswith(('tryon.','describe-piece.')) for file in requests)
    if sensitive:
        source_run=approved.get('nativePrivacyRun')
        if not source_run:raise Blocked('Recording tryon/cutouts requires recording-approval.json.nativePrivacyRun from a successful native E2E')
        evidence=run_path(source_run)
        require(load(evidence/'summary.json').get('status')=='passed','recording_native_source_not_passed')
        native_ids=load(evidence/'native-identities.json')
        require(load(evidence/'privacy-observer.json').get('status')=='passed','recording_native_privacy_not_passed')
    else:native_ids={}
    if not os.environ.get('SF_FIREBASE_ID_TOKEN') or not os.environ.get('SF_FIREBASE_APP_CHECK_TOKEN'):
        raise Blocked('Provide runtime SF_FIREBASE_ID_TOKEN and SF_FIREBASE_APP_CHECK_TOKEN outside the repository')
    base='http://127.0.0.1:'+str(int(os.environ.get('RELAY_PORT','8787')))
    destination=run.path/'recorded-fixture';destination.mkdir()
    # Follow the pre-reviewed scenario order, consuming each returned token.
    # Never replay the saved runtime-token sentinel to a live server.
    order=approved.get('order')
    require(isinstance(order,list) and set(order)=={p.name for p in requests} and len(order)==len(requests),'recording_order_must_cover_requests_once')
    token=None;pending=None;records=[];assets=[]
    from observed_relay import observed_relay
    with observed_relay(run),httpx.Client(base_url=base,timeout=200,follow_redirects=False,trust_env=False) as client:
        Path(os.environ['SF_PRIVACY_IDENTITIES']).write_text(json.dumps(native_ids))
        for name in order:
            operation=name.rsplit('.',3)[0];definition=load(source/name)
            request=expand(definition['expected'],source)
            if 'queryToken' in request:
                require(token is not None,'recording_missing_current_query_token');request['queryToken']=token
            if request.get('toolResults'):
                require(pending is not None,'recording_missing_pending_tool')
                require(request['toolResults'][0]['name']==pending['name'],'live_tool_diverged_from_reviewed_scenario')
                request['toolResults'][0]['toolCallId']=pending['id']
            request=TypeAdapter(MODELS[operation][0]).validate_python(request).model_dump(mode='json',exclude_none=True)
            for raw in media(request):
                require(pixel_hash(raw) not in privacy.raw and hashlib.sha256(raw).hexdigest() not in privacy.head_bytes,'recording_forbidden_self_or_head_mask')
            if operation=='tryon':
                masked=base64.b64decode(request['selfPhoto']['image']['data'],validate=True)
                require(pixel_hash(masked) in native_ids.get('maskedSelfPixelHashes',[]),'recording_masked_self_has_no_native_proof')
                garments=[request['target'],*request['companions']]
                require(all(pixel_hash(base64.b64decode(piece['image']['data'],validate=True)) in native_ids.get('cutoutPixelHashes',[]) for piece in garments),'recording_garment_is_not_native_cutout')
            if operation=='describe-piece':
                require(all(pixel_hash(raw) in native_ids.get('cutoutPixelHashes',[]) for raw in media(request)),'recording_describe_original_forbidden')
            run.data['providerCalls']=None
            run.data['relayRequestsAttempted']=len(records)+1
            start=time.monotonic()
            response=client.post(PATHS[operation],json=request,headers={'Authorization':'Bearer '+os.environ['SF_FIREBASE_ID_TOKEN'],'X-Firebase-AppCheck':os.environ['SF_FIREBASE_APP_CHECK_TOKEN']})
            elapsed=round((time.monotonic()-start)*1000)
            try:body=response.json()
            except ValueError:raise RuntimeError('recording_response_not_json') from None
            model=MODELS[operation][1] if 200<=response.status_code<300 else __import__('app.schemas',fromlist=['Error']).Error
            body=TypeAdapter(model).validate_python(body).model_dump(mode='json',exclude_none=True)
            token=body.get('queryToken',response.headers.get('X-Query-Token',token))
            if operation=='search-turn':pending=(body.get('toolCalls') or [None])[0]
            expected=normalize(request,destination,{},generated=assets)
            if 'queryToken' in request:expected['queryToken']='runtime-token'
            ignores=ignored(expected)
            request_record={'expected':expected,'match':[child('',k) for k in expected if child('',k) not in ignores],'ignore':ignores}
            response_record={'status':response.status_code,'body':normalize(body,destination,dict(refs(request)),generated=assets)}
            # Asset expansion and response schema must still validate before write.
            expanded=expand(response_record['body'],destination,request)
            if 'queryToken' in body:expanded['queryToken']='runtime-token'
            TypeAdapter(model).validate_python(expanded)
            (destination/name).write_text(json.dumps(request_record,indent=2)+'\n')
            (destination/name.replace('.request.json','.response.json')).write_text(json.dumps(response_record,indent=2)+'\n')
            records.append({'operation':operation,'statusCode':response.status_code,'elapsedMs':elapsed})
    provenance={'sourceType':'provider-recording','source':'live local relay explicit client','recordedAt':datetime.now(timezone.utc).isoformat(),'runId':run.id,'reviewer':approved['reviewer'],'publicationApproved':False,'assets':assets,'tokenPersistence':False,'requests':records}
    (destination/'provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    return {'records':records,'recordedFixture':str(destination.relative_to(ROOT)),'providerCalls':run.data['providerCalls'],'relayRequests':len(records),'providerCountScope':'actual observed upstream HTTPX attempts, not inferred from relay request count','publicationApproval':'pending; explicit output is not automatically promoted into fixture corpus'}
