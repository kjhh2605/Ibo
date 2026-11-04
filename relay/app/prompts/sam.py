"""SAM 3.1's documented text geometry, not an invented JSON mask protocol.

Sources: https://dev.meta.ai/docs/sam/{segmenting,reading-segmentation,client-libraries}
Non-streaming Responses is explicitly supported. Inclusive boxes become xywh.
"""
import base64
import io
import re

from PIL import Image
from meta_sam_parser import InvalidSegmentationMaskError, SegmentationMask, decode_mask_to_raster

from app.errors import RelayError
from app.prompts.search import output_text
from app.schemas import SegmentCandidate

_RECORD = re.compile(
    r'(?P<id>[0-9]+)<\|box;(?P<box>[^|]+)\|><\|mask;(?P<mask>[^|]+)\|>')


def sam_payload(photo, concept):
    return {'input': [{'type': 'message', 'role': 'user', 'content': [
        {'type': 'input_text', 'text': concept},
        {'type': 'input_image', 'image_url': f'data:{photo.image.mimeType};base64,{photo.image.data}'}]}],
        'tools': [], 'metadata': {'include_confidence': 'true', 'mask_encoding': 'one_bit'}}


def _fields(text, expected):
    pairs = [part.split('=', 1) for part in text.split(';')]
    if any(len(pair) != 2 for pair in pairs):
        raise ValueError()
    fields = dict(pairs)
    if len(fields) != len(pairs) or set(fields) != expected:
        raise ValueError()
    return fields


def _integer(value):
    if not re.fullmatch('[0-9]{1,8}', value):
        raise ValueError()
    return int(value)


def _confidence(value):
    if not re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', value):
        raise ValueError()
    result = float(value)
    if not 0 <= result <= 1:
        raise ValueError()
    return result


def sam_candidates(response, photo, concept):
    try:
        text = output_text(response)
        if text == '':
            return []
        # One still, exactly frame zero; unknown grammar must not become zero matches.
        if text.endswith('\n'):
            text = text[:-1]
        if not text.startswith('<0f>'):
            raise ValueError()
        remaining, candidates, ids = text[4:], [], set()
        while remaining:
            match = _RECORD.match(remaining)
            if match is None or match['id'] in ids or len(match['id']) > 128:
                raise ValueError()
            ids.add(match['id'])
            box = _fields(match['box'], {'x1', 'y1', 'x2', 'y2', 'w', 'h', 'c'})
            mask = _fields(match['mask'], {'x', 'y', 'c', 'data'})
            x1, y1, x2, y2, width, height = [_integer(box[k]) for k in ('x1', 'y1', 'x2', 'y2', 'w', 'h')]
            score = _confidence(box['c'])
            if (mask['x'] != '0' or mask['y'] != '0' or _confidence(mask['c']) != score or
                (width, height) != (photo.image.width, photo.image.height) or
                not 0 <= x1 <= x2 < width or not 0 <= y1 <= y2 < height):
                raise ValueError()
            mh, mw, payload = mask['data'].split(',', 2)
            mh, mw = _integer(mh), _integer(mw)
            bw, bh = x2 - x1 + 1, y2 - y1 + 1
            # The documented raster is the inclusive box crop; no resizing guesses.
            if (mw, mh) != (bw, bh) or not payload or payload[0] not in ('!', '~'):
                raise ValueError()
            decoded = decode_mask_to_raster(SegmentationMask(
                encoding='one_bit' if payload[0] == '!' else 'lossless',
                payload=payload, width=mw, height=mh))
            raster = Image.frombytes('L', (mw, mh), decoded).point(lambda p: p * 255)
            canvas = Image.new('L', (width, height), 0)
            canvas.paste(raster, (x1, y1))
            buffer = io.BytesIO()
            canvas.save(buffer, format='PNG')
            candidate = {'id': match['id'], 'label': concept, 'score': score,
                         'bbox': [x1, y1, bw, bh], 'mask': {'mimeType': 'image/png',
                         'data': base64.b64encode(buffer.getvalue()).decode(), 'width': width, 'height': height}}
            SegmentCandidate.model_validate(candidate)
            candidates.append(candidate)
            remaining = remaining[match.end():]
            if remaining:
                if not remaining.startswith(',') or len(remaining) == 1:
                    raise ValueError()
                remaining = remaining[1:]
        if not candidates:
            raise ValueError()
        # Python's stable sort preserves provider order for equal scores.
        return sorted(candidates, key=lambda candidate: -candidate['score'])
    except RelayError:
        raise
    except (ValueError, TypeError, KeyError, IndexError, OSError, InvalidSegmentationMaskError):
        raise RelayError('upstream_error') from None


def validate_segment_dimensions(body, request, *, error='upstream_error'):
    try:
        if [p['photoRef'] for p in body['photos']] != [p.photoRef for p in request.photos]:
            raise ValueError()
        for result, photo in zip(body['photos'], request.photos, strict=True):
            if any((c['mask']['width'], c['mask']['height']) != (photo.image.width, photo.image.height)
                   or c['label'] != request.concept for c in result['candidates']):
                raise ValueError()
    except (ValueError, TypeError, KeyError):
        raise RelayError(error) from None
