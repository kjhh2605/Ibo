"""Explicit live inference using only the checked-in synthetic, head-masked corpus.

Run from relay/: .venv/bin/python scripts/live_provider_smoke.py --evidence PATH
Reads MODEL_API_KEY or --key-file (never prints credentials). No microphone, user
photos, public relay auth bypass, service changes, or generated-image persistence.
Evidence contains only statuses, shapes, counts and codes; not provider text.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from types import SimpleNamespace
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from PIL import Image as PILImage
from pydantic import TypeAdapter

from app.errors import RelayError
from app.meta_client import MetaClient, Operation, MODELS
from app.pe_text import load_pe_text
from app.prompts.sam import sam_candidates, sam_payload
from app.prompts.search import parse_spark, spark_payload, validate_output_refs
from app.routes.describe import describe_piece, describe_storefront
from app.routes.tryon import tryon
from app.schemas import DescribeRequest, SegmentPhoto, ToolResult, TryOnRequest
from app.token import QueryTokens

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'verification/fixtures/relay/normal/assets'
SUB = hashlib.sha256(b'street-fitting-synthetic-provider-smoke').hexdigest()


def image(name):
    # Fixed fixture directory: no caller-controlled image path or personal original.
    path = ASSETS / name
    with PILImage.open(path) as pixels:
        width, height = pixels.size
    return {'mimeType': 'image/png', 'data': base64.b64encode(path.read_bytes()).decode(),
            'width': width, 'height': height}


def safe_atom(value):
    return value if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_.-]{1,100}', value) else None


class EvidenceClient(MetaClient):
    """Keep the production transport and sanitise response metadata in memory."""
    def __init__(self, settings):
        super().__init__(settings)
        self.calls = []
        self.client.event_hooks['response'] = [self.observe]

    async def observe(self, response):
        await response.aread()
        record = {'httpStatus': response.status_code, 'endpoint': response.request.url.path}
        try:
            body = response.json()
            if isinstance(body, dict):
                record['status'] = safe_atom(body.get('status'))
                if isinstance(body.get('data'), list):
                    record['imageCount'] = len(body['data'])
                    record['outputFormat'] = safe_atom(body.get('output_format'))
                error = body.get('error')
                if isinstance(error, dict):
                    record['errorCode'] = safe_atom(error.get('code'))
                    record['errorType'] = safe_atom(error.get('type'))
                    record['errorParam'] = safe_atom(error.get('param'))
                    # Only fixed known configuration words, never upstream text.
                    message = error.get('message', '')
                    record['errorHints'] = [word for word in (
                        'instructions', 'tools', 'safety_identifier', 'metadata', 'json_schema',
                        'store', 'reasoning', 'unsupported', 'not supported', 'credit', 'balance',
                        'billing', 'quota', 'authentication', 'permission', 'model', 'input',
                        'enable_image_search', 'enable_web_search', 'enable_shell', 'reasoning_strength',
                        'size', 'output_format', 'image_generation', 'allowed', 'invalid', 'disabled',
                        'cannot', 'must', 'requires', 'unknown', 'supported', 'extra', 'field',
                    ) if isinstance(message, str) and word in message.lower()]
                if isinstance(body.get('output'), list):
                    record['outputTypes'] = [safe_atom(item.get('type')) for item in body['output'] if isinstance(item, dict)]
                    record['messageShapes'] = [
                        {'status': safe_atom(item.get('status')), 'role': safe_atom(item.get('role')),
                         'phase': safe_atom(item.get('phase')), 'contentTypes': [safe_atom(part.get('type')) for part in item.get('content', []) if isinstance(part, dict)]}
                        for item in body['output'] if isinstance(item, dict) and item.get('type') == 'message']
                    record['functionCalls'] = [
                        {'name': safe_atom(item.get('name')), 'status': safe_atom(item.get('status'))}
                        for item in body['output'] if isinstance(item, dict) and item.get('type') == 'function_call']
        except (ValueError, TypeError):
            record['invalidJson'] = True
        self.calls.append(record)


async def main(args):
    key = os.environ.get('MODEL_API_KEY', '')
    if not key and args.key_file:
        key = args.key_file.expanduser().read_text().strip()
    if not key:
        raise SystemExit('MODEL_API_KEY or --key-file is required (value is never logged).')
    settings = SimpleNamespace(mode='live', model_api_key=key)
    meta = EvidenceClient(settings)
    services = SimpleNamespace(settings=settings, meta=meta)
    http = SimpleNamespace(app=SimpleNamespace(state=services), state=SimpleNamespace(principal=SimpleNamespace(sub=SUB)))
    evidence = {'schemaVersion': 1, 'observedAt': datetime.now(timezone.utc).isoformat(),
                'boundary': 'direct live Meta inference through production relay payloads/parsers; not HTTP/Firebase or Android E2E',
                'syntheticOnly': True, 'humanApprovalClaimed': False, 'userOriginalUploaded': False,
                'voiceTested': False, 'generatedImagesPersisted': False, 'operations': {}}

    async def exercise(name, operation, action):
        start, offset = time.monotonic(), len(meta.calls)
        record = {'model': MODELS[operation]}
        try:
            record.update(await action())
            record['passed'] = True
        except RelayError as exc:
            record.update(passed=False, relayErrorCode=exc.code)
        except Exception as exc:
            # No exception messages/tracebacks: provider or input data may be embedded.
            record.update(passed=False, exceptionType=type(exc).__name__)
        record['elapsedMs'] = round((time.monotonic() - start) * 1000)
        record['calls'] = meta.calls[offset:]
        evidence['operations'][name] = record
        args.evidence.parent.mkdir(parents=True, exist_ok=True)
        args.evidence.write_text(json.dumps(evidence, indent=2) + '\n')
        print(json.dumps({name: record}), flush=True)

    async def search():
        tokens = QueryTokens(os.urandom(32))
        state = tokens.start(SUB, 'Find the blue jacket from my shopping photos.',
                             {'now': '2026-11-05T10:00:00Z', 'timeZone': 'UTC'})
        visited = []
        for _ in range(4):
            with tokens.attempt(state, 'spark') as consumed:
                raw = await meta.responses(Operation.SPARK, spark_payload(consumed), sub=SUB)
                body, provider_id = parse_spark(raw)
                validate_output_refs(consumed, body)
                if 'toolCalls' in body and body['toolCalls'][0]['name'] == 'find_photos':
                    call = body['toolCalls'][0]
                    encoder = load_pe_text(Path(os.environ.get('SF_MODELS_DIR', '~/.cache/street-fitting/models')).expanduser())
                    call['phraseVector'] = encoder.encode(call['arguments']['phrase'])
                tokens.finish_turn(consumed, body, provider_call_id=provider_id)
                state = consumed
            if 'toolCalls' not in body:
                return {'turnCount': state.sparkTurns, 'toolSequence': visited,
                        'terminal': 'final' if 'final' in body else 'not_found'}
            call = body['toolCalls'][0]
            visited.append(call['name'])
            if call['name'] == 'list_visits':
                result = {'visits': [{'tripRef': 'synthetic-trip', 'tripStartedAt': '2026-11-05T08:00:00Z',
                           'tripEndedAt': '2026-11-05T09:00:00Z', 'tripStatus': 'ended',
                           'shopRef': 'synthetic-shop', 'n': 1, 'startedAt': '2026-11-05T08:00:00Z',
                           'descriptionState': 'none', 'note': 'Blue jacket on display', 'photoCount': 1,
                           'firstPhotoAt': '2026-11-05T08:15:00Z', 'lastPhotoAt': '2026-11-05T08:15:00Z'}],
                           'matchingCount': 1, 'truncated': False}
            elif call['name'] == 'find_photos':
                # Explicit synthetic local-tool input, not an asserted PE inference.
                result = [{'photoRef': 'synthetic-photo', 'shopRef': 'synthetic-shop',
                           'takenAt': '2026-11-05T08:15:00Z', 'score': 0.6}]
            else:
                photo = SegmentPhoto(photoRef='synthetic-photo', image=image('shop-1-candidate-1.png'))
                candidates = sam_candidates(await meta.responses(Operation.SAM, sam_payload(photo, call['arguments']['concept']), sub=SUB),
                                            photo, call['arguments']['concept'])
                state.samPhotos += 1
                result = [{'photoRef': 'synthetic-photo', 'candidateCount': len(candidates),
                           'topScore': candidates[0]['score'] if candidates else None}]
            typed = TypeAdapter(ToolResult).validate_python({'toolCallId': call['id'], 'name': call['name'], 'result': result})
            state.history.append({'result': typed.model_dump(mode='json', by_alias=True, exclude_none=call['name'] != 'extract_items')})
            state.pending = None
        raise RelayError('turn_limit_exceeded')

    async def description(kind):
        response = await (describe_storefront if kind == 'storefront' else describe_piece)(
            DescribeRequest(image=image('shop-1.png' if kind == 'storefront' else 'shop-1-candidate-1.png')), http)
        return {'validatedFields': sorted(response.model_fields_set),
                'textLengths': {key: len(value) for key, value in response.model_dump().items()}}

    async def segmentation():
        photo = SegmentPhoto(photoRef='synthetic-photo', image=image('shop-1-candidate-1.png'))
        raw = await meta.responses(Operation.SAM, sam_payload(photo, 'blue jacket'), sub=SUB)
        candidates = sam_candidates(raw, photo, 'blue jacket')
        if not candidates:
            raise RelayError('upstream_error')
        return {'candidateCount': len(candidates), 'maskDimensions': [[c['mask']['width'], c['mask']['height']] for c in candidates],
                'binaryMaskValidated': True, 'bboxDimensions': [c['bbox'][2:] for c in candidates]}

    async def generation():
        request = TryOnRequest(selfPhoto={'headMasked': True, 'image': image('calibration-hat-masked.png')},
                               target={'pieceRef': 'synthetic-target', 'image': image('shop-1-candidate-1.png'),
                                       'label': 'Blue jacket', 'category': 'jacket', 'origin': 'shop'}, companions=[])
        response = await tryon(request, http)
        raw = base64.b64decode(response.image.data)
        return {'inputImageCount': 2, 'outputMimeType': response.image.mimeType,
                'outputWidth': response.image.width, 'outputHeight': response.image.height,
                'outputByteCount': len(raw), 'outputSha256': hashlib.sha256(raw).hexdigest(),
                'privacyOrTryonQualityApproved': False}

    try:
        actions = [('spark-search', Operation.SPARK, search),
                   ('spark-storefront', Operation.SPARK, lambda: description('storefront')),
                   ('spark-piece', Operation.SPARK, lambda: description('piece')),
                   ('sam-mask', Operation.SAM, segmentation),
                   ('muse-image', Operation.IMAGE, generation)]
        for name, operation, action in actions:
            if not args.only or name in args.only:
                await exercise(name, operation, action)
    finally:
        await meta.aclose()
    return 0 if all(record['passed'] for record in evidence['operations'].values()) else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', type=Path, required=True)
    parser.add_argument('--key-file', type=Path)
    parser.add_argument('--only', action='append', choices=['spark-search', 'spark-storefront', 'spark-piece', 'sam-mask', 'muse-image'])
    raise SystemExit(asyncio.run(main(parser.parse_args())))
