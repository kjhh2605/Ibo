"""Real runtime factory with an additional test-only authentication proof endpoint."""
import os

import uvicorn
from fastapi import Request

from app.config import Settings
from app.main import create_app


settings = Settings.from_env({**os.environ, 'RELAY_MODE': 'mock', 'RELAY_MOCK_SKIP_AUTH': '0'})
app = create_app(settings=settings)


@app.post('/v1/core-auth-proof')
async def diagnostic(request: Request):
    return {'authenticated': True, 'pseudonym': request.state.principal.sub}


if __name__ == '__main__':
    print('S01_AUTH_READY', flush=True)
    uvicorn.run(app, host='127.0.0.1', port=int(os.environ['RELAY_PORT']), access_log=False, log_level='critical')
