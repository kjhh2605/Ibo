"""Offline PE-Core-T16 text tower paired with the preserved image ONNX.

No model downloads, fallback encoders, or per-request model construction. Hashes
bind the checkpoint/tokenizer/config to the research bundle, not just filenames.
"""
from __future__ import annotations

import hashlib
import importlib
import math
import os
import sys
import threading
import time
from dataclasses import asdict
from pathlib import Path

from app.errors import RelayError

MODEL = 'PE-Core-T16-384'
CHECKPOINT_REVISION = '8b4722741a516c18e7d311f158f13c600fea6c78'
SOURCE_REVISION = '3e352cca660658d4b5c90f42a7808b11469e4c66'
IMAGE_SHA256 = '10b2683490922a82a61ee108673fc94ea455c6ad3996b1f2dc86f93a935d114c'
CHECKPOINT_SHA256 = '868f89f066b7c1ae51add02d2cb7b925fd051076282773f2ec3c71359fbdaf3b'
SOURCE_HASHES = {
    'pe.py': '36b62204c4cf12a709946facce2df8980e0880bf06deb6e49a2aa288158c3d53',
    'config.py': '37c10ea7b68889241c8d9ebce27c62577c7379a33c444f9b0129bc90946aaff5',
    'rope.py': '85a16113138f26389ea35fccd313f2aca12945c7ed2eb24e5d52dbe680dad121',
    'tokenizer.py': '42db8b142e1fe7a9b7d294049e063c8bd454e6902e94af2eebf3769c3927186d',
    'bpe_simple_vocab_16e6.txt.gz': '924691ac288e54409236115652ad4aa250f48203de50a9e4722a6ecd48d6804a',
}
_LOAD_LOCK = threading.Lock()
_LOADED = {}


def sha256(path):
    with Path(path).open('rb') as file:
        return hashlib.file_digest(file, 'sha256').hexdigest()


def verify_bundle(root):
    root = Path(root).expanduser().resolve()
    source = root / 'perception_models'
    checkpoint = root / 'hf_cache' / 'hub' / 'models--facebook--PE-Core-T16-384' / 'snapshots' / CHECKPOINT_REVISION / (MODEL + '.pt')
    files = {root / 'pe_image.onnx': IMAGE_SHA256, checkpoint: CHECKPOINT_SHA256}
    files.update({source / 'core' / 'vision_encoder' / name: digest for name, digest in SOURCE_HASHES.items()})
    try:
        for path, digest in files.items():
            if not path.resolve().is_relative_to(root) or not path.is_file() or sha256(path) != digest:
                raise ValueError()
    except (OSError, ValueError):
        raise RelayError('model_unavailable') from None
    return root, source, checkpoint


class PEText:
    def __init__(self, model, tokenizer, torch, root, load_seconds):
        self.model, self.tokenizer, self.torch = model, tokenizer, torch
        self.root, self.load_seconds = root, load_seconds
        self.checkpoint_revision, self.source_revision = CHECKPOINT_REVISION, SOURCE_REVISION
        self.checkpoint_sha256, self.image_sha256 = CHECKPOINT_SHA256, IMAGE_SHA256
        self._lock = threading.Lock()

    def encode(self, phrase: str) -> list[float]:
        if not isinstance(phrase, str) or not phrase.strip() or len(phrase) > 160:
            raise RelayError('model_unavailable')
        try:
            # SimpleTokenizer has a mutable BPE cache; serialize it with CPU inference.
            with self._lock, self.torch.inference_mode():
                tokens = self.tokenizer([phrase]).to(device='cpu')
                vector = self.model(tokens).float()
                if tuple(vector.shape) != (1, 512) or not self.torch.isfinite(vector).all().item():
                    raise ValueError()
                norm = self.torch.linalg.vector_norm(vector, dim=-1, keepdim=True)
                if not self.torch.isfinite(norm).all().item() or norm.item() <= 0:
                    raise ValueError()
                result = (vector / norm)[0].tolist()
            if not all(math.isfinite(x) for x in result) or abs(math.sqrt(sum(x*x for x in result)) - 1) > 1e-5:
                raise ValueError()
            return result
        except Exception:
            raise RelayError('model_unavailable') from None


def load_pe_text(models_dir) -> PEText:
    """Called once by live lifespan. Same root returns one CPU/eval instance."""
    root = Path(models_dir).expanduser().resolve()
    with _LOAD_LOCK:
        if root in _LOADED:
            return _LOADED[root]
        started = time.perf_counter()
        root, source, checkpoint = verify_bundle(root)
        try:
            os.environ['HF_HOME'] = str(root / 'hf_cache')
            os.environ['HF_HUB_OFFLINE'] = '1'
            # Direct local checkpoint loading deliberately avoids fetch_pe_checkpoint.
            # In particular there is no remote hf_hub_download fallback.
            import torch
            for name in ('core', 'core.vision_encoder', 'core.vision_encoder.pe', 'core.vision_encoder.config', 'core.vision_encoder.tokenizer'):
                module = sys.modules.get(name)
                if module is not None and getattr(module, '__file__', None) and not Path(module.__file__).resolve().is_relative_to(source):
                    raise ValueError()
            if str(source) not in sys.path:
                sys.path.insert(0, str(source))
            config = importlib.import_module('core.vision_encoder.config')
            pe = importlib.import_module('core.vision_encoder.pe')
            tokenizer_module = importlib.import_module('core.vision_encoder.tokenizer')
            text_config = config.PE_TEXT_CONFIG[MODEL]
            if (text_config.context_length, text_config.width, text_config.heads, text_config.layers,
                text_config.output_dim, text_config.vocab_size) != (32, 512, 8, 12, 512, 49408):
                raise ValueError()
            model = pe.TextTransformer(**asdict(text_config)).to(device='cpu').eval()
            weights = torch.load(checkpoint, map_location='cpu', weights_only=True)
            if 'state_dict' in weights:
                weights = weights['state_dict']
            elif 'weights' in weights:
                weights = weights['weights']
            normalized = {}
            for key, value in weights.items():
                key = key.removeprefix('module.')
                if key in normalized:
                    raise ValueError()
                normalized[key] = value
            # CLIP inherits TextTransformer: text keys have no text.* prefix.
            text_weights = {k: v for k, v in normalized.items() if not k.startswith('visual.') and k != 'logit_scale'}
            model.load_state_dict(text_weights, strict=True)
            model.requires_grad_(False)
            tokenizer = tokenizer_module.SimpleTokenizer(
                bpe_path=str(source / 'core' / 'vision_encoder' / 'bpe_simple_vocab_16e6.txt.gz'), context_length=32)
            if tokenizer.vocab_size != 49408:
                raise ValueError()
            encoder = PEText(model, tokenizer, torch, root, time.perf_counter() - started)
            encoder.encode('a blue jacket')  # Fail startup, not the first consumer request.
            _LOADED[root] = encoder
            return encoder
        except Exception:
            raise RelayError('model_unavailable') from None
