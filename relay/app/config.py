"""Explicit startup configuration; schema export must not instantiate Settings."""
from __future__ import annotations

import base64
import binascii
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Mapping


@dataclass(frozen=True, repr=False)
class Settings:
    mode: str
    hmac_secret: bytes = field(repr=False)
    model_api_key: str = field(default='', repr=False)
    firebase_project_id: str = ''
    firebase_app_id: str = ''
    mock_skip_auth: bool = False
    log_text: bool = False
    port: int = 8787
    models_dir: Path = field(default_factory=lambda: Path.home() / '.cache/street-fitting/models')
    fixtures_dir: Path = Path('verification/fixtures/relay')

    def __post_init__(self):
        if self.mode not in ('mock', 'live'):
            raise ValueError('RELAY_MODE must be explicitly live or mock')
        if len(self.hmac_secret) < 32:
            raise ValueError('RELAY_HMAC_SECRET requires at least 32 decoded bytes')
        if self.mode == 'live' and self.mock_skip_auth:
            raise ValueError('Live mode cannot skip authentication')
        if self.mode == 'live' and not self.model_api_key.strip():
            raise ValueError('MODEL_API_KEY is required in live mode')
        if not self.mock_skip_auth:
            import re
            if not self.firebase_project_id or not re.fullmatch(r'1:[0-9]+:android:[A-Za-z0-9]+', self.firebase_app_id):
                raise ValueError('Firebase project and Android app IDs are required')
        if type(self.port) is not int or not 1 <= self.port <= 65535:
            raise ValueError('PORT must be between 1 and 65535')

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None):
        env = os.environ if env is None else env
        def flag(name):
            value = env.get(name, '0')
            if value not in ('0', '1'):
                raise ValueError(name + ' must be 0 or 1')
            return value == '1'
        try:
            encoded = env.get('RELAY_HMAC_SECRET', '')
            secret = base64.b64decode(encoded, validate=True)
            if base64.b64encode(secret).decode() != encoded:
                raise ValueError()
        except (ValueError, binascii.Error):
            raise ValueError('RELAY_HMAC_SECRET must be canonical base64') from None
        try:
            port = int(env.get('PORT', '8787'))
        except ValueError:
            raise ValueError('PORT must be an integer') from None
        return cls(mode=env.get('RELAY_MODE', ''), hmac_secret=secret,
                   model_api_key=env.get('MODEL_API_KEY', ''),
                   firebase_project_id=env.get('FIREBASE_PROJECT_ID', ''),
                   firebase_app_id=env.get('FIREBASE_APP_ID', ''),
                   mock_skip_auth=flag('RELAY_MOCK_SKIP_AUTH'), log_text=flag('RELAY_LOG_TEXT'), port=port,
                   models_dir=Path(env.get('SF_MODELS_DIR', '~/.cache/street-fitting/models')).expanduser(),
                   fixtures_dir=Path(env.get('RELAY_FIXTURES_DIR', str(Path(__file__).resolve().parents[2] / 'verification/fixtures/relay'))).expanduser())


def install_core(app, settings: Settings, *, verifier=None, transport=None):
    """Call once before serving. Close app.state.meta in the application's lifespan.

    Production: Settings.from_env(), no overrides. Tests may inject a Firebase
    verifier or httpx transport, never a live skip-auth flag. Existing S00
    auth_headers must be overridden with require_auth; remove its old middleware.
    """
    from app.auth import Authenticator
    from app.errors import CoreBoundary, install_error_handlers
    from app.logging import configure_logging
    from app.meta_client import MetaClient
    from app.mock import FixtureLoader
    from app.token import QueryTokens
    configure_logging()
    app.state.settings = settings
    app.state.authenticator = Authenticator(settings, verifier=verifier)
    app.state.tokens = QueryTokens(settings.hmac_secret)
    app.state.meta = MetaClient(settings, transport=transport)
    app.state.fixtures = FixtureLoader(settings.fixtures_dir)
    install_error_handlers(app)
    app.add_middleware(CoreBoundary, authenticator=app.state.authenticator, settings=settings)
