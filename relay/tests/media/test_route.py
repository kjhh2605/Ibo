import asyncio
import copy
import json

import httpx
import pytest

from app.errors import RelayError
from app.meta_client import DEADLINES, Operation
from app.routes import route as routing
from .conftest import ROUTE, osrm_output


@pytest.fixture(autouse=True)
def fresh_gate(monkeypatch):
    monkeypatch.setattr(routing, '_starts', routing._StartGate())


def test_fixed_foot_endpoint_lng_lat_order(provider):
    client, calls = provider(osrm_output())
    response = client.post('/v1/route', json=ROUTE)
    assert response.status_code == 200
    request = calls[0]
    assert request.url.host == 'routing.openstreetmap.de'
    assert request.url.path == '/routed-foot/route/v1/driving/13.101,52.101;13.201,52.201'
    assert dict(request.url.params) == {'overview': 'full', 'geometries': 'geojson', 'steps': 'true', 'alternatives': 'false'}
    assert 'authorization' not in request.headers
    assert request.headers['user-agent'].startswith('StreetFitting/')


@pytest.mark.parametrize('status,body', [(200, {'code': 'NoRoute'}), (200, {'code': 'NoSegment'}),
                                        (400, {'code': 'NoSegment'}), (400, {'code': 'NoRoute'}),
                                        (200, {'code': 'Ok', 'routes': []})])
def test_no_route_no_segment_empty_routes_map_404(provider, status, body):
    client, calls = provider(body, status)
    response = client.post('/v1/route', json=ROUTE)
    assert response.status_code == 404
    assert response.json()['error']['code'] == 'route_unavailable'
    assert 'geometry' not in response.json()
    assert len(calls) == 1


@pytest.mark.parametrize('status,body,expected,retryable', [
    (429, {'code': 'NoRoute'}, 429, True), (503, {'code': 'NoRoute'}, 502, True),
    (403, {}, 502, False), (200, {}, 502, True), (200, {'code': 'InvalidQuery'}, 502, True)])
def test_osrm_error_mapping(provider, status, body, expected, retryable):
    client, calls = provider(body, status, {'Retry-After': '5'})
    response = client.post('/v1/route', json=ROUTE)
    assert response.status_code == expected
    assert response.json()['error']['retryable'] is retryable
    assert len(calls) == 1
    if expected == 429:
        assert response.headers['Retry-After'] == '5'


def test_osrm_timeout(provider):
    client, calls = provider(exception=httpx.ReadTimeout('private coordinates'))
    assert client.post('/v1/route', json=ROUTE).status_code == 504
    assert len(calls) == 1


@pytest.mark.parametrize('damage', ['geometry', 'distance', 'duration', 'waypoints', 'legs', 'steps', 'bearing', 'coordinate'])
def test_bad_schema_maps_upstream_error(provider, damage):
    body = osrm_output()
    first = body['routes'][0]
    if damage == 'geometry': first['geometry']['type'] = 'Point'
    elif damage == 'distance': first['distance'] = -1
    elif damage == 'duration': first['duration'] = '80'
    elif damage == 'waypoints': body['waypoints'].pop()
    elif damage == 'legs': del first['legs']
    elif damage == 'steps': del first['legs'][0]['steps']
    elif damage == 'bearing': first['legs'][0]['steps'][0]['maneuver']['bearing_after'] = 360
    elif damage == 'coordinate': first['geometry']['coordinates'][0][0] = 181
    client, _ = provider(body)
    assert client.post('/v1/route', json=ROUTE).status_code == 502


def test_steps_and_two_waypoints_preserved_without_destination_rewrite(provider):
    body = osrm_output()
    other = copy.deepcopy(body['routes'][0]['legs'][0])
    other['steps'][0]['maneuver'].update(type='unknown-future-type', modifier='unknown-future-modifier')
    body['routes'][0]['legs'].append(other)
    client, _ = provider(body)
    original = copy.deepcopy(ROUTE)
    response = client.post('/v1/route', json=original)
    assert response.status_code == 200
    result = response.json()
    assert result['geometry'] == body['routes'][0]['geometry']
    assert result['waypoints'] == [{'location': [13.1, 52.1], 'distanceM': 3}, {'location': [13.2, 52.2], 'distanceM': 7}]
    assert [s['maneuver']['type'] for s in result['steps']] == ['depart', 'unknown-future-type']
    assert 'modifier' not in result['steps'][0]['maneuver']
    assert result['steps'][1]['maneuver']['modifier'] == 'unknown-future-modifier'
    assert original == ROUTE


def test_global_start_interval_at_least_one_second():
    async def run():
        now = [100.0]
        async def sleep(delay):
            # Wake early once; gate must recheck rather than blindly grant the slot.
            now[0] += max(delay / 2, 0.00001)
            await asyncio.sleep(0)
        gate = routing._StartGate(clock=lambda: now[0], sleep=sleep)
        starts = []
        async def start():
            await gate.wait()
            starts.append(now[0])
        await asyncio.gather(*(start() for _ in range(5)))
        assert all(b - a >= 1 for a, b in zip(starts, starts[1:]))
    asyncio.run(run())


def test_queue_wait_included_in_deadline(provider, monkeypatch):
    gate = routing._StartGate()
    gate.last_start = gate.clock()
    monkeypatch.setattr(routing, '_starts', gate)
    monkeypatch.setitem(DEADLINES, Operation.OSRM, 0.02)
    client, calls = provider(osrm_output())
    response = client.post('/v1/route', json=ROUTE)
    assert response.status_code == 504
    assert response.json()['error']['code'] == 'upstream_timeout'
    assert not calls


def test_cancelled_wait_does_not_reserve_next_slot():
    async def run():
        now = [0.0]
        waiting = asyncio.Event()
        async def sleep(delay):
            waiting.set()
            await asyncio.Future()
        gate = routing._StartGate(clock=lambda: now[0], sleep=sleep)
        await gate.wait()
        task = asyncio.create_task(gate.wait())
        await waiting.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        now[0] = 1.0
        await gate.wait()
        assert gate.last_start == 1.0
    asyncio.run(run())


def test_transport_start_spacing_survives_preparation_jitter():
    async def run():
        now = [100.0]
        async def sleep(delay):
            now[0] += delay
            await asyncio.sleep(0)
        gate = routing._StartGate(clock=lambda: now[0], sleep=sleep)
        starts = []
        for preparation in (0.1, 0.0, 0.5, 0.01):
            async with gate.attempt():
                now[0] += preparation
                starts.append(now[0])
                await asyncio.sleep(0)
        assert all(b - a >= 1 for a, b in zip(starts, starts[1:]))
    asyncio.run(run())


def test_serial_queue_wait_shares_deadline(provider, monkeypatch):
    gate = routing._starts
    monkeypatch.setitem(DEADLINES, Operation.OSRM, 0.02)
    client, calls = provider(osrm_output())
    client.portal.call(gate.serial.acquire)
    try:
        assert client.post('/v1/route', json=ROUTE).status_code == 504
        assert not calls
    finally:
        client.portal.call(gate.serial.release)
