"""Runtime relay factory and an explicitly credential-free schema-export mode."""
import asyncio
from contextlib import asynccontextmanager
from importlib import import_module
from pkgutil import iter_modules

from fastapi import FastAPI, Depends, Header
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import Error


def auth_headers(authorization: str = Header(), x_firebase_appcheck: str = Header(alias='X-Firebase-AppCheck')):
    """Declare OpenAPI headers; the runtime factory always installs verification."""


class LocalCORSMiddleware(CORSMiddleware):
    def preflight_response(self, request_headers):
        response = super().preflight_response(request_headers)
        response.headers['Cache-Control'] = 'no-store'
        return response


def create_app(*, schema_only=False, settings=None, verifier=None, transport=None):
    @asynccontextmanager
    async def lifespan(app):
        try:
            if not schema_only and app.state.settings.mode == 'live':
                from app.pe_text import load_pe_text
                app.state.pe_text = await asyncio.to_thread(load_pe_text, app.state.settings.models_dir)
            yield
        finally:
            if not schema_only:
                try:
                    await app.state.meta.aclose()
                finally:
                    app.state.authenticator.close()

    app = FastAPI(title='Street Fitting Relay', version='0.1.0', docs_url=None, redoc_url=None,
                  lifespan=lifespan, dependencies=[Depends(auth_headers)], responses={
                      status: {'model': Error, 'description': description}
                      for status, description in [(400, 'Invalid request'), (401, 'Unauthenticated or invalid query token'), (403, 'App Check failed'), (404, 'Route unavailable'), (409, 'Conflict'), (413, 'Payload too large'), (429, 'Upstream rate limited'), (500, 'Fixture invalid'), (501, 'Fixture not found'), (502, 'Upstream error'), (503, 'Model unavailable'), (504, 'Upstream timeout')]
                  })
    if not schema_only:
        from app.auth import require_auth
        from app.config import Settings, install_core
        install_core(app, settings if settings is not None else Settings.from_env(),
                     verifier=verifier, transport=transport)
        app.dependency_overrides[auth_headers] = require_auth

    # Capacitor and local web development use distinct origins from the relay.
    # Outside CoreBoundary so authentication and size errors retain CORS headers.
    app.add_middleware(
        LocalCORSMiddleware,
        allow_origin_regex=r'^https?://(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$',
        allow_methods=['POST'],
        allow_headers=['Authorization', 'Content-Type', 'X-Firebase-AppCheck', 'X-SF-Fixture'],
        expose_headers=['X-Query-Token', 'Retry-After'],
    )

    from app import routes
    for module in sorted(iter_modules(routes.__path__), key=lambda item: item.name):
        app.include_router(import_module(f'app.routes.{module.name}').router)
    def openapi():
        if app.openapi_schema is None:
            schema = get_openapi(title=app.title, version=app.version, routes=app.routes)
            for path in schema['paths'].values():
                for operation in path.values():
                    operation.get('responses', {}).pop('422', None)
            app.openapi_schema = schema
        return app.openapi_schema
    app.openapi = openapi
    return app
