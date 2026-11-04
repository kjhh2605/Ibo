"""Schema-only bootstrap: no credentials, model loading or provider calls."""
from importlib import import_module
from pkgutil import iter_modules

from fastapi import FastAPI, Depends, Header
from fastapi.openapi.utils import get_openapi
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import Error, PayloadTooLarge


def stub():
    return JSONResponse(status_code=501, content={'error': {'code': 'not_implemented', 'message': 'This endpoint is not implemented yet.', 'retryable': False}})


def auth_headers(authorization: str = Header(), x_firebase_appcheck: str = Header(alias='X-Firebase-AppCheck')):
    # S01 must verify these credentials; their presence is not authentication.
    pass


def create_app(*, dependencies=None):
    app = FastAPI(title='Street Fitting Relay', version='0.1.0', docs_url=None, redoc_url=None,
                  dependencies=[Depends(auth_headers), *(dependencies or [])], responses={
                      status: {'model': Error, 'description': description}
                      for status, description in [(400, 'Invalid request'), (401, 'Unauthenticated or invalid query token'), (403, 'App Check failed'), (404, 'Route unavailable'), (409, 'Conflict'), (413, 'Payload too large'), (429, 'Upstream rate limited'), (500, 'Fixture invalid'), (501, 'Not implemented or fixture not found'), (502, 'Upstream error'), (503, 'Model unavailable'), (504, 'Upstream timeout')]
                  })
    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        too_large = any(isinstance(error.get('ctx', {}).get('error'), PayloadTooLarge) or
                        (error['type'] in ('string_too_long', 'less_than_equal') and
                         any(part in ('data', 'width', 'height') for part in error['loc']))
                        for error in exc.errors())
        code = 'payload_too_large' if too_large else 'invalid_request'
        message = 'Payload too large.' if too_large else 'Invalid request.'
        return JSONResponse(status_code=413 if too_large else 400, content={'error': {'code': code, 'message': message, 'retryable': False}}, headers={'Cache-Control': 'no-store'})

    @app.middleware('http')
    async def limit_body(request, call_next):
        limits = {'/v1/search/turn': 16, '/v1/search/segment': 20, '/v1/transcribe': 1,
                  '/v1/describe/storefront': 7, '/v1/describe/piece': 7, '/v1/tryon': 44}
        limit = limits.get(request.url.path, 0) * 1048576 or 4096
        if request.headers.get('content-encoding', 'identity').lower() != 'identity':
            return JSONResponse(status_code=400, content={'error': {'code': 'invalid_request', 'message': 'Invalid request.', 'retryable': False}}, headers={'Cache-Control': 'no-store'})
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > limit:
                return JSONResponse(status_code=413, content={'error': {'code': 'payload_too_large', 'message': 'Payload too large.', 'retryable': False}}, headers={'Cache-Control': 'no-store'})
        request._body = bytes(body)
        return await call_next(request)

    # Capacitor and local web development use distinct origins from the relay.
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r'^https?://(?:localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$',
        allow_methods=['POST'],
        allow_headers=['Authorization', 'Content-Type', 'X-Firebase-AppCheck', 'X-SF-Fixture'],
        expose_headers=['X-Query-Token'],
    )

    @app.middleware('http')
    async def no_store(request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store'
        return response

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

app = create_app()
