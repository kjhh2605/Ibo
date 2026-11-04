"""Run actual create_app on loopback TCP; never connects to live providers.

From relay/: uv run python tests/search/http_smoke.py
Synthetic contract fixtures are temporary harness inputs, not provider recordings.
"""
import builtins
import io
import json
import logging
import socket
import sys
import tempfile
import threading
import time
from pathlib import Path
from unittest.mock import patch

import httpx
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from app.auth import pseudonym
from app.config import Settings
from app.main import create_app
from harness import Flow, image, install_scenarios, summary


def run():
    evidence = []
    for log_text in (False, True):
        with tempfile.TemporaryDirectory(prefix='sf-search-fixture-') as directory:
            install_scenarios(directory)
            settings = Settings(mode='mock', hmac_secret=b'loopback-search-not-a-secret-0000', mock_skip_auth=True,
                                log_text=log_text, fixtures_dir=Path(directory))
            app = create_app(settings=settings)
            log_stream = io.StringIO()
            handler = logging.StreamHandler(log_stream)
            logger = logging.getLogger('street_fitting.relay')
            logger.addHandler(handler)
            logger.setLevel(logging.DEBUG)
            sock = socket.socket()
            sock.bind(('127.0.0.1', 0))
            port = sock.getsockname()[1]
            server = uvicorn.Server(uvicorn.Config(app, log_config=None, access_log=False, lifespan='on'))
            thread = threading.Thread(target=server.run, kwargs={'sockets': [sock]}, daemon=True)
            thread.start()
            deadline = time.monotonic() + 10
            while not server.started:
                if not thread.is_alive() or time.monotonic() > deadline:
                    raise RuntimeError('Loopback server did not start')
                time.sleep(0.01)
            responses = []
            original_connect = socket.socket.connect
            original_open = builtins.open
            writes, external = [], []
            def local_only(self, address):
                if not isinstance(address, tuple) or address[0] not in ('127.0.0.1', '::1'):
                    external.append('blocked')
                    raise AssertionError('External network forbidden')
                return original_connect(self, address)
            def no_write(file, mode='r', *args, **kwargs):
                if any(c in mode for c in 'wax+'):
                    writes.append('blocked')
                    raise AssertionError('Server/request persisted a file')
                return original_open(file, mode, *args, **kwargs)
            def record(response):
                response.read()
                assert response.headers['cache-control'] == 'no-store'
                responses.append(response.status_code)
            try:
                with patch.object(socket.socket, 'connect', local_only), patch('builtins.open', no_write):
                    with httpx.Client(base_url=f'http://127.0.0.1:{port}', trust_env=False,
                                      event_hooks={'response': [record]}) as client:
                        flow = Flow(client).to_extract()
                        segmented = flow.segment()
                        assert segmented.status_code == 200
                        assert len(segmented.json()['photos'][0]['candidates']) == 4
                        final = flow.turn(summary(segmented))
                        assert final.status_code == 200 and 'final' in final.json()
                        state = app.state.tokens.verify(flow.token, pseudonym(settings.hmac_secret, 'street-fitting-mock'), scenario='normal')
                        assert (state.sparkTurns, state.samPhotos, state.closed) == (4, 1, True)
                        fifth = client.post('/v1/search/turn', json={'query': flow.query, 'queryToken': flow.token, 'toolResults': []})
                        assert fifth.status_code == 409 and fifth.json()['error']['code'] == 'turn_limit_exceeded'
                        failure = Flow(client, 'upstream-timeout').turn()
                        assert failure.status_code == 504
                        failed = app.state.tokens.verify(failure.headers['X-Query-Token'], pseudonym(settings.hmac_secret, 'street-fitting-mock'), scenario='upstream-timeout')
                        assert failed.closed and failed.sparkTurns == 1
                        wrong = Flow(client).turn(query='wrong recording')
                        assert wrong.status_code == 409
                        invalid = client.post('/v1/search/turn', json={'query': 'test', 'context': {}, 'messages': []})
                        assert invalid.status_code == 400
                        assert not writes and not external
                        logs = log_stream.getvalue()
                        for sentinel in (flow.token, failure.headers['X-Query-Token'], image()['data'], 'data:image', '37.123456', '127.123456'):
                            assert sentinel not in logs
                        evidence.append({'log_text': log_text, 'statuses': responses, 'spark_turns': state.sparkTurns,
                                         'sam_photos': state.samPhotos, 'sam_candidates_preserved': 4,
                                         'failure_consumed_closed': True, 'external_calls': len(external),
                                         'request_file_writes': len(writes), 'privacy_sentinels_absent': True})
            finally:
                server.should_exit = True
                thread.join(10)
                sock.close()
                logger.removeHandler(handler)
                assert not thread.is_alive()
    print(json.dumps({'surface': 'create_app + Uvicorn + real loopback TCP', 'runs': evidence}, indent=2))


if __name__ == '__main__':
    run()
