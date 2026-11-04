#!/usr/bin/env python3
"""Synthetic relay fixture authoring and independent wire/selector contract checks."""
from pathlib import Path
import argparse
import base64
import copy
import json
import re
import shutil
import sys
from PIL import Image
from pydantic import TypeAdapter

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'relay'))
from app import schemas as wire
FIX=ROOT/'verification/fixtures'
REQUIRED={'normal','shop-specific','time-specific','note-specific','past-trip','not-found','turn-limit','voice-empty','photo-limit','upstream-timeout','tryon-policy','route-unavailable','direct-cut-shop'}
MODELS={
 'search-turn':(wire.SearchTurnRequest,wire.SearchTurnResponse),
 'search-segment':(wire.SearchSegmentRequest,wire.SearchSegmentResponse),
 'transcribe':(wire.TranscribeRequest,wire.TranscribeResponse),
 'describe-storefront':(wire.DescribeRequest,wire.StorefrontResponse),
 'describe-piece':(wire.DescribeRequest,wire.PieceResponse),
 'tryon':(wire.TryOnRequest,wire.TryOnResponse),
 'route':(wire.RouteRequest,wire.RouteResponse)}

def dump(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,indent=2)+'\n')

def pointer(value,path):
 if not path:return value
 if not path.startswith('/') or re.search(r'~(?![01])',path):raise ValueError('invalid pointer')
 for key in path[1:].split('/'):
  key=key.replace('~1','/').replace('~0','~')
  value=value[int(key)] if isinstance(value,list) else value[key]
 return value

def child(path,key):return path+'/'+str(key).replace('~','~0').replace('/','~1')

def mismatch(expected,actual,path,ignore):
 if path in ignore:return None
 if type(expected)!=type(actual):return path
 if isinstance(expected,dict):
  keys=sorted(set(expected)|set(actual))
  for key in keys:
   at=child(path,key)
   if at in ignore:continue
   if key not in expected or key not in actual:return at
   bad=mismatch(expected[key],actual[key],at,ignore)
   if bad is not None:return bad
 elif isinstance(expected,list):
  if len(expected)!=len(actual):return path
  for i,(left,right) in enumerate(zip(expected,actual)):
   bad=mismatch(left,right,child(path,i),ignore)
   if bad is not None:return bad
 elif expected!=actual:return path
 return None

def compare(definition,actual):
 for at in definition['match']:
  try: bad=mismatch(pointer(definition['expected'],at),pointer(actual,at),at,set(definition['ignore']))
  except (KeyError,IndexError,TypeError,ValueError):return at
  if bad is not None:return bad
 return None

def expand(value,directory,request=None,key=''):
 if isinstance(value,dict):
  if set(value)=={'asset'}:
   if key!='data':raise ValueError('asset outside data')
   name=value['asset'];path=directory/name
   if not isinstance(name,str) or not name.startswith('assets/') or '..' in Path(name).parts or path.is_symlink() or directory.resolve() not in path.resolve().parents:raise ValueError('unsafe asset')
   return base64.b64encode(path.read_bytes()).decode()
  return {k:expand(v,directory,request,k) for k,v in value.items()}
 if isinstance(value,list):return [expand(v,directory,request,key) for v in value]
 if isinstance(value,str) and ('{{' in value or '}}' in value):
  match=re.fullmatch(r'\{\{([A-Za-z][A-Za-z0-9_]*(?:(?:\.[A-Za-z][A-Za-z0-9_]*)|(?:\[\d+\]))*)\}\}',value)
  if not match or request is None:raise ValueError('invalid echo')
  tokens=re.findall(r'[A-Za-z][A-Za-z0-9_]*|\d+',match[1]); result=request
  for token in tokens:result=result[int(token)] if isinstance(result,list) else result[token]
  allowed={'photoRef','shopRef','pieceRef','toolCallId','id','photoRefs','shopRefs','pieceRefs'}
  if key not in allowed or tokens[-1] not in allowed or not isinstance(result,str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}',result):raise ValueError('non-ref echo')
  return result
 return value

def tokens(value):
 if isinstance(value,dict):return 'queryToken' in value or any(tokens(v) for v in value.values())
 if isinstance(value,list):return any(tokens(v) for v in value)
 return False

def image(directory,rel,name=None):
 path=FIX/rel;name=name or path.name
 target=directory/'assets'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(path,target)
 with Image.open(path) as im:return {'mimeType':'image/png','data':{'asset':'assets/'+name},'width':im.width,'height':im.height}

def ignored(value,path=''):
 result=[]
 if isinstance(value,dict):
  for key,v in value.items():
   at=child(path,key)
   if key in {'queryToken','toolCallId','photoRef','shopRef','tripRef','pieceRef','takenAt','startedAt','tripStartedAt','tripEndedAt','firstPhotoAt','lastPhotoAt','now','data'}:result.append(at)
   else:result.extend(ignored(v,at))
 elif isinstance(value,list):
  for i,v in enumerate(value):result.extend(ignored(v,child(path,i)))
 return result

def pair(directory,operation,step,request,body,status=200,match=None):
 ignore=ignored(request)
 if match is None:match=[child('',key) for key in request if child('',key) not in ignore]
 dump(directory/f'{operation}.{step:02}.request.json',{'expected':request,'match':match,'ignore':ignore})
 dump(directory/f'{operation}.{step:02}.response.json',{'status':status,'body':body})

def build():
 seed=json.loads((FIX/'store/search.json').read_text())
 visits=[]
 for s in seed['shops']:
  t=next(t for t in seed['trips'] if t['id']==s['tripId']); ps=[p for p in seed['photos'] if p['shopId']==s['id']]
  visits.append({'tripRef':t['id'],'tripStartedAt':t['startedAt'],'tripEndedAt':t['endedAt'],'tripStatus':'ended','shopRef':s['id'],'n':s['n'],'startedAt':s['startedAt'],'descriptionState':s['descriptionState'],**{k:s[k] for k in ('note','description') if k in s},'photoCount':len(ps),'firstPhotoAt':ps[0]['takenAt'],'lastPhotoAt':ps[-1]['takenAt']})
 queries={'normal':'Find the blue jacket','shop-specific':'The blue jacket in the second shop','time-specific':'The jacket I saw 20 min ago','note-specific':'The jacket at the shop I marked vintage','past-trip':'The jacket from Saturday','not-found':'Find the yellow raincoat','turn-limit':'Find the striped coat','photo-limit':'Find the blue jacket','upstream-timeout':'Find the blue jacket'}
 for scenario,query in queries.items():
  directory=FIX/'relay'/scenario
  start={'query':query,'context':{'now':seed['now'],'timeZone':'Asia/Seoul'}}
  pair(directory,'search-turn',1,start,{'toolCalls':[{'id':'visit-call','name':'list_visits','arguments':{}}]})
  visit_result={'toolCallId':'visit-call','name':'list_visits','result':{'visits':visits,'matchingCount':len(visits),'truncated':False}}
  req2={'query':query,'queryToken':'runtime-token','toolResults':[visit_result]}
  args={'phrase':'a yellow raincoat' if scenario=='not-found' else 'a striped coat' if scenario=='turn-limit' else 'a blue jacket','k':3}
  if scenario in {'shop-specific','note-specific','past-trip'}:
   idx=3 if scenario=='past-trip' else 1;args['shopRefs']=[f'{{{{toolResults[0].result.visits[{idx}].shopRef}}}}']
  if scenario=='time-specific':args.update(timeFrom='2026-11-04T13:35:00+09:00',timeTo='2026-11-04T13:45:00+09:00')
  pair(directory,'search-turn',2,req2,{'toolCalls':[{'id':'find-call','name':'find_photos','arguments':args,'phraseVector':[1.0]+[0.0]*511}]})
  selected=[p for p in seed['photos'] if p['tripId']==('saturday' if scenario=='past-trip' else 'today') and p['shopId'].endswith('shop2') and '13:35'<=p['takenAt'][11:16]<'13:45']
  if scenario=='photo-limit':selected=[p for p in seed['photos'] if p['tripId']=='today' and p['shopId'].endswith('shop2')][:3]
  found=[] if scenario=='not-found' else [{'photoRef':p['id'],'shopRef':p['shopId'],'takenAt':p['takenAt'],'score':.95-i*.1} for i,p in enumerate(selected)]
  req3={'query':query,'queryToken':'runtime-token','toolResults':[{'toolCallId':'find-call','name':'find_photos','result':found}]}
  if scenario=='not-found':
   pair(directory,'search-turn',3,req3,{'not_found':{'reason':'No matching yellow raincoat was found.'}});continue
  concept=args['phrase']; refs=[p['photoRef'] for p in found]
  pair(directory,'search-turn',3,req3,{'toolCalls':[{'id':'extract-call','name':'extract_items','arguments':{'photoRefs':[f'{{{{toolResults[0].result[{i}].photoRef}}}}' for i in range(len(refs))],'concept':concept}}]})
  photos=[{'photoRef':ref,'image':image(directory,'images/shops/shop-2-items.png')} for ref in refs]
  segreq={'queryToken':'runtime-token','photos':photos,'concept':concept}
  candidates=[]
  itemcases=json.loads((FIX/'masks/items/cases.json').read_text())['candidates'][4:8]
  for i,c in enumerate(itemcases):
   candidates.append({'id':f'candidate-{i+1}','label':concept,'score':c['score'],'mask':image(directory,c['mask']),'bbox':c['bbox']})
  if scenario=='upstream-timeout':
   pair(directory,'search-segment',1,segreq,{'error':{'code':'upstream_timeout','message':'Upstream timed out','retryable':True}},504)
   stale=directory/'search-turn.04.request.json';stale.unlink(missing_ok=True);stale.with_name('search-turn.04.response.json').unlink(missing_ok=True)
   continue
  else:pair(directory,'search-segment',1,segreq,{'photos':[{'photoRef':f'{{{{photos[{i}].photoRef}}}}','candidates':candidates if i==0 else []} for i in range(len(refs))]})
  req4={'query':query,'queryToken':'runtime-token','toolResults':[{'toolCallId':'extract-call','name':'extract_items','result':[{'photoRef':ref,'candidateCount':4 if i==0 else 0,'topScore':1.0 if i==0 else None} for i,ref in enumerate(refs)]}]}
  final={'not_found':{'reason':'Search limit reached.'}} if scenario=='turn-limit' else {'final':{'photoRefs':[f'{{{{toolResults[0].result[{i}].photoRef}}}}' for i in range(len(refs))],'concept':concept,'summary':'Select the matching garment.'}}
  pair(directory,'search-turn',4,req4,final)
  if scenario=='turn-limit':pair(directory,'search-turn',5,req4,{'error':{'code':'turn_limit_exceeded','message':'Search limit reached','retryable':False}},409)
  if scenario=='photo-limit':
   fourth={'queryToken':'runtime-token','concept':concept,'photos':[photos[0]]}
   pair(directory,'search-segment',4,fourth,{'error':{'code':'photo_limit_exceeded','message':'Photo limit reached','retryable':False}},409)
   for suffix in ('request','response'):(directory/f'search-segment.03.{suffix}.json').unlink(missing_ok=True)
 normal=FIX/'relay/normal'
 # No say speech is redistributed: valid silent WAV exercises mock transport only, native speech is a separate prerequisite.
 for scenario,text in [('normal','Find the blue jacket in the second shop'),('voice-empty','')]:
  directory=FIX/'relay'/scenario;target=directory/'assets/audio.wav';target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(FIX/'audio/silence.wav',target)
  pair(directory,'transcribe',1,{'audio':{'mimeType':'audio/wav','data':{'asset':'assets/audio.wav'}}},{'text':text,'language':'en'},match=['/audio/mimeType'])
 pair(normal,'describe-storefront',1,{'image':image(normal,'images/storefronts/shop-1.png')},{'description':'A blue awning above a dark storefront.'},match=['/image/mimeType'])
 for scenario in ['normal','direct-cut-shop']:
  directory=FIX/'relay'/scenario
  pair(directory,'describe-piece',1,{'image':image(directory,'images/derived/shop-1-candidate-1.png')},{'label':'Blue jacket','category':'jacket'},match=['/image/mimeType'])
 for scenario in ['normal','tryon-policy']:
  directory=FIX/'relay'/scenario
  req={'selfPhoto':{'image':image(directory,'images/derived/calibration-hat-masked.png'),'headMasked':True},'target':{'pieceRef':'target-shop','image':image(directory,'images/derived/shop-1-candidate-1.png'),'label':'Blue jacket','category':'jacket','origin':'shop'},'companions':[{'pieceRef':'wardrobe-jeans','image':image(directory,'images/wardrobe/jeans-cutout.png'),'label':'Jeans','category':'pants','origin':'wardrobe'}]}
  response={'image':image(directory,'images/derived/calibration-hat-masked.png','synthetic-mock-output.png')} if scenario=='normal' else {'error':{'code':'content_policy_violation','message':'Request rejected by policy','retryable':False}}
  pair(directory,'tryon',1,req,response,200 if scenario=='normal' else 400)
 for scenario in ['normal','route-unavailable']:
  directory=FIX/'relay'/scenario
  origin={'lat':37.5454,'lng':127.0555};dest={'lat':37.5445,'lng':127.0555}; coords=[[origin['lng'],origin['lat']],[dest['lng'],dest['lat']+.0002]]
  result={'geometry':{'type':'LineString','coordinates':coords},'distanceM':80,'durationS':64,'steps':[{'distanceM':80,'durationS':64,'name':'Synthetic walkway','maneuver':{'type':'depart','location':coords[0],'bearingBefore':180,'bearingAfter':180}}],'waypoints':[{'location':coords[0],'distanceM':0},{'location':coords[1],'distanceM':22.24}]}
  if scenario=='route-unavailable':result={'error':{'code':'route_unavailable','message':'No walking route available','retryable':False}}
  pair(directory,'route',1,{'origin':origin,'destination':dest},result,200 if scenario=='normal' else 404)
 for scenario in REQUIRED:dump(FIX/'relay'/scenario/'provenance.json',{'sourceType':'hand-authored','providerRecording':False,'purpose':'strict deterministic synthetic wire fixture; not model quality evidence','requestAssetNotation':'data.asset expanded for offline schema validation; all data paths ignored for request matching'})

def validate(root=FIX):
 errors=[];relay=root/'relay'
 for missing in sorted(REQUIRED-{p.name for p in relay.iterdir() if p.is_dir()}):errors.append('missing scenario '+missing)
 for path in sorted(relay.glob('*/*.request.json')):
  try:
   operation,step,_,_=path.name.split('.');assert operation in MODELS and len(step)==2 and step.isdigit()
   spec=json.loads(path.read_text());assert set(spec)=={'expected','match','ignore'}
   assert isinstance(spec['expected'],dict) and all(isinstance(spec[k],list) and all(isinstance(v,str) for v in spec[k]) for k in ('match','ignore'))
   assert spec['match'] and len(set(spec['match']))==len(spec['match']) and len(set(spec['ignore']))==len(spec['ignore']) and not set(spec['match'])&set(spec['ignore'])
   for at in spec['match']+spec['ignore']:
    assert not any(c in at for c in '*{}');pointer(spec['expected'],at)
   assert set(ignored(spec['expected']))<=set(spec['ignore']), 'volatile field is not ignored'
   request=expand(spec['expected'],path.parent)
   TypeAdapter(MODELS[operation][0]).validate_python(request)
   response=json.loads(path.with_name(path.name.replace('.request.','.response.')).read_text())
   assert set(response)<= {'status','body','headers'} and {'status','body'}<=set(response)
   assert not tokens(response),'queryToken stored in response'
   body=expand(response['body'],path.parent,request)
   if response['status']<400 and operation in {'search-turn','search-segment'}:body['queryToken']='runtime-minted-test-token'
   TypeAdapter(MODELS[operation][1] if response['status']<400 else wire.Error).validate_python(body)
   assert compare(spec,spec['expected']) is None
   # Changing ignored values must not select a different response.
   changed=copy.deepcopy(spec['expected'])
   for at in spec['ignore']:
    parts=at.rsplit('/',1);parent=pointer(changed,parts[0]);key=parts[1].replace('~1','/').replace('~0','~');parent[int(key) if isinstance(parent,list) else key]='changed-volatile-value'
   assert compare(spec,changed) is None
  except Exception as exc:errors.append(str(path.relative_to(root))+': '+type(exc).__name__+(' '+str(exc) if isinstance(exc,AssertionError) else ' invalid fixture'))
 return errors

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--build',action='store_true');args=parser.parse_args()
 if args.build:build()
 else:
  errors=validate();print(json.dumps({'status':'failed' if errors else 'passed','errors':errors}));sys.exit(bool(errors))
