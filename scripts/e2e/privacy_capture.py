"""Memory-only ASGI + HTTPX observer, launched instead of app.main on the M1.

PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=scripts/e2e:relay uvicorn privacy_capture:create_app --factory
SF_PRIVACY_REPORT must name a new report under verification/results. No bodies are saved.
"""
from __future__ import annotations
import base64
import contextvars
import hashlib
import io
import json
import logging
import os
from pathlib import Path
import re
import sys
import time
from email.parser import BytesParser
from email.policy import default
from urllib.parse import parse_qs
import httpx
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT/'verification/fixtures'
META_HOST = 'api.meta.ai'
OSRM_HOST = 'routing.openstreetmap.de'
FORBIDDEN = {'lat', 'lng', 'latitude', 'longitude', 'coordinates', 'trail', 'trailpoints', 'location', 'walkto', 'spot', 'headmask', 'rawself', 'originalselfphoto'}
REQUEST = contextvars.ContextVar('s11_privacy_request', default=None)


def pixel_hash(raw):
    with Image.open(io.BytesIO(raw)) as image:
        image.load()
        rgba=image.convert('RGBA')
        canonical=Image.new('RGBA',rgba.size)
        canonical.paste(rgba,mask=rgba.getchannel('A').point(lambda alpha:255 if alpha else 0))
        return hashlib.sha256(str(image.size).encode()+canonical.tobytes()).hexdigest()


def fields(value):
    if isinstance(value, dict):
        for key, child in value.items():
            yield key.lower()
            yield from fields(child)
    elif isinstance(value, list):
        for child in value:
            yield from fields(child)


def media(value):
    if isinstance(value, dict):
        if value.get('mimeType', '').startswith('image/') and isinstance(value.get('data'), str):
            yield base64.b64decode(value['data'], validate=True)
        for child in value.values():
            yield from media(child)
    elif isinstance(value, list):
        for child in value:
            yield from media(child)
    elif isinstance(value, str) and value.startswith('data:image/'):
        yield base64.b64decode(value.split(',', 1)[1], validate=True)


class Observer:
    def __init__(self):
        self.records = []
        self.failures = set()
        self.logs = self.writes = self.db = 0
        self.model_loads = []
        self.text_encodes = []
        self.raw = {pixel_hash(p.read_bytes()) for p in (FIX/'images/self').rglob('*.png')}
        self.head_bytes = {hashlib.sha256(p.read_bytes()).hexdigest() for p in (FIX/'masks/head').glob('*.png')}
        self.cutouts = {pixel_hash(p.read_bytes()) for folder in ['images/derived', 'images/wardrobe'] for p in (FIX/folder).glob('*.png') if 'cutout' in p.name or 'candidate' in p.name}
        self.pending_cutouts = set()
        self.wardrobe_originals = {pixel_hash(p.read_bytes()) for p in (FIX/'images/wardrobe').glob('*original*.png')}
        self.masked = set()
        # Native harness supplies hash-only expected payload identities through this
        # optional JSON file; it never supplies raw bytes or body dumps.
        self.identities = os.environ.get('SF_PRIVACY_IDENTITIES')
        self.active = True

    def identities_refresh(self):
        if not self.identities:
            return
        value = json.loads(Path(self.identities).read_text())
        for key, target in [('rawSelfPixelHashes', self.raw), ('headMaskSha256', self.head_bytes), ('cutoutPixelHashes', self.cutouts), ('maskedSelfPixelHashes', self.masked)]:
            hashes = value.get(key, [])
            self.require(isinstance(hashes, list) and all(isinstance(h, str) and re.fullmatch('[a-f0-9]{64}', h) for h in hashes), 'invalid_native_identity_inventory')
            target.update(hashes)

    def require(self, condition, code):
        if not condition:
            self.failures.add(code)
            raise AssertionError(code)

    def inspect(self, boundary, path, value, host=None):
        self.identities_refresh()
        keys = set(fields(value))
        images = list(media(value))
        hashes = [pixel_hash(image) for image in images]
        self.require(all(h not in self.raw for h in hashes), 'raw_self_at_'+boundary)
        self.require(all(hashlib.sha256(image).hexdigest() not in self.head_bytes for image in images), 'head_mask_at_'+boundary)
        route = path == '/v1/route' if boundary == 'ingress' else host == OSRM_HOST
        if not route:
            self.require(not keys & FORBIDDEN, 'device_only_field_at_'+boundary)
        if path == '/v1/search/turn':
            self.require(not images and not keys & {'embedding', 'phrasevector', 'mask', 'image', 'audio'}, 'private_search_summary')
            token = value.get('queryToken')
            if token:
                try:
                    encoded = token.split('.')[0]
                    history = json.loads(base64.urlsafe_b64decode(encoded+'='*(-len(encoded)%4)))
                except (ValueError, TypeError):
                    history = {}  # Product token validation must reject malformed tokens.
                self.require(not set(fields(history)) & (FORBIDDEN | {'phrasevector', 'embedding', 'image', 'audio', 'mask'}), 'private_token_history')
        if path == '/v1/describe/piece':
            self.require(len(hashes) == 1 and hashes[0] not in self.wardrobe_originals, 'describe_input_is_wardrobe_original')
            self.pending_cutouts.update(hashes)
        if path == '/v1/tryon':
            self.require(value.get('selfPhoto', {}).get('headMasked') is True, 'unmasked_self_tag')
            slots = [piece.get('category') for piece in value.get('pieces', [])]
            self.require(1 <= len(slots) <= 3 and len(set(slots)) == len(slots) and set(slots) <= {'outer', 'top', 'bottom'}, 'tryon_input_limit')
            self.require(bool(hashes) and hashes[0] in self.masked, 'native_masked_self_identity_missing')
        if boundary == 'outbound':
            self.require(host in {META_HOST, OSRM_HOST}, 'unexpected_provider_host')
            if host == META_HOST:
                self.require(not keys & FORBIDDEN, 'coordinates_to_meta')
                if path == '/v1/responses':
                    self.require(value.get('store') is False, 'provider_storage_enabled')
                    self.require(bool(re.fullmatch('[0-9a-f]{64}', str(value.get('safety_identifier', '')))), 'provider_identity_not_pseudonymous')
                    # Tool arguments are serialized JSON strings by Responses.
                    for item in value.get('input', []):
                        if isinstance(item, dict):
                            for key in ('arguments', 'output'):
                                if isinstance(item.get(key), str):
                                    try: nested = json.loads(item[key])
                                    except ValueError: continue
                                    self.require(not set(fields(nested)) & FORBIDDEN, 'coordinates_in_provider_tool_text')
        self.records.append({'boundary': boundary, 'operation': path if boundary == 'ingress' else 'route' if route else 'voice' if path == '/v1/asr/transcribe' else 'responses', 'hostClass': 'meta' if host == META_HOST else 'route' if host == OSRM_HOST else None, 'imageCount': len(images), 'passed': True})

    def outbound(self, request, raw):
        host = request.url.host
        self.require(request.url.scheme == 'https', 'provider_not_https')
        if host == OSRM_HOST:
            self.require(request.method == 'GET' and not raw, 'invalid_route_transport')
            match = re.fullmatch(r'/routed-foot/route/v1/driving/([^/]+)', request.url.path)
            self.require(match is not None, 'invalid_route_path')
            context = REQUEST.get()
            self.require(context is not None and context.get('route') is not None, 'route_without_ingress')
            points = [[float(n) for n in p.split(',')] for p in match[1].split(';')]
            body = context['route']
            self.require(points == [[body[k]['lng'], body[k]['lat']] for k in ('origin', 'destination')], 'route_coordinate_scope_mismatch')
            self.require(parse_qs(request.url.query.decode()) == {'overview':['full'], 'geometries':['geojson'], 'steps':['true'], 'alternatives':['false']}, 'invalid_route_parameters')
            self.inspect('outbound', request.url.path, {}, host)
            return
        self.require(host == META_HOST, 'unexpected_provider_host')
        if request.url.path == '/v1/asr/transcribe':
            content_type = request.headers.get('content-type', '')
            self.require(content_type.startswith('multipart/form-data;'), 'voice_multipart_required')
            message = BytesParser(policy=default).parsebytes(b'Content-Type: '+content_type.encode()+b'\r\nMIME-Version: 1.0\r\n\r\n'+raw)
            parts = {part.get_param('name', header='content-disposition'): part.get_payload(decode=True) for part in message.iter_parts()}
            self.require(set(parts) == {'request', 'audio'}, 'voice_multipart_fields')
            from app.schemas import Audio
            Audio.model_validate({'mimeType':'audio/wav', 'data':base64.b64encode(parts['audio']).decode()})
            self.inspect('outbound', request.url.path, json.loads(parts['request']), host)
        else:
            self.require(request.url.path == '/v1/responses', 'unexpected_meta_path')
            self.inspect('outbound', request.url.path, json.loads(raw), host)

    def audit(self, event, args):
        if not self.active or REQUEST.get() is None:
            return
        if event == 'sqlite3.connect':
            self.db += 1
            self.failures.add('relay_database_open_during_request')
        if event == 'open' and len(args) > 1:
            mode = args[1]
            flags = args[2] if len(args) > 2 else 0
            if (isinstance(mode, str) and any(c in mode for c in 'wax+')) or (isinstance(flags, int) and flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT)):
                self.writes += 1
                self.failures.add('relay_file_write_during_request')

    def log(self, record):
        if not record.name.startswith('street_fitting'):
            return
        self.logs += 1
        try:
            value = json.loads(record.getMessage())
            allowed = {'endpoint', 'pseudonymousId', 'latencyMs', 'statusCode', 'sparkTurns'}
            if os.environ.get('RELAY_LOG_TEXT') == '1':
                allowed |= {'queryText', 'sparkText'}
            self.require(isinstance(value, dict) and not set(value)-allowed, 'nonmetadata_log_fields')
            self.require(not set(fields(value)) & FORBIDDEN, 'coordinate_log_fields')
            from app.logging import safe_text
            if 'queryText' in value:
                self.require(safe_text(value['queryText']) is not None, 'unsafe_query_log_text')
            for text in value.get('sparkText', {}).values():
                self.require(safe_text(text) is not None, 'unsafe_spark_log_text')
            self.require(value.get('pseudonymousId') is None or re.fullmatch('[a-f0-9]{64}', value['pseudonymousId']), 'unsafe_log_identity')
        except Exception:
            self.failures.add('unsafe_log_record')

    def report(self):
        self.identities_refresh()
        if not self.pending_cutouts <= self.cutouts:
            self.failures.add('describe_cutout_not_correlated_with_native_store')
        return {'status': 'failed' if self.failures else 'passed' if self.records else 'blocked', 'scope': 'memory-only ASGI ingress, HTTPX provider outbound, request-context file/database audit and metadata logs', 'records': self.records, 'failures': sorted(self.failures), 'logRecords': self.logs, 'relayWriteAttempts': self.writes, 'relayDatabaseOpens': self.db, 'rawBodiesPersisted': False, 'nativeIdentityInventoryPresent': bool(self.masked), 'deviceOwnershipProven': False,'modelLoads':self.model_loads,'textEncodes':self.text_encodes}

    def provider_output(self, raw):
        from quality import provider_image
        image = provider_image(json.loads(raw))
        with Image.open(io.BytesIO(image)) as decoded:
            decoded.load()
            metadata = ' '.join(str(v) for v in decoded.info.values() if isinstance(v, str))
            gps = 34853 in decoded.getexif() or bool(re.search(r'(?i)GPSLatitude|GPSLongitude|exif:GPS', metadata))
            self.records.append({'boundary':'provider-output', 'operation':'tryon', 'providerSha256':hashlib.sha256(image).hexdigest(), 'providerBytes':len(image), 'gpsPresent':gps, 'metadataFields':len(decoded.info), 'watermarkPreservation':'unverified'})


class OutputStream(httpx.AsyncByteStream):
    def __init__(self, stream, observer):
        self.stream, self.observer = stream, observer
    async def __aiter__(self):
        buffer = bytearray()
        try:
            async for chunk in self.stream:
                self.observer.require(len(buffer)+len(chunk)<=128*1048576, 'provider_output_capture_limit')
                buffer.extend(chunk)
                yield chunk
            self.observer.provider_output(buffer)
        finally:
            buffer.clear()
    async def aclose(self):
        await self.stream.aclose()


class CaptureLog(logging.Handler):
    def __init__(self, observer):
        super().__init__()
        self.observer = observer
    def emit(self, record):
        self.observer.log(record)


class CaptureApp:
    def __init__(self, app, observer, restore=None):
        self.app, self.observer, self.restore = app, observer, restore

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'http':
            from app.errors import BODY_LIMITS
            body = bytearray()
            limit = BODY_LIMITS.get(scope['path'], 4096)
            while True:
                message = await receive()
                if message['type'] == 'http.disconnect':
                    return
                body.extend(message.get('body', b''))
                if len(body) > limit:
                    body.clear()
                    await send({'type':'http.response.start', 'status':413, 'headers':[(b'content-type', b'application/json'), (b'cache-control', b'no-store')]})
                    await send({'type':'http.response.body', 'body':b'{"error":{"code":"payload_too_large","message":"Request is too large.","retryable":false}}'})
                    return
                if not message.get('more_body'):
                    break
            context = {'route':None}
            token = REQUEST.set(context)
            start = time.monotonic()
            try:
                try: value = json.loads(body)
                except (ValueError, UnicodeError): value = None
                if isinstance(value, dict):
                    self.observer.inspect('ingress', scope['path'], value)
                    fixture = dict(scope.get('headers',[])).get(b'x-sf-fixture')
                    if fixture is not None:
                        fixture = fixture.decode('ascii')
                        self.observer.require(re.fullmatch('[a-z0-9-]{1,64}',fixture) is not None,'unsafe_fixture_header')
                    self.observer.records[-1]['fixture'] = fixture
                    if scope['path'] == '/v1/route':
                        context['route'] = value
                output = bytearray()
                output_ok = False
                delivered = False
                async def replay():
                    nonlocal delivered
                    if not delivered:
                        delivered = True
                        return {'type':'http.request', 'body':bytes(body), 'more_body':False}
                    return await receive()
                async def measured(message):
                    nonlocal output_ok
                    if message['type'] == 'http.response.start':
                        self.observer.records.append({'boundary':'response', 'operation':scope['path'] if scope['path'] in BODY_LIMITS else 'unknown', 'method':scope['method'], 'statusCode':message['status'], 'elapsedMs':round((time.monotonic()-start)*1000)})
                        output_ok = scope['path'] == '/v1/tryon' and message['status'] == 200
                    elif output_ok and message['type'] == 'http.response.body':
                        chunk = message.get('body', b'')
                        self.observer.require(len(output)+len(chunk)<=44*1048576, 'relay_output_capture_limit')
                        output.extend(chunk)
                        if not message.get('more_body'):
                            encoded = json.loads(output)['image']['data']
                            decoded = base64.b64decode(encoded, validate=True)
                            self.observer.records.append({'boundary':'relay-output','operation':'tryon','providerSha256':hashlib.sha256(decoded).hexdigest(),'providerBytes':len(decoded)})
                            output.clear()
                    await send(message)
                await self.app(scope, replay, measured)
            finally:
                body.clear()
                if 'output' in locals():
                    output.clear()
                context.clear()
                REQUEST.reset(token)
        else:
            async def monitored(message):
                if message['type'] in {'lifespan.shutdown.complete', 'lifespan.shutdown.failed'}:
                    self.observer.active = False
                    if self.restore:
                        self.restore()
                    target = os.environ.get('SF_PRIVACY_REPORT')
                    if target:
                        path = Path(target).resolve()
                        if not path.is_relative_to((ROOT/'verification/results').resolve()):
                            raise ValueError('privacy_report_outside_results')
                        path.parent.mkdir(parents=True, exist_ok=True)
                        with path.open('x') as output:
                            json.dump(self.observer.report(), output, indent=2)
                await send(message)
            await self.app(scope, receive, monitored)


def create_app():
    from app.main import create_app as real_app
    observer = Observer()
    app = real_app()
    loader_module = None
    loader_original = None
    if os.environ.get('RELAY_MODE') == 'live':
        from app import pe_text as loader_module
        loader_original = loader_module.load_pe_text
        class ObservedEncoder:
            def __init__(self, encoder):
                self.encoder = encoder
            def __getattr__(self, name):
                return getattr(self.encoder, name)
            def encode(self, phrase):
                started = time.monotonic()
                try:
                    result = self.encoder.encode(phrase)
                    observer.text_encodes.append({'elapsedMs':round((time.monotonic()-started)*1000),'dimensions':len(result),'status':'passed'})
                    return result
                except Exception:
                    observer.text_encodes.append({'elapsedMs':round((time.monotonic()-started)*1000),'status':'failed'})
                    raise
        def observed_load(*args, **kwargs):
            started = time.monotonic()
            encoder = loader_original(*args, **kwargs)
            observer.model_loads.append({'elapsedMs':round((time.monotonic()-started)*1000),'status':'passed'})
            return ObservedEncoder(encoder)
        loader_module.load_pe_text = observed_load
    original = httpx.AsyncClient.send
    async def observed_send(client, request, *args, **kwargs):
        # Firebase uses its own Google transport. This observes the actual HTTPX
        # provider client, including streams, without persisting body bytes.
        raw = await request.aread()
        observer.outbound(request, raw)
        response = await original(client, request, *args, **kwargs)
        if request.url.host == META_HOST and request.url.path == '/v1/responses' and response.status_code == 200:
            payload = json.loads(raw)
            if payload.get('model') == 'muse-image-1.0':
                if response.is_stream_consumed:
                    observer.provider_output(response.content)
                else:
                    response.stream = OutputStream(response.stream, observer)
        return response
    httpx.AsyncClient.send = observed_send
    handler = CaptureLog(observer)
    logger = logging.getLogger('street_fitting')
    previous_level = logger.level
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    sys.addaudithook(observer.audit)
    def restore():
        httpx.AsyncClient.send = original
        logger.removeHandler(handler)
        logger.setLevel(previous_level)
        if loader_module is not None:
            loader_module.load_pe_text = loader_original
    return CaptureApp(app, observer, restore)
