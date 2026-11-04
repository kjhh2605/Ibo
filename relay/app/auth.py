"""Firebase signature verification followed by explicit project/provider binding."""
from __future__ import annotations

import hashlib
import hmac
import os
import time
from dataclasses import dataclass
from uuid import uuid4

import firebase_admin
from firebase_admin import app_check, auth, credentials
from google.auth.credentials import AnonymousCredentials
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request

from app.errors import RelayError


@dataclass(frozen=True)
class Principal:
    sub: str


def pseudonym(secret: bytes, uid: str) -> str:
    return hmac.new(secret, ('safety:v1:' + uid).encode(), hashlib.sha256).hexdigest()


class _VerificationCredential(credentials.Base):
    """Public certificate/JWKS verification needs no service-account private key."""
    def get_credential(self):
        return AnonymousCredentials()


class FirebaseVerifier:
    def __init__(self, settings):
        if os.environ.get('FIREBASE_AUTH_EMULATOR_HOST'):
            raise ValueError('Firebase emulator auth is forbidden')
        self.app = firebase_admin.initialize_app(_VerificationCredential(),
            options={'projectId': settings.firebase_project_id, 'httpTimeout': 10},
            name='relay-id-' + uuid4().hex)
        self.check_app = firebase_admin.initialize_app(_VerificationCredential(),
            options={'projectId': settings.firebase_app_id.split(':')[1], 'httpTimeout': 10},
            name='relay-check-' + uuid4().hex)

    def verify_id_token(self, token):
        return auth.verify_id_token(token, app=self.app, check_revoked=False, clock_skew_seconds=0)

    def verify_app_check(self, token):
        return app_check.verify_token(token, app=self.check_app)

    def close(self):
        firebase_admin.delete_app(self.app)
        firebase_admin.delete_app(self.check_app)


class Authenticator:
    def __init__(self, settings, *, verifier=None, clock=time.time):
        self.settings, self.clock = settings, clock
        self.verifier = verifier if verifier is not None else (None if settings.mock_skip_auth else FirebaseVerifier(settings))

    async def authenticate(self, headers) -> Principal:
        if self.settings.mock_skip_auth:
            return Principal(pseudonym(self.settings.hmac_secret, 'street-fitting-mock'))
        authorization = headers.get('authorization', '')
        if not authorization.startswith('Bearer ') or not authorization[7:] or any(c.isspace() for c in authorization[7:]):
            raise RelayError('unauthenticated')
        try:
            claims = await run_in_threadpool(self.verifier.verify_id_token, authorization[7:])
            uid = claims.get('sub')
            if (not isinstance(uid, str) or not 1 <= len(uid) <= 128 or not uid.strip() or
                claims.get('uid', uid) != uid or claims.get('aud') != self.settings.firebase_project_id or
                claims.get('iss') != 'https://securetoken.google.com/' + self.settings.firebase_project_id or
                claims.get('firebase', {}).get('sign_in_provider') != 'anonymous' or
                type(claims.get('exp')) not in (int, float) or claims['exp'] <= self.clock() or
                type(claims.get('iat')) not in (int, float) or claims['iat'] > self.clock()):
                raise ValueError('Invalid claims')
        except Exception:
            raise RelayError('unauthenticated') from None
        token = headers.get('x-firebase-appcheck', '')
        if not token:
            raise RelayError('app_check_failed')
        try:
            claims = await run_in_threadpool(self.verifier.verify_app_check, token)
            project_number = self.settings.firebase_app_id.split(':')[1]
            if (claims.get('app_id', claims.get('sub')) != self.settings.firebase_app_id or
                claims.get('sub') != self.settings.firebase_app_id or
                claims.get('iss') != 'https://firebaseappcheck.googleapis.com/' + project_number or
                not isinstance(claims.get('aud'), list) or 'projects/' + project_number not in claims['aud'] or
                type(claims.get('exp')) not in (int, float) or claims['exp'] <= self.clock()):
                raise ValueError('Invalid claims')
        except Exception:
            raise RelayError('app_check_failed') from None
        return Principal(pseudonym(self.settings.hmac_secret, uid))

    def close(self):
        if isinstance(self.verifier, FirebaseVerifier):
            self.verifier.close()


async def require_auth(request: Request) -> Principal:
    """Use in route Depends or override S00's header-only dependency with this."""
    principal = getattr(request.state, 'principal', None)
    if principal is None:
        principal = await request.app.state.authenticator.authenticate(request.headers)
        request.state.principal = principal
    return principal
