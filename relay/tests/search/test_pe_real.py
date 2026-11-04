"""Explicit real-model gate: missing resources fail, never skip or fake a vector."""
import math
import os
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.errors import RelayError
from app.main import create_app
from app.pe_text import (CHECKPOINT_REVISION, CHECKPOINT_SHA256, IMAGE_SHA256, SOURCE_HASHES,
                         SOURCE_REVISION, load_pe_text, sha256, verify_bundle)


@pytest.fixture
def real_encoder():
    assert os.environ.get('SF_REAL_PE_TEST') == '1', 'Run this gate explicitly with SF_REAL_PE_TEST=1'
    root = Path(os.environ.get('SF_MODELS_DIR', '~/.cache/street-fitting/models')).expanduser()
    assert root.is_dir(), f'Missing authoritative SF_MODELS_DIR bundle: {root}'
    return load_pe_text(root)


def test_real_text_weights_loaded_once_on_cpu(real_encoder):
    assert load_pe_text(real_encoder.root) is real_encoder
    assert not real_encoder.model.training
    assert all(p.device.type == 'cpu' and not p.requires_grad for p in real_encoder.model.parameters())
    print(f'PE load_seconds={real_encoder.load_seconds:.6f}; CPU/eval; instance_reused=true')


def test_real_phrase_vector_is_finite_512_unit_norm(real_encoder):
    started = time.perf_counter()
    vector = real_encoder.encode('a blue jacket')
    elapsed = time.perf_counter() - started
    assert len(vector) == 512 and all(math.isfinite(v) for v in vector)
    error = abs(math.sqrt(sum(v*v for v in vector)) - 1)
    assert error <= 1e-5
    print(f'PE warm_seconds={elapsed:.6f}; norm_error={error:.12g}')


def test_checkpoint_and_tokenizer_revision_match_image(real_encoder):
    root, source, checkpoint = verify_bundle(real_encoder.root)
    assert sha256(checkpoint) == CHECKPOINT_SHA256
    assert sha256(root / 'pe_image.onnx') == IMAGE_SHA256
    assert all(sha256(source / 'core' / 'vision_encoder' / name) == digest for name, digest in SOURCE_HASHES.items())
    assert real_encoder.checkpoint_revision == CHECKPOINT_REVISION
    assert real_encoder.source_revision == SOURCE_REVISION
    print(f'checkpoint_revision={CHECKPOINT_REVISION}; source_revision={SOURCE_REVISION}; image_sha256={IMAGE_SHA256}')


def test_live_missing_or_mismatched_weights_fails_startup(tmp_path):
    # Actual create_app lifespan loader; no monkeypatch of model loading.
    for root in (tmp_path / 'missing', tmp_path / 'mismatched'):
        if root.name == 'mismatched':
            root.mkdir()
            (root / 'pe_image.onnx').write_bytes(b'not the research checkpoint')
        settings = Settings(mode='live', hmac_secret=b'real-gate-not-a-credential-000000',
                            model_api_key='unused-no-provider-calls', firebase_project_id='unused',
                            firebase_app_id='1:123:android:abc', models_dir=root)
        # Verifier is unused; this gate exercises startup, not Firebase.
        app = create_app(settings=settings, verifier=object())
        with pytest.raises(RelayError) as caught:
            with TestClient(app):
                pytest.fail('Live startup accepted missing/mismatched PE weights')
        assert caught.value.code == 'model_unavailable'
