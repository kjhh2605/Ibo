"""S11-only ASGI/HTTPX observer. No production route or logger changes.
Run uvicorn privacy_capture:create_app --factory with scripts/e2e on PYTHONPATH.
Bodies are inspected in memory; only assertion booleans/counts are written at shutdown.
"""
import base64
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import re
import sys
from urllib.parse import urlsplit
from PIL import Image
import httpx

ROOT=Path(__file__).resolve().parents[2]
FIX=ROOT/'verification/fixtures'
FORBIDDEN={'lat','lng','latitude','longitude','coordinates','trail','trailpoints','location','walkto','spot','headmask','rawself','originalselfphoto'}
META_HOST='api.meta.ai'

def pixel_hash(raw):
 with Image.open(io.BytesIO(raw)) as image:
  image.load();return hashlib.sha256(str(image.size).encode()+image.convert('RGBA').tobytes()).hexdigest()

def fields(value):
 if isinstance(value,dict):
  for key,child in value.items():
   yield key.lower();yield from fields(child)
 elif isinstance(value,list):
  for child in value:yield from fields(child)

def media(value):
 if isinstance(value,dict):
  if value.get('mimeType','').startswith('image/') and isinstance(value.get('data'),str):yield base64.b64decode(value['data'],validate=True)
  for child in value.values():yield from media(child)
 elif isinstance(value,list):
  for child in value:yield from media(child)
 elif isinstance(value,str) and value.startswith('data:image/'):
  yield base64.b64decode(value.split(',',1)[1],validate=True)

class Observer:
 def __init__(self):
  self.records=[];self.failures=[];self.logs=0;self.writes=0;self.db=0
  self.raw={pixel_hash(path.read_bytes()) for path in (FIX/'images/self').rglob('*.png')}
  self.head_bytes={hashlib.sha256(path.read_bytes()).hexdigest() for path in (FIX/'masks/head').glob('*.png')}
  self.allowed_cutouts={pixel_hash(path.read_bytes()) for folder in ['images/derived','images/wardrobe'] for path in (FIX/folder).glob('*cutout*.png')}
  self.allowed_cutouts.update(pixel_hash(path.read_bytes()) for path in (FIX/'images/derived').glob('*candidate*.png'))
 def require(self,condition,code):
  if not condition:self.failures.append(code);raise AssertionError(code)
 def inspect(self,boundary,path,value,host=None):
  keys=set(fields(value));images=list(media(value));raw_absent=all(pixel_hash(image) not in self.raw for image in images)
  self.require(raw_absent,'raw-self-at-'+boundary)
  self.require(all(hashlib.sha256(image).hexdigest() not in self.head_bytes for image in images),'head-gt-at-'+boundary)
  is_route=path=='/v1/route' or host is not None and 'osrm' in host
  if not is_route:self.require(not(keys&FORBIDDEN),'forbidden-coordinate-or-device-field-at-'+boundary)
  if path=='/v1/search/turn':
   self.require(not images and not({'embedding','phrasevector','mask','image','audio'}&keys),'search-summary-private-payload')
   if value.get('queryToken'):
    encoded=value['queryToken'].split('.')[0]
    token=json.loads(base64.urlsafe_b64decode(encoded+'='*(-len(encoded)%4)))
    self.require(not(set(fields(token))&(FORBIDDEN|{'phrasevector','image','audio','embedding','mask'})),'query-history-private-payload')
  if path=='/v1/describe-piece':self.require(bool(images) and all(pixel_hash(x) in self.allowed_cutouts for x in images),'describe-piece-not-approved-cutout')
  if path=='/v1/tryon':
   self.require(value['selfPhoto']['headMasked'] is True,'unmasked-self-tag')
   self.require(value['target']['origin']=='shop' and 0<=len(value['companions'])<=5,'tryon-input-boundary')
  if boundary=='outbound':
   self.require(host==META_HOST or host is not None and 'osrm' in host,'unexpected-outbound-host')
   if host==META_HOST:
    self.require(not(keys&FORBIDDEN),'coordinates-to-meta')
    if 'safety_identifier' in value:self.require(bool(re.fullmatch('[0-9a-f]{64}',value['safety_identifier'])),'raw-identity-to-meta')
  self.records.append({'boundary':boundary,'operation':path if path.startswith('/v1/') else 'provider','hostClass':'meta' if host==META_HOST else 'route' if host and 'osrm' in host else None,'rawSelfAbsent':raw_absent,'imageCount':len(images),'coordinateFieldsAllowedOnlyForRoute':is_route,'passed':True})
 def audit(self,event,args):
  if event=='sqlite3.connect':self.db+=1;self.failures.append('relay-opened-database')
  if event=='open' and len(args)>1:
   mode=args[1];flags=args[2] if len(args)>2 else 0
   if isinstance(mode,str) and any(c in mode for c in 'wax+') or isinstance(flags,int) and flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT):
    self.writes+=1;self.failures.append('relay-file-write-observed')
 def log(self,record):
  if not record.name.startswith('street_fitting'):return
  self.logs+=1
  try:
   value=json.loads(record.getMessage());allowed={'endpoint','pseudonymousId','latencyMs','statusCode','sparkTurns'}
   if os.environ.get('SF_LOG_TEXT')=='1':allowed|={'queryText','sparkText'}
   self.require(not(set(value)-allowed),'nonmetadata-log-fields')
   self.require(not(set(fields(value))&FORBIDDEN),'coordinate-log-fields')
   text=json.dumps(value)
   self.require(not re.search(r'Bearer |data:image|data:audio|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',text),'secret-or-media-in-log')
  except Exception:self.failures.append('unsafe-log-record')
 def report(self):return {'status':'failed' if self.failures else 'passed','boundary':'memory-only application ingress and real HTTPX outbound observer','records':self.records,'failures':sorted(set(self.failures)),'logRecords':self.logs,'relayWriteAttempts':self.writes,'relayDatabaseOpens':self.db,'rawBodiesPersisted':False}

class CaptureLog(logging.Handler):
 def __init__(self,observer):super().__init__();self.observer=observer
 def emit(self,record):self.observer.log(record)

class CaptureApp:
 def __init__(self,app,observer):self.app,self.observer=app,observer
 async def __call__(self,scope,receive,send):
  if scope['type']=='http':
   chunks=[]
   while True:
    message=await receive();chunks.append(message)
    if not message.get('more_body'):break
   raw=b''.join(x.get('body',b'') for x in chunks)
   if raw:
    try:self.observer.inspect('ingress',scope['path'],json.loads(raw))
    except (json.JSONDecodeError,UnicodeError):pass  # Actual app must reject malformed JSON.
   iterator=iter(chunks)
   async def replay():
    try:return next(iterator)
    except StopIteration:return await receive()
   await self.app(scope,replay,send)
  else:
   async def monitored(message):
    if message['type']=='lifespan.shutdown.complete':
     # Audit is disabled only for writing the assertion-only verification report.
     self.observer.audit=lambda *_:None
     target=os.environ.get('SF_PRIVACY_REPORT')
     if target:
      path=Path(target).resolve()
      if not path.is_relative_to((ROOT/'verification/results').resolve()):raise ValueError('Privacy report must remain under verification/results')
      path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(self.observer.report(),indent=2)+'\n')
    await send(message)
   await self.app(scope,receive,monitored)

def create_app():
 from app.main import create_app as real_app
 observer=Observer();app=real_app();original=httpx.AsyncClient.send
 async def observed_send(client,request,*args,**kwargs):
  raw=await request.aread();host=request.url.host
  if raw:
   try:observer.inspect('outbound',request.url.path,json.loads(raw),host)
   except (json.JSONDecodeError,UnicodeError):observer.require(False,'uninspected-outbound-body')
  else:observer.inspect('outbound',request.url.path,{},host)
  return await original(client,request,*args,**kwargs)
 httpx.AsyncClient.send=observed_send
 logging.getLogger('street_fitting').addHandler(CaptureLog(observer))
 sys.addaudithook(lambda event,args:observer.audit(event,args))
 return CaptureApp(app,observer)
