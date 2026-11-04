#!/usr/bin/env python3
"""Exercise S01's real loader/token implementation, without Firebase or provider bypasses.

Unit-level contract proof only: authenticated pseudonymous subject is supplied to the
loader directly. This does not claim HTTP authentication or emulator E2E acceptance.
"""
import copy
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path(os.environ.get('SF_RELAY_SOURCE',ROOT/'relay')).resolve()
FIX=Path(os.environ.get('SF_FIXTURES_DIR',ROOT/'verification/fixtures')).resolve()/'relay'
sys.path.insert(0,str(SOURCE))

def main():
 if not (SOURCE/'app/mock.py').is_file():
  print(json.dumps({'status':'blocked','prerequisite':'Merged S01 FixtureLoader and QueryTokens implementation','source':str(SOURCE)}));return 2
 from app.mock import FixtureLoader
 from app.token import QueryTokens
 from app.errors import RelayError
 from relay_fixtures import expand
 clock=[1793797200];tokens=QueryTokens(secrets.token_bytes(32),clock=lambda:clock[0]);sub=hashlib.sha256(b'S11 fixture contract subject').hexdigest();loader=FixtureLoader(FIX);checks=[];chains=[]
 def request(scenario,operation,step):
  directory=FIX/scenario
  return expand(json.loads((directory/f'{operation}.{step:02}.request.json').read_text())['expected'],directory)
 def expect_error(action,code,status,pointer=None):
  try:action()
  except RelayError as exc:
   assert (exc.code,exc.status)==(code,status),(exc.code,exc.status,code,status)
   if pointer:assert exc.message=='Fixture request mismatch at '+pointer
   return exc
  raise AssertionError('Expected '+code)
 def replay(scenario,operation,step,body):
  item,state=loader.prepare(scenario,operation,step,body,tokens=tokens,sub=sub)
  if state is None:return item.result()
  before=(state.sparkTurns,state.samPhotos)
  with tokens.attempt(state,'spark' if operation=='search-turn' else 'sam',photos=len(body.get('photos',[]))) as used:
   result=item.result(tokens=tokens,state=used)
  after=tokens.verify(result['queryToken'],sub,scenario=scenario)
  assert (after.sparkTurns,after.samPhotos)==(before[0]+(operation=='search-turn'),before[1]+(len(body['photos']) if operation=='search-segment' else 0))
  return result
 for directory in sorted(FIX.iterdir()):
  if not directory.is_dir():continue
  scenario=directory.name;latest=None;steps=[]
  if (directory/'search-turn.01.request.json').exists():
   sequence=[('search-turn',1),('search-turn',2),('search-turn',3)]
   if (directory/'search-segment.01.request.json').exists():sequence.append(('search-segment',1))
   # Budget rejection is probed while extract_items is still pending.
   if scenario=='photo-limit':sequence.append(('search-segment',4))
   if (directory/'search-turn.04.request.json').exists():sequence.append(('search-turn',4))
   if scenario=='turn-limit':sequence.append(('search-turn',5))
   for operation,step in sequence:
    body=request(scenario,operation,step)
    if 'queryToken' in body:body['queryToken']=latest
    envelope=json.loads((directory/f'{operation}.{step:02}.response.json').read_text())
    if envelope['status']!=200:
     exc=expect_error(lambda:replay(scenario,operation,step,body),envelope['body']['error']['code'],envelope['status'])
     if scenario=='upstream-timeout':
      state=tokens.verify(exc.headers['X-Query-Token'],sub,scenario=scenario);assert state.closed and state.samPhotos==len(body['photos'])
      checks.append('timeout closes and consumes latest token')
     else:checks.append(scenario+' rejected before replay/provider attempt')
    else:
     output=replay(scenario,operation,step,body);assert output['queryToken']!=latest;latest=output['queryToken']
     state=tokens.verify(latest,sub,scenario=scenario)
     assert not any('phraseVector' in entry.get('call',{}) for entry in state.history)
    steps.append([operation,step,envelope['status']])
   chains.append({'scenario':scenario,'steps':steps})
  for path in sorted(directory.glob('*.request.json')):
   operation,step,_,_=path.name.split('.')
   if operation.startswith('search-'):continue
   body=request(scenario,operation,int(step));envelope=json.loads(path.with_name(path.name.replace('.request.','.response.')).read_text())
   if envelope['status']==200:replay(scenario,operation,int(step),body)
   else:expect_error(lambda:replay(scenario,operation,int(step),body),envelope['body']['error']['code'],envelope['status'])
 base=request('normal','search-turn',1);changed=copy.deepcopy(base);changed['query']='Different semantic query'
 expect_error(lambda:loader.prepare('normal','search-turn',1,changed,tokens=tokens,sub=sub),'fixture_request_mismatch',409,'/query');checks.append('semantic mutation ->409 first JSON pointer only')
 changed=copy.deepcopy(base);changed['context']['now']='2026-11-04T15:01:00+09:00';result=replay('normal','search-turn',1,changed);assert tokens.verify(result['queryToken'],sub,scenario='normal').context['now']==changed['context']['now'];checks.append('ignored timestamp replays and token records actual timestamp')
 expect_error(lambda:loader.prepare('unregistered','search-turn',1,base,tokens=tokens,sub=sub),'fixture_not_found',501);checks.append('missing scenario key ->501 without fallback')
 bad=request('normal','describe-piece',1);bad['image']['data']='not-base64!'
 expect_error(lambda:loader.prepare('normal','describe-piece',1,bad),'invalid_request',400);checks.append('ignored media still validated')
 bad=request('normal','search-turn',2);bad['queryToken']='forged.invalid'
 expect_error(lambda:loader.prepare('normal','search-turn',2,bad,tokens=tokens,sub=sub),'invalid_query_token',401);checks.append('ignored token still authenticated')
 expect_error(lambda:tokens.verify(result['queryToken'],'0'*64,scenario='normal'),'invalid_query_token',401);checks.append('token subject binding')
 clock[0]+=900;expect_error(lambda:tokens.verify(result['queryToken'],sub,scenario='normal'),'query_token_expired',401);clock[0]-=900;checks.append('15-minute expiry')
 with tempfile.TemporaryDirectory() as temp:
  target=Path(temp)/'normal';shutil.copytree(FIX/'normal',target);fixture=target/'describe-piece.01.response.json';body=json.loads(fixture.read_text());body['body']['label']='{{image.width}}';fixture.write_text(json.dumps(body))
  expect_error(lambda:FixtureLoader(temp).prepare('normal','describe-piece',1,request('normal','describe-piece',1)),'fixture_invalid',500);checks.append('non-ref echo ->500')
  body['body']={'label':'Blue jacket','category':'jacket','queryToken':'forbidden'};fixture.write_text(json.dumps(body))
  expect_error(lambda:FixtureLoader(temp).prepare('normal','describe-piece',1,request('normal','describe-piece',1)),'fixture_invalid',500);checks.append('recorded response token forbidden')
 result={'status':'passed','source':str(SOURCE),'sourceHashes':{name:hashlib.sha256((SOURCE/'app'/name).read_bytes()).hexdigest() for name in ['mock.py','token.py','schemas.py']},'checks':checks,'chains':chains,'providerCalls':0,'boundary':'Direct production loader/token contract, not HTTP authentication or E2E'}
 print(json.dumps(result,indent=2));return 0
if __name__=='__main__':
 try:sys.exit(main())
 except Exception as exc:print(json.dumps({'status':'failed','errorType':type(exc).__name__,'detail':str(exc) if isinstance(exc,AssertionError) else 'Production fixture contract rejected input'}));sys.exit(1)
