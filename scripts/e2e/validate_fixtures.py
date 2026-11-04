#!/usr/bin/env python3
"""Fail closed on asset/schema corruption and missing human/publication approvals."""
import argparse
import base64
import hashlib
import json
import math
import subprocess
import sys
import tempfile
import wave
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path
import re
from uuid import uuid4
from PIL import Image
from pydantic import ValidationError
from relay_fixtures import FIX, ROOT, validate as validate_relay, wire, compare, expand
from import_review import asset_path, provenance, timestamp, check_item, check_speech
from build_fixtures import digest


def drift():
 errors=[]
 with tempfile.TemporaryDirectory() as temp:
  output=Path(temp)/'openapi.json'
  result=subprocess.run([sys.executable,str(ROOT/'relay/scripts/export_openapi.py'),'--output',str(output)],cwd=ROOT/'relay',capture_output=True)
  if result.returncode or not output.exists():errors.append('OpenAPI regeneration failed')
  elif output.read_bytes()!=(ROOT/'relay/openapi.json').read_bytes():errors.append('OpenAPI drift')
  result=subprocess.run(['npx','--no-install','openapi-typescript',str(ROOT/'relay/openapi.json'),'-o',str(Path(temp)/'relay.ts')],cwd=ROOT/'app',capture_output=True)
  baseline=ROOT/'app/src/generated/relay-api.d.ts'
  if result.returncode:errors.append('Generated TypeScript regeneration failed')
  elif not baseline.exists() or baseline.read_bytes()!=(Path(temp)/'relay.ts').read_bytes():errors.append('Generated TypeScript drift')
 return errors

def selector_checks():
 spec={'expected':{'a':{'id':'old','value':1},'list':[1,2]},'match':['/a','/list'],'ignore':['/a/id']}
 assert compare(spec,{'a':{'id':'new','value':2},'list':[1,2]})=='/a/value'
 assert compare(spec,{'a':{'id':'new','value':1},'list':[2,1]})=='/list/0'
 assert compare(spec,{'a':{'id':'new','value':1},'list':[1,2]}) is None
 for invalid in ['{{missing.photoRef}}','{{query}}','prefix{{photos[0].photoRef}}']:
  try:expand({'photoRef':invalid},FIX,{'query':'some query'})
  except (ValueError,KeyError,TypeError,IndexError):pass
  else:raise AssertionError('invalid echo accepted')
 try:wire.Audio.model_validate({'mimeType':'audio/wav','data':base64.b64encode((FIX/'audio/over-15s.wav').read_bytes()).decode()})
 except ValidationError:pass
 else:raise AssertionError('over-15s WAV accepted')
 return {'semanticMismatchPointer':True,'ignoredValueComparisonOnly':True,'arrayOrderPreserved':True,'invalidEchoRejected':True,'audioBoundaryRejected':True,'runtimeTokenAuthentication':'S01 integration required; offline validator does not impersonate token verifier'}

def validate_all():
 errors=[];blocked=[]
 manifest=json.loads((FIX/'manifest.json').read_text());entries=manifest['assets'];known={e['path'] for e in entries}
 if len(known)!=len(entries):errors.append('duplicate manifest asset paths')
 approvals_path=FIX/'review/asset-approval.json'
 approvals=json.loads(approvals_path.read_text()).get('assets',{}) if approvals_path.exists() else {}
 generation=json.loads((FIX/'source/generation.json').read_text())
 originals={item['path']:item for item in generation['outputs']}
 for entry in entries:
  rel=entry['path']
  try:
   path=asset_path(rel)
   assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256'],'hash'
   assert path.stat().st_size==entry['bytes'],'size'
   for key in ['mimeType','sourceType','generator','sourceId','procedure','terms','parents','consumers']:assert key in entry,key
   assert entry['terms']['url'] and entry['terms']['checkedAt']
   assert type(entry['terms']['publicUseApproved']) is bool,'approval boolean'
   if entry['sourceType']=='unverified':errors.append(rel+': unmapped source provenance')
   requires_review=entry['sourceType'] in {'codex-generated','derived','original-research','human-annotation'} or rel.startswith(('images/','capture/','masks/'))
   if requires_review and entry['terms']['publicUseApproved']:
    approval=approvals.get(rel,{})
    provenance(approval)
    assert approval.get('sha256')==entry['sha256'] and approval.get('publicUseApproved') is True and approval.get('permission') and approval.get('termsUrl'),'approval evidence'
   if rel in originals:
    assert entry['sourceId']==originals[rel]['sourceId'] and entry['procedure']==originals[rel]['prompt'] and entry['sha256']==originals[rel]['sha256'],'generation evidence'
   if not entry['terms']['publicUseApproved']:blocked.append(rel+': public use not approved')
   for parent in entry['parents']:
    assert parent['path'] in known and digest(asset_path(parent['path']))==parent['sha256'],'parent hash'
   if entry.get('expectedDecodeFailure'):
    assert rel in {'capture-cases/corrupt/01-corrupt.png','voice/corrupt/01-corrupt.wav'},'undeclared corrupt fixture'
    try:
     if path.suffix=='.wav':
      with wave.open(str(path),'rb') as audio:audio.readframes(audio.getnframes())
     else:
      with Image.open(path) as image:image.load()
    except (OSError,EOFError,wave.Error):continue
    raise AssertionError('corrupt input unexpectedly decoded')
   if path.suffix in {'.png','.jpg','.jpeg'}:
    with Image.open(path) as image:
     image.load();assert image.size==(entry['width'],entry['height']);assert getattr(image,'n_frames',1)==1
     if rel.startswith('masks/'):
      assert image.mode=='L' and set(image.getdata())<={0,255},'nonbinary mask'
   if path.suffix=='.wav':
    raw=path.read_bytes()
    with wave.open(str(path),'rb') as wav:
     assert (wav.getnframes(),wav.getframerate(),wav.getnchannels(),wav.getsampwidth())==(entry['samples'],entry['sampleRate'],entry['channels'],entry['sampleWidth']),'audio metadata'
     assert len(wav.readframes(wav.getnframes()))==wav.getnframes()*wav.getnchannels()*wav.getsampwidth(),'truncated audio'
    expected_samples={'silence':80000,'limit-15s':240000,'over-15s':240001,'tone-silence':22400,'leading-5s':86400}
    if rel.startswith('audio/') and path.stem in expected_samples:assert entry['samples']==expected_samples[path.stem],'audio sample boundary'
    if 'over-15s' in rel:
     try:wire.Audio.model_validate({'mimeType':'audio/wav','data':base64.b64encode(raw).decode()})
     except ValidationError:pass
     else:raise AssertionError('negative WAV unexpectedly accepted')
    else:wire.Audio.model_validate({'mimeType':'audio/wav','data':base64.b64encode(raw).decode()})
    if rel=='audio/query.wav':
     with wave.open(str(path),'rb') as wav: samples=wav.readframes(wav.getnframes());assert samples[-32000:]==b'\0'*32000 and any(samples[:-32000]),'missing VAD speech/trailing silence'
   if path.suffix=='.gpx':
    root=ET.parse(path).getroot();points=root.findall('.//{*}trkpt');assert len(points)>=2
    times=[]
    for point in points:
     assert -90<=float(point.attrib['lat'])<=90 and -180<=float(point.attrib['lon'])<=180
     times.append(datetime.fromisoformat(point.find('{*}time').text.replace('Z','+00:00')))
    assert all(a<b for a,b in zip(times,times[1:])), 'nonincreasing timestamps'
    side=json.loads(path.with_suffix('.expected.json').read_text());assert len(side['checkpoints'])==len(points)
    for i,(point,checkpoint) in enumerate(zip(points,side['checkpoints'])):
     assert checkpoint['index']==i and checkpoint['elapsedS']==(times[i]-times[0]).total_seconds(),'GPX checkpoint identity'
     assert type(checkpoint['accuracyM']) in (int,float) and math.isfinite(checkpoint['accuracyM']) and checkpoint['accuracyM']>=0
    assert side['destination']!=side['shopSpot'] and side['destination']!=side['routeWaypoint'],'walk destination distinction'
  except Exception as exc:errors.append(rel+': '+type(exc).__name__+' structural validation failed')
 actual={str(p.relative_to(FIX)) for p in FIX.rglob('*') if p.is_file() and p!=FIX/'manifest.json' and '__pycache__' not in p.parts and p.name!='.DS_Store'}
 # Non-distributable local speech is intentionally outside the portable corpus.
 local_speech={'audio/query.wav','voice/normal/01-query.wav'}
 errors.extend('unmanifested '+p for p in sorted(actual-known-local_speech))
 for required in sorted(local_speech):
  if required not in known:blocked.append(required+': licensed/publicly redistributable speech input required')
 speech_path=FIX/'audio/speech-source.json'
 if local_speech<=known:
  try:
   speech=json.loads(speech_path.read_text());check_speech(speech,asset_path('audio/query.wav'))
   assert digest(asset_path('voice/normal/01-query.wav'))==speech['sha256'],'speech staging differs'
  except Exception:errors.append('speech consent, canonical WAV or staging validation failed')
 review=json.loads((FIX/'review/head.json').read_text())
 cases=review['cases'];ids=[case['id'] for case in cases]
 required={'long-hair','hat','calibration-long-hair','calibration-hat','heldout-long-hair','heldout-hat','half-body','neck-hidden','multiple-people','cropped-head','hanger','mannequin'}
 if len(ids)!=len(set(ids)) or set(ids)!=required:errors.append('frozen head case identities differ')
 for case in cases:
  try:
   assert digest(asset_path(case['image']))==case['sourceSha256'],'frozen source hash changed'
   assert type(case['expectedRegistration']) is bool and type(case['expectedPerson']) is bool
   if case.get('status')!='human-approved':
    blocked.append(case['id']+': human head GT annotation/approval required' if case['expectedRegistration'] else case['id']+': human classification review required')
    continue
   provenance(case);assert case.get('annotator') and timestamp(case['annotatedAt'])<=timestamp(case['reviewedAt'])
   if case['expectedRegistration']:
    gt=case.get('groundTruthMask');assert gt in known and digest(asset_path(gt))==case['groundTruthSha256'],'head GT identity'
    with Image.open(asset_path(gt)) as mask,Image.open(asset_path(case['image'])) as src:
     assert mask.size==src.size and mask.mode=='L' and set(mask.getdata())=={0,255},'invalid approved GT'
  except Exception:errors.append(case['id']+': frozen head review validation failed')
 items=json.loads((FIX/'masks/items/cases.json').read_text())
 if not items.get('reviewer') or not items.get('reviewedAt'):blocked.append('item masks: human review required')
 else:
  try:provenance(items)
  except Exception:errors.append('invalid item review provenance')
 candidates=items['candidates']
 if len(candidates)<4 or len(items['tapMasks'])!=3 or len(set(items['tapMasks']))!=3 or not set(items['tapMasks'])<={c['mask'] for c in candidates}:errors.append('invalid candidate/tap-mask inventory')
 for item in candidates:
  try:
   check_item(item)
   assert type(item['score']) in (int,float) and math.isfinite(item['score']) and 0<=item['score']<=1
   if items.get('reviewer'):
    assert item.get('annotationStatus')=='human-reviewed' and digest(asset_path(item['image']))==item['sourceSha256'] and digest(asset_path(item['mask']))==item['maskSha256'],'item approval identity'
  except Exception:errors.append(item.get('mask','item')+': mask/cutout/review validation failed')
 seed=json.loads((FIX/'store/search.json').read_text())
 for p in seed['photos']:
  vector=p['vector']
  if len(vector)!=512 or any(not math.isfinite(v) for v in vector) or abs(sum(v*v for v in vector)-1)>1e-5:errors.append('invalid seed vector')
 if any(t['id']=='today' for t in json.loads((FIX/'store/e2e.json').read_text())['trips']):errors.append('E2E current trip preseeded')
 research_path=FIX/'research/retrieval/results.json'
 if not research_path.exists():blocked.append('research/retrieval/results.json: M1 original 22-image/7-query research corpus required')
 else:
  research=json.loads(research_path.read_text())
  if research['image_count']!=22 or len(research['queries'])!=7:errors.append('original research corpus not 22 images / 7 queries')
  required_research=['research/preservation.json','research/preprocessing.json','research/retrieval/manifest.json','research/retrieval/image_embeddings.npy','research/tap/rack.jpg','research/tap/shop.jpg','research/tap/rack_masks.npz','research/tap/shop_masks.npz']
  for relative in required_research:
   if not (FIX/relative).exists():blocked.append(relative+': original corpus/reference metadata required')
  preservation=FIX/'research/preservation.json'
  if preservation.exists():
   preserved=json.loads(preservation.read_text())['entries']
   recorded={entry['path'] for entry in preserved}
   if not preserved or len(recorded)!=len(preserved):errors.append('empty or duplicate research preservation inventory')
   expected={str(p.relative_to(FIX)) for folder in ['research/retrieval','research/tap'] for p in (FIX/folder).rglob('*') if p.is_file()}
   if not expected<=recorded:errors.append('research originals absent from preservation inventory')
   for original in preserved:
    try:assert original['unaltered'] is True and original['source'] and digest(asset_path(original['path']))==original['sha256']
    except Exception:errors.append('research preserved hash mismatch')
  original_manifest=FIX/'research/retrieval/manifest.json'
  if original_manifest.exists():
   rows=json.loads(original_manifest.read_text())['images']
   if len(rows)!=22 or len({row['id'] for row in rows})!=22:errors.append('research image inventory must contain 22 distinct originals')
   for row in rows:
    if not (FIX/'research/retrieval'/Path(row['path']).name).is_file():errors.append('research source image missing: '+row['id'])
  vectors=FIX/'research/retrieval/image_embeddings.npy'
  if vectors.exists():
   import numpy as np
   matrix=np.load(vectors,allow_pickle=False)
   if matrix.shape!=(22,512) or not np.isfinite(matrix).all() or not np.allclose(np.linalg.norm(matrix,axis=1),1,atol=1e-4):errors.append('research embeddings must be finite normalized 22x512 originals')
  preprocessing=FIX/'research/preprocessing.json'
  if preprocessing.exists():
   metadata=json.loads(preprocessing.read_text())
   for model in ['pe','edgetam']:
    value=metadata.get(model,{})
    if not re.fullmatch('[a-f0-9]{40}',value.get('revision','')) or not value.get('input'):errors.append('research exact revision/preprocessing missing: '+model)
 split=json.loads((FIX/'quality/cases.json').read_text())
 if len(split['calibration'])!=2 or len(split['heldOut'])!=2 or set(split['calibration'])&set(split['heldOut']):errors.append('invalid frozen calibration/held-out split')
 if not set(split['calibration']+split['heldOut'])<={case['id'] for case in review['cases']}:errors.append('quality split references absent head case')
 for path in FIX.rglob('*.json'):
  # Token sentinels used by strict replay are not credentials.
  text=path.read_text()
  if re.search(r'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|Bearer [A-Za-z0-9_-]{30,}|\"(?:private_key|access_token|id_token)\"\\s*:\\s*\"[^\" ]+',text):errors.append(str(path.relative_to(FIX))+': secret-like material forbidden')
 return errors,blocked,len(entries)

def main():
 parser=argparse.ArgumentParser();group=parser.add_mutually_exclusive_group(required=True);group.add_argument('--all',action='store_true');group.add_argument('--relay',action='store_true');parser.add_argument('--output',type=Path);args=parser.parse_args()
 errors=validate_relay();blocked=[];count=None
 errors+=drift()
 try:checks=selector_checks()
 except Exception as exc:errors.append('selector boundary failure: '+type(exc).__name__);checks={}
 if args.all:
  try:more,blocked,count=validate_all();errors+=more
  except Exception as exc:errors.append('Corpus structure rejected: '+type(exc).__name__)
 runtime=subprocess.run([sys.executable,str(ROOT/'scripts/e2e/relay_runtime.py')],capture_output=True,text=True)
 try:runtime_proof=json.loads(runtime.stdout)
 except json.JSONDecodeError:runtime_proof={'status':'failed','detail':'Runtime probe did not emit a safe JSON result'}
 if runtime.returncode==2:blocked.append('S01 production replay runtime unavailable')
 elif runtime.returncode:errors.append('S01 production replay contract failed: '+runtime_proof.get('detail',runtime_proof.get('errorType','unknown')))
 status='failed' if errors else 'blocked' if blocked else 'passed'
 result={'status':status,'mode':'all' if args.all else 'relay','assets':count,'errors':errors,'blocked':blocked,'checks':checks,'runtime':runtime_proof,'providerCalls':0,'note':'Structural and direct production replay/token checks; actual HTTP Firebase authentication and full mock/live emulator E2E remain mandatory.'}
 if args.output:
  args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,indent=2)+'\n')
 else:
  destination=ROOT/'verification/results'/('s11-fixtures-'+datetime.now().strftime('%Y%m%dT%H%M%S')+'-'+uuid4().hex[:8]);destination.mkdir(parents=True,exist_ok=False);(destination/('validate-all.json' if args.all else 'validate-relay.json')).write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2));return 1 if errors else 2 if blocked else 0

if __name__=='__main__':sys.exit(main())
