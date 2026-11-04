#!/usr/bin/env python3
"""Import human-supplied reviews; structural validation never establishes human truth."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import shutil
import sys
import wave
from datetime import datetime, timezone
from PIL import Image, ImageChops
from build_fixtures import FIX, save_json, digest


def asset_path(relative):
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute() or '..' in Path(relative).parts:
        raise ValueError('Invalid fixture-relative path')
    path = FIX / relative
    if not path.resolve().is_relative_to(FIX) or any(parent.is_symlink() for parent in [path, *path.parents] if parent != FIX.parent):
        raise ValueError('Asset outside fixture corpus or symlink')
    return path


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('Missing timestamp')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed.tzinfo is None or parsed > datetime.now(timezone.utc):
        raise ValueError('Invalid review timestamp')
    return parsed


def provenance(bundle):
    if bundle.get('humanAttestation') is not True:
        raise ValueError('Actual human attestation required')
    if not isinstance(bundle.get('reviewer'), str) or not bundle['reviewer'].strip():
        raise ValueError('Missing reviewer')
    timestamp(bundle.get('reviewedAt'))


def check_item(item):
    with Image.open(asset_path(item['image'])) as source, Image.open(asset_path(item['mask'])) as mask, Image.open(asset_path(item['cutout'])) as cutout:
        if mask.size != source.size or mask.mode != 'L' or not set(mask.getdata()) <= {0, 255} or mask.getbbox() is None:
            raise ValueError('Invalid candidate mask')
        box = mask.getbbox()
        if item['bbox'] != [box[0], box[1], box[2]-box[0], box[3]-box[1]]:
            raise ValueError('Candidate bbox differs from mask')
        tap = item['tap']
        if len(tap) != 2 or any(type(v) is not int for v in tap) or not (0 <= tap[0] < mask.width and 0 <= tap[1] < mask.height) or mask.getpixel(tuple(tap)) != 255:
            raise ValueError('Candidate tap outside mask')
        if cutout.mode != 'RGBA' or cutout.size != source.size or ImageChops.difference(cutout.getchannel('A'), mask).getbbox() is not None:
            raise ValueError('Cutout alpha differs from mask')
        if ImageChops.difference(cutout.convert('RGB'), source.convert('RGB')).getbbox() is not None:
            raise ValueError('Cutout pixels differ from original')


def check_speech(bundle, source):
    provenance(bundle)
    if bundle.get('sourceType') != 'human-recording' or bundle.get('speakerConsent') is not True:
        raise ValueError('Consenting human recording required; synthesized voices are not accepted')
    for key in ['sourceId', 'permission', 'termsUrl', 'text']:
        if not isinstance(bundle.get(key), str) or not bundle[key].strip():
            raise ValueError('Missing speech provenance: ' + key)
    if bundle.get('language') != 'en' or bundle.get('redistributionApproved') is not True:
        raise ValueError('English speech and explicit redistribution permission required')
    if digest(source) != bundle.get('sha256'):
        raise ValueError('Reviewed speech hash changed')
    with wave.open(str(source), 'rb') as wav:
        if wav.getparams()[:3] != (1, 2, 16000) or wav.getcomptype() != 'NONE' or not 16000 < wav.getnframes() <= 240000:
            raise ValueError('Canonical mono16k PCM16 speech required')
        samples = wav.readframes(wav.getnframes())
        if len(samples) != wav.getnframes()*2 or samples[-32000:] != b'\0'*32000 or not any(samples[:-32000]):
            raise ValueError('Voiced samples plus one second trailing silence required')
    # Use the wire decoder as well: wave alone accepts malformed/trailing RIFF payloads.
    from relay_fixtures import wire
    wire.Audio.model_validate({'mimeType': 'audio/wav', 'data': base64.b64encode(source.read_bytes()).decode()})


def import_assets(bundle):
    provenance(bundle)
    entries = bundle.get('assets')
    if not isinstance(entries, list) or not entries:
        raise ValueError('Explicit reviewed asset list required')
    path = FIX/'review/asset-approval.json'
    current = json.loads(path.read_text()) if path.exists() else {'assets': {}}
    seen = set()
    for entry in entries:
        relative = entry['path']; asset = asset_path(relative)
        if relative in seen or relative in {'audio/query.wav', 'voice/normal/01-query.wav'}:
            raise ValueError('Duplicate asset or speech requires separate consent import')
        seen.add(relative)
        if digest(asset) != entry['sha256']:
            raise ValueError('Reviewed asset hash changed')
        if entry.get('publicUseApproved') is not True or not all(isinstance(entry.get(k), str) and entry[k].strip() for k in ['termsUrl', 'permission']):
            raise ValueError('Explicit public-use approval, terms URL and permission required per asset')
        current['assets'][relative] = {**entry, 'humanAttestation': True, 'reviewer': bundle['reviewer'], 'reviewedAt': bundle['reviewedAt']}
    save_json(path, current)


def import_speech(bundle, source):
    check_speech(bundle, source)
    for relative in ['audio/query.wav', 'voice/normal/01-query.wav']:
        target = asset_path(relative); target.parent.mkdir(parents=True, exist_ok=True)
        if source.resolve() != target.resolve():
            shutil.copyfile(source, target)
    save_json(FIX/'audio/speech-source.json', {**bundle, 'publicUseApproved': True})


def import_items(bundle):
    provenance(bundle)
    path = FIX/'masks/items/cases.json'; items = json.loads(path.read_text())
    if len(bundle.get('candidates', [])) != len(items['candidates']):
        raise ValueError('Review every item candidate')
    reviewed = {c['mask']: c for c in bundle['candidates']}
    if len(reviewed) != len(items['candidates']):
        raise ValueError('Duplicate reviewed mask')
    replacements = []
    for current in items['candidates']:
        review = reviewed[current['mask']]
        if digest(asset_path(current['image'])) != review['sourceSha256'] or digest(asset_path(current['mask'])) != review['maskSha256']:
            raise ValueError('Item review hash changed')
        if review.get('approved') is not True:
            raise ValueError('Unapproved item candidate')
        check_item(current)
        replacements.append({**current, 'annotationStatus': 'human-reviewed', 'sourceSha256': review['sourceSha256'], 'maskSha256': review['maskSha256']})
    items.update(candidates=replacements, reviewer=bundle['reviewer'], reviewedAt=bundle['reviewedAt'], humanAttestation=True)
    save_json(path, items)


def import_head(bundle, bundle_bytes):
    provenance(bundle)
    review = json.loads((FIX/'review/head.json').read_text())
    case = next(c for c in review['cases'] if c['id'] == bundle['id'])
    if not isinstance(bundle.get('annotator'), str) or not bundle['annotator'].strip():
        raise ValueError('Missing annotator')
    if timestamp(bundle.get('annotatedAt')) > timestamp(bundle['reviewedAt']):
        raise ValueError('Annotation cannot follow review')
    if digest(asset_path(case['image'])) != bundle['sourceSha256'] or case['sourceSha256'] != bundle['sourceSha256']:
        raise ValueError('Frozen source changed')
    for key in ['expectedPerson', 'expectedRegistration']:
        if type(bundle.get(key)) is not bool or case[key] != bundle[key]:
            raise ValueError('Classification change requires explicit frozen case revision')
    if case['expectedRegistration']:
        data = bundle['maskDataUrl']; prefix = 'data:image/png;base64,'
        if not isinstance(data, str) or not data.startswith(prefix):
            raise ValueError('PNG required')
        with Image.open(io.BytesIO(base64.b64decode(data[len(prefix):], validate=True))) as image, Image.open(asset_path(case['image'])) as source:
            if image.format != 'PNG' or image.size != source.size or getattr(image, 'n_frames', 1) != 1:
                raise ValueError('GT must be one PNG at original dimensions')
            if 'A' in image.getbands() and image.getchannel('A').getextrema() != (255, 255):
                raise ValueError('Opaque annotation canvas required')
            # Conservatively retain every anti-aliased polygon-edge pixel.
            mask = image.convert('L').point(lambda p: 255 if p > 0 else 0)
            if mask.getextrema() != (0, 255):
                raise ValueError('Nonempty, non-full-frame binary head annotation required')
            path = asset_path('masks/head/' + case['id'] + '.png'); path.parent.mkdir(parents=True, exist_ok=True); mask.save(path)
        case['groundTruthMask'] = str(path.relative_to(FIX)); case['groundTruthSha256'] = digest(path)
    elif bundle.get('maskDataUrl') is not None:
        raise ValueError('Rejected classification does not accept a fabricated head mask')
    for key in ['annotator', 'annotatedAt', 'reviewer', 'reviewedAt']:
        case[key] = bundle[key]
    case.update(status='human-approved', humanAttestation=True, reviewBundleSha256=hashlib.sha256(bundle_bytes).hexdigest())
    save_json(FIX/'review/head.json', review)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', type=Path); parser.add_argument('--kind', choices=['head', 'items', 'assets', 'speech'], default='head'); parser.add_argument('--speech-file', type=Path)
    args = parser.parse_args(); raw = args.bundle.read_bytes(); bundle = json.loads(raw)
    if args.kind == 'assets': import_assets(bundle)
    elif args.kind == 'items': import_items(bundle)
    elif args.kind == 'head': import_head(bundle, raw)
    else:
        if not args.speech_file: raise ValueError('--speech-file required')
        import_speech(bundle, args.speech_file)
    print(json.dumps({'status': 'imported', 'kind': args.kind, 'next': 'Regenerate manifest and validate; structural import cannot establish actual human truth or model acceptance.'}))
    return 0


if __name__ == '__main__':
    try: sys.exit(main())
    except (ValueError, KeyError, TypeError, OSError, StopIteration, wave.Error) as exc:
        print(json.dumps({'status': 'failed', 'errorType': type(exc).__name__, 'detail': 'Review rejected; no approval granted for this bundle.'})); sys.exit(1)
