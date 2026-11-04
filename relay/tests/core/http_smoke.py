"""Reproducible S01 loopback-only boundary smoke; no real provider credentials or calls."""
import asyncio, base64, builtins, io, json, logging, os, socket, sys, tempfile, threading, time, wave
from contextlib import asynccontextmanager
from dataclasses import replace
from unittest.mock import patch

import platform
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import httpx
import uvicorn
from fastapi import FastAPI, Request
from app.config import Settings, install_core
from app.auth import pseudonym
from app.errors import RelayError
from app.logging import log_search_text
from app.meta_client import MetaClient, Operation
from app.schemas import DescribeRequest, PieceResponse, SearchTurnRequest, SearchTurnResponse, TranscribeRequest, TranscribeResponse, RouteRequest
sys.path.insert(0, 'tests/core')
from test_metadata import xmp_image, CONTAINERS

settings = Settings(mode='mock', hmac_secret=b'smoke-only-secret-never-deployed-32',
                    firebase_project_id='core-smoke', firebase_app_id='1:123:android:abcdef', log_text=True)
class Verifier:
    def verify_id_token(self, token):
        if token != 'smoke-id': raise ValueError('PRIVATE_AUTH_SENTINEL')
        return {'sub':'PRIVATE_UID_SENTINEL','aud':settings.firebase_project_id,
                'iss':'https://securetoken.google.com/'+settings.firebase_project_id,
                'firebase':{'sign_in_provider':'anonymous'},'iat':int(time.time())-10,'exp':int(time.time())+600}
    def verify_app_check(self, token):
        if token != 'smoke-check': raise ValueError('PRIVATE_APP_CHECK_SENTINEL')
        return {'sub':settings.firebase_app_id,'iss':'https://firebaseappcheck.googleapis.com/123',
                'aud':['projects/123'],'exp':int(time.time())+600}
provider_calls=[]
async def provider(request):
    provider_calls.append(request.url.host)
    if request.url.path.endswith('/transcribe'):
        return httpx.Response(200,json={'text':'coat','language':'en'})
    if request.url.host == 'routing.openstreetmap.de':
        return httpx.Response(200,json={'ok':True})
    payload=json.loads(request.content)
    assert payload['store'] is False and payload['safety_identifier']==pseudonym(settings.hmac_secret,'PRIVATE_UID_SENTINEL')
    assert b'PRIVATE_UID_SENTINEL' not in request.content
    if payload['instructions']=='failure': return httpx.Response(503,text='PRIVATE_PROVIDER_SENTINEL')
    if payload['instructions']=='rate': return httpx.Response(429,headers={'Retry-After':'7'},text='PRIVATE_PROVIDER_SENTINEL')
    return httpx.Response(200,json={'label':'coat','category':'outerwear'})

@asynccontextmanager
async def lifespan(app):
    yield
    await app.state.meta.aclose()
    app.state.authenticator.close()
app=FastAPI(lifespan=lifespan)
install_core(app, settings, verifier=Verifier())
asyncio.run(app.state.meta.aclose())
app.state.meta=MetaClient(replace(settings,mode='live',model_api_key='fake-smoke-key'),transport=httpx.MockTransport(provider))
@app.post('/v1/describe/piece',response_model=PieceResponse)
async def describe(body:DescribeRequest,request:Request):
    return await app.state.meta.responses(Operation.SPARK,{'input':body.image.data,'instructions':'success'},sub=request.state.principal.sub)
@app.post('/v1/search/turn',response_model=SearchTurnResponse)
async def turn(body:SearchTurnRequest,request:Request):
    state=app.state.tokens.prepare_turn(body,request.state.principal.sub,scenario=request.state.fixture_scenario)
    with app.state.tokens.attempt(state,'spark') as consumed:
        await app.state.meta.responses(Operation.SPARK,{'input':body.query,'instructions':body.query},sub=request.state.principal.sub)
        response=app.state.tokens.finish_turn(consumed,{'not_found':{'reason':'No matching photos.'}})
        log_search_text(settings,query=body.query,response=response)
        return response
@app.post('/v1/transcribe',response_model=TranscribeResponse)
async def transcribe(body:TranscribeRequest):
    return await app.state.meta.transcribe(base64.b64decode(body.audio.data))
@app.post('/v1/route')
async def route(body:RouteRequest):
    return await app.state.meta.route(body.origin,body.destination)

logs=io.StringIO()
handler=logging.StreamHandler(logs)
logger=logging.getLogger(); logger.setLevel(logging.DEBUG); logger.addHandler(handler)
listener=socket.socket(); listener.bind(('127.0.0.1',0)); listener.listen()
port=listener.getsockname()[1]
server=uvicorn.Server(uvicorn.Config(app,host='127.0.0.1',port=port,log_config=None,access_log=False))
thread=threading.Thread(target=lambda:asyncio.run(server.serve(sockets=[listener])),daemon=True); thread.start()
limit=time.monotonic()+10
while not server.started:
    if not thread.is_alive() or time.monotonic()>limit: raise RuntimeError('Smoke server did not start')
    time.sleep(.01)
headers={'Authorization':'Bearer smoke-id','X-Firebase-AppCheck':'smoke-check'}
context={'now':'2026-11-04T10:00:00-05:00','timeZone':'America/New_York'}
image=xmp_image('jpeg-xmp',location=False)
gps_images={kind:xmp_image(kind) for kind in CONTAINERS}
audio=io.BytesIO()
with wave.open(audio,'wb') as wav:
    wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(16000); wav.writeframes(bytes(32000))
audio_data=base64.b64encode(audio.getvalue()).decode()
responses=[]; rows=[]; writes=[]; connects=[]
real_connect=socket.socket.connect
real_open,real_io,real_os=builtins.open,io.open,os.open

def connect(sock,address):
    if not isinstance(address,tuple) or address[:2]!=('127.0.0.1',port): raise AssertionError('External connection forbidden')
    connects.append('loopback'); return real_connect(sock,address)
def guarded(original):
    def opened(file,mode='r',*args,**kwargs):
        if any(c in str(mode) for c in 'wax+'):
            writes.append('file'); raise AssertionError('Request file write forbidden')
        return original(file,mode,*args,**kwargs)
    return opened
def os_open(file,flags,*args,**kwargs):
    if flags & (os.O_WRONLY|os.O_RDWR|os.O_CREAT|os.O_TRUNC):
        writes.append('os'); raise AssertionError('Request file write forbidden')
    return real_os(file,flags,*args,**kwargs)
def temp(*args,**kwargs):
    writes.append('temp'); raise AssertionError('Request tempfile forbidden')

def check(label,response,status,code=None):
    responses.append(response)
    assert response.status_code==status, label
    assert response.headers.get('cache-control')=='no-store', label
    if code: assert response.json()['error']['code']==code, label
    rows.append({'scenario':label,'status':status,'code':code})

try:
    with httpx.Client(base_url=f'http://127.0.0.1:{port}',headers=headers,trust_env=False) as client, \
         patch.object(socket.socket,'connect',connect),patch.object(builtins,'open',guarded(real_open)), \
         patch.object(io,'open',guarded(real_io)),patch.object(os,'open',os_open), \
         patch.object(tempfile,'TemporaryFile',temp),patch.object(tempfile,'NamedTemporaryFile',temp), \
         patch.object(tempfile,'SpooledTemporaryFile',temp),patch.object(tempfile,'mkstemp',temp):
        check('image-success',client.post('/v1/describe/piece',json={'image':image}),200)
        check('audio-success',client.post('/v1/transcribe',json={'audio':{'mimeType':'audio/wav','data':audio_data}}),200)
        check('route-success',client.post('/v1/route',json={'origin':{'lat':37.7749,'lng':-122.4194},'destination':{'lat':37.775,'lng':-122.419}}),200)
        check('auth-before-json',client.post('/v1/describe/piece',headers={'Authorization':'Bearer invalid','Content-Type':'application/json'},content='PRIVATE_JSON_SENTINEL'),401,'unauthenticated')
        check('app-check',client.post('/v1/describe/piece',headers={'X-Firebase-AppCheck':'invalid'},json={'image':image}),403,'app_check_failed')
        check('validation-private-input',client.post('/v1/describe/piece',json={'image':{**image,'data':'PRIVATE_MEDIA_SENTINEL'}}),400,'invalid_request')
        for kind,value in gps_images.items(): check(kind,client.post('/v1/describe/piece',json={'image':value}),400,'invalid_request')
        check('chunked-body-limit',client.post('/v1/route',headers={'Content-Type':'application/json'},content=iter([b'{',b' '*4096])),413,'payload_too_large')
        for query,expected in [('success',200),('failure',502),('rate',429),('coat near 37.7749, -122.4194',200)]:
            result=client.post('/v1/search/turn',json={'query':query,'context':context})
            check('search-'+query.split()[0],result,expected,None if expected==200 else 'upstream_error' if expected==502 else 'upstream_rate_limited')
            token=result.json()['queryToken'] if expected==200 else result.headers['x-query-token']
            state=app.state.tokens.verify(token,pseudonym(settings.hmac_secret,'PRIVATE_UID_SENTINEL'),scenario='normal')
            assert state.closed and state.sparkTurns==1
            if expected==429: assert result.headers['retry-after']=='7'
        result=client.post('/v1/search/turn',json={'query':'success','queryToken':token+'x'})
        check('tampered-token',result,401,'invalid_query_token')
        state.sparkTurns=4
        result=client.post('/v1/search/turn',json={'query':state.query,'queryToken':app.state.tokens.sign(state)})
        check('fifth-turn-before-closed',result,409,'turn_limit_exceeded')
finally:
    server.should_exit=True; thread.join(10); listener.close()
    logger.removeHandler(handler)
assert not thread.is_alive()
text=logs.getvalue()
sentinels=['PRIVATE_UID_SENTINEL','PRIVATE_AUTH_SENTINEL','PRIVATE_APP_CHECK_SENTINEL','PRIVATE_PROVIDER_SENTINEL',
           'PRIVATE_MEDIA_SENTINEL','PRIVATE_JSON_SENTINEL','37.7749','122.4194','37,46.494','122,25.164',
           image['data'],audio_data,token,'smoke-id','smoke-check','fake-smoke-key','routing.openstreetmap.de']
assert not any(value in text for value in sentinels)
assert not any('PRIVATE_' in response.text for response in responses)
assert writes==[] and provider_calls==['api.meta.ai','api.meta.ai','routing.openstreetmap.de']+['api.meta.ai']*4
print(json.dumps({'environment':f'{platform.system()} {platform.machine()}; core-only ASGI app over loopback HTTP; synthetic verifier and MockTransport',
                  'scenarios':rows,'http_responses':len(responses),'all_no_store':True,'provider_mock_calls':len(provider_calls),
                  'external_provider_calls':0,'file_temp_write_attempts':len(writes),'privacy_sentinels_absent':True,
                  'loopback_connections':len(connects),'log_records':len(text.splitlines())},indent=2))
