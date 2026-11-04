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
from PIL import Image
from pydantic import ValidationError
from relay_fixtures import FIX, ROOT, validate as validate_relay, wire, compare, expand


def drift():
 errors=[]
 with tempfile.TemporaryDirectory() as temp:
  output=Path(temp)/'openapi.json'
  result=subprocess.run([sys.executable,str(ROOT/'relay/scripts/export_openapi.py'),'--output',str(output)],cwd=ROOT/'relay',capture_output=True)
  if result.returncode or not output.exists():errors.append('OpenAPI regeneration failed')
  elif output.read_bytes()!=(ROOT/'relay/openapi.json').read_bytes():errors.append('OpenAPI drift')
  result=subprocess.run(['npx','--no-install','openapi-typescript',str(ROOT/'relay/openapi.json'),'-o',str(Path(temp)/'relay.ts')],cwd=ROOT/'app',capture_output=True)
  candidates=list((ROOT/'app/src').glob('**/*generated*.ts'))+list((ROOT/'app/src/relay').glob('schema*.ts'))
  if result.returncode:errors.append('Generated TypeScript regeneration failed')
  else:
   generated=(Path(temp)/'relay.ts').read_bytes()
   # Locate the established generated artifact, never overwrite a caller or accept no baseline.
   exact=[p for p in (ROOT/'app/src').rglob('*.ts') if p.read_bytes()==generated]
   if not exact:errors.append('Generated TypeScript drift or baseline missing')
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
 for entry in entries:
  rel=entry['path'];path=FIX/rel
  try:
   assert FIX.resolve() in path.resolve().parents and not path.is_symlink()
   assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256'],'hash'
   assert path.stat().st_size==entry['bytes'],'size'
   for key in ['mimeType','sourceType','generator','sourceId','procedure','terms','parents','consumers']:assert key in entry,key
   assert entry['terms']['url'] and entry['terms']['checkedAt']
   if not entry['terms']['publicUseApproved']:blocked.append(rel+': public use not approved')
   for parent in entry['parents']:assert hashlib.sha256((FIX/parent['path']).read_bytes()).hexdigest()==parent['sha256'],'parent hash'
   if entry.get('expectedDecodeFailure'):
    try:
     with Image.open(path) as image:image.load()
    except OSError:continue
    raise AssertionError('corrupt input unexpectedly decoded')
   if path.suffix in {'.png','.jpg','.jpeg'}:
    with Image.open(path) as image:
     image.load();assert image.size==(entry['width'],entry['height']);assert getattr(image,'n_frames',1)==1
     if rel.startswith('masks/'):
      assert image.mode=='L' and set(image.getdata())<={0,255},'nonbinary mask'
   if path.suffix=='.wav':
    raw=path.read_bytes()
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
  except Exception as exc:errors.append(rel+': '+type(exc).__name__+' '+str(exc))
 actual={str(p.relative_to(FIX)) for p in FIX.rglob('*') if p.is_file() and p!=FIX/'manifest.json' and '__pycache__' not in p.parts}
 errors.extend('unmanifested '+p for p in sorted(actual-known))
 for required in ['audio/query.wav','voice/normal/01-query.wav']:
  if required not in known:blocked.append(required+': licensed/publicly redistributable speech input required')
 review=json.loads((FIX/'review/head.json').read_text())
 for case in review['cases']:
  if case.get('expectedRegistration'):
   gt=case.get('groundTruthMask')
   if not gt or case.get('status')!='human-approved' or not all(case.get(k) for k in ['annotator','annotatedAt','reviewer','reviewedAt']):blocked.append(case['id']+': human head GT annotation/approval required');continue
   with Image.open(FIX/gt) as mask,Image.open(FIX/case['image']) as src:
    if mask.size!=src.size or mask.mode!='L' or not set(mask.getdata())<={0,255}:errors.append(case['id']+': invalid approved GT')
  elif case.get('status')!='human-approved':blocked.append(case['id']+': human classification review required')
 items=json.loads((FIX/'masks/items/cases.json').read_text())
 if not items.get('reviewer') or not items.get('reviewedAt'):blocked.append('item masks: human review required')
 assert len(items['candidates'])>=4 and len(items['tapMasks'])==3
 seed=json.loads((FIX/'store/search.json').read_text())
 for p in seed['photos']:
  vector=p['vector']
  if len(vector)!=512 or any(not math.isfinite(v) for v in vector) or abs(sum(v*v for v in vector)-1)>1e-5:errors.append('invalid seed vector')
 if any(t['id']=='today' for t in json.loads((FIX/'store/e2e.json').read_text())['trips']):errors.append('E2E current trip preseeded')
 research=json.loads((FIX/'research/retrieval/results.json').read_text())
 if research['image_count']!=22 or len(research['queries'])!=7:errors.append('original research corpus not 22 images / 7 queries')
 return errors,blocked,len(entries)

def main():
 parser=argparse.ArgumentParser();group=parser.add_mutually_exclusive_group(required=True);group.add_argument('--all',action='store_true');group.add_argument('--relay',action='store_true');args=parser.parse_args()
 errors=validate_relay();blocked=[];count=None
 errors+=drift()
 try:checks=selector_checks()
 except Exception as exc:errors.append('selector boundary failure: '+type(exc).__name__);checks={}
 if args.all:
  more,blocked,count=validate_all();errors+=more
 runtime=subprocess.run([sys.executable,str(ROOT/'scripts/e2e/relay_runtime.py')],capture_output=True,text=True)
 try:runtime_proof=json.loads(runtime.stdout)
 except json.JSONDecodeError:runtime_proof={'status':'failed','detail':'Runtime probe did not emit a safe JSON result'}
 if runtime.returncode==2:blocked.append('S01 production replay runtime unavailable')
 elif runtime.returncode:errors.append('S01 production replay contract failed: '+runtime_proof.get('detail',runtime_proof.get('errorType','unknown')))
 status='failed' if errors else 'blocked' if blocked else 'passed'
 result={'status':status,'mode':'all' if args.all else 'relay','assets':count,'errors':errors,'blocked':blocked,'checks':checks,'runtime':runtime_proof,'providerCalls':0,'note':'Structural and direct production replay/token checks; actual HTTP Firebase authentication and full mock/live emulator E2E remain mandatory.'}
 destination=ROOT/'verification/results/2026-11-04-s11-fixtures';destination.mkdir(parents=True,exist_ok=True);(destination/('validate-all.json' if args.all else 'validate-relay.json')).write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2));return 1 if errors else 2 if blocked else 0

if __name__=='__main__':sys.exit(main())
