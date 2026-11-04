"""Original 22-image/7-query experiment only; missing device vectors fail explicitly."""
import hashlib
import json
import os
import time
from pathlib import Path

import pytest

from app.pe_text import CHECKPOINT_REVISION, IMAGE_SHA256, load_pe_text, sha256

MANIFEST_SHA256 = 'db6a42b61f9f111e29525d4123f8038d2856aa7a028f775afa36b43a6d663d8e'
RESULTS_SHA256 = '039d4247eb1db1b9b639066aa076f1dcaecfda45564df6c5aafcfc32fba490ba'


def original_path(root, original):
    relative = Path(original).relative_to('/tmp/edgetam-poc')
    path = (root / relative).resolve()
    assert path.is_relative_to(root) and path.is_file(), f'Missing original corpus asset: {relative}'
    return path


@pytest.fixture(scope='module')
def corpus():
    assert os.environ.get('SF_REAL_PE_TEST') == '1'
    import numpy as np
    import onnxruntime as ort
    from PIL import Image
    root = Path(os.environ.get('SF_MODELS_DIR', '~/.cache/street-fitting/models')).expanduser().resolve()
    directory = root / 'retrieval_r4'
    assert directory.is_dir(), f'Missing original research corpus: {directory}'
    assert sha256(directory / 'manifest.json') == MANIFEST_SHA256, 'Original research manifest changed'
    assert sha256(directory / 'results.json') == RESULTS_SHA256, 'Original seven phrases/ground truth changed'
    manifest = json.loads((directory / 'manifest.json').read_text())
    original_results = json.loads((directory / 'results.json').read_text())
    images, queries = manifest['images'], original_results['queries']
    assert len(images) == 22 and len(queries) == 7
    assert manifest['queries'] == [row['query'] for row in queries]
    encoder = load_pe_text(root)
    reference = np.load(directory / 'image_embeddings.npy', allow_pickle=False)
    assert reference.shape == (22, 512) and np.isfinite(reference).all()
    assert sha256(root / 'pe_image.onnx') == IMAGE_SHA256
    session = ort.InferenceSession(str(root / 'pe_image.onnx'), providers=['CPUExecutionProvider'])
    rows, hashes = [], []
    for item in images:
        path = original_path(root, item['path'])
        hashes.append({'id': item['id'], 'sha256': sha256(path)})
        with Image.open(path) as source:
            # Original squash preprocessing; no center crop, EXIF rewrite, or augmentation.
            rgb = source.convert('RGB').resize((384, 384), Image.Resampling.BILINEAR)
            tensor = np.asarray(rgb, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
            tensor = (tensor - 0.5) / 0.5
        vector = session.run(['embedding'], {'image': tensor})[0]
        assert vector.shape == (1, 512) and np.isfinite(vector).all()
        norm = np.linalg.norm(vector)
        assert norm > 0
        rows.append(vector[0] / norm)
    actual = np.stack(rows)
    assert np.max(np.abs(actual - reference)) <= 1e-4, 'Original image/preprocessing/vector provenance differs'
    started = time.perf_counter()
    text = np.array([encoder.encode(row['query']) for row in queries], dtype=np.float32)
    print(json.dumps({'checkpoint_revision': CHECKPOINT_REVISION, 'image_sha256': IMAGE_SHA256,
                      'manifest_sha256': MANIFEST_SHA256, 'results_sha256': RESULTS_SHA256,
                      'image_hashes': hashes, 'reference_vectors_sha256': sha256(directory / 'image_embeddings.npy'),
                      'load_seconds': encoder.load_seconds, 'seven_text_seconds': time.perf_counter() - started,
                      'image_vector_max_abs_error': float(np.max(np.abs(actual - reference)))}, sort_keys=True))
    return images, queries, text, actual, hashes


def rankings(images, queries, text, vectors):
    import numpy as np
    assert vectors.shape == (22, 512) and np.isfinite(vectors).all()
    assert np.max(np.abs(np.linalg.norm(vectors, axis=1) - 1)) <= 1e-4
    scores = text @ vectors.T
    rows = []
    for query, score in zip(queries, scores, strict=True):
        order = np.argsort(-score, kind='stable')[:3]
        ids = [images[int(i)]['id'] for i in order]
        rows.append({'query': query['query'], 'relevant_ids': query['relevant_ids'], 'top3': ids,
                     'top1_hit': ids[0] in query['relevant_ids'],
                     'top3_hit': any(i in query['relevant_ids'] for i in ids)})
    return rows


def test_research_22_images_7_phrases_top3_seven_of_seven(corpus):
    images, queries, text, vectors, _ = corpus
    rows = rankings(images, queries, text, vectors)
    print(json.dumps({'source': 'M1 CPU image ONNX + actual relay text tower', 'rankings': rows}))
    assert sum(row['top3_hit'] for row in rows) == 7
    assert [row['top3'] for row in rows] == [[item['id'] for item in row['top3']] for row in queries]
    print(f'top1={sum(row["top1_hit"] for row in rows)}/7; top3=7/7; original_top1=6/7')


def test_device_image_vectors_rank_with_real_text_tower(corpus):
    import numpy as np
    path = os.environ.get('SF_DEVICE_PE_MANIFEST')
    assert path, 'MISSING PREREQUISITE: S05/S11 device-vector manifest; Mac vectors cannot replace device evidence'
    manifest_path = Path(path).expanduser().resolve()
    manifest = json.loads(manifest_path.read_text())
    images, queries, text, _, hashes = corpus
    assert manifest['checkpointRevision'] == CHECKPOINT_REVISION
    assert manifest['imageModelSha256'] == IMAGE_SHA256
    assert manifest['source']['platform'] == 'android'
    assert manifest['source']['appId'] == 'com.streetfitting.app'
    assert manifest['source']['device'] and manifest['source']['command']
    assert manifest['images'] == hashes, 'Device must index the exact original images in manifest order'
    vector_path = (manifest_path.parent / manifest['vectorsFile']).resolve()
    assert vector_path.is_relative_to(manifest_path.parent)
    assert sha256(vector_path) == manifest['vectorsSha256']
    vectors = np.load(vector_path, allow_pickle=False)
    rows = rankings(images, queries, text, vectors)
    print(json.dumps({'source': manifest['source'], 'vectors_sha256': manifest['vectorsSha256'], 'rankings': rows}))
    assert sum(row['top3_hit'] for row in rows) == 7
