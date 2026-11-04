"""FOSSGIS foot routing, with process-wide start spacing and no fallback routes."""
import asyncio
import threading
import time
from contextlib import asynccontextmanager

from fastapi import APIRouter, Request
from pydantic import ValidationError

from app.errors import RelayError
from app.meta_client import Operation, deadline
from app.schemas import RouteRequest, RouteResponse

router = APIRouter()


class _StartGate:
    """Single-worker scheduler; cancelled queue entries never reserve a slot."""
    def __init__(self, clock=time.monotonic, sleep=asyncio.sleep):
        self.clock = clock
        self.sleep = sleep
        self.lock = threading.Lock()
        self.serial = asyncio.Lock()
        self.last_start = float('-inf')

    async def wait(self):
        while True:
            with self.lock:
                now = self.clock()
                delay = self.last_start + 1.0 - now
                if delay <= 0:
                    self.last_start = now
                    return
            await self.sleep(delay)

    @asynccontextmanager
    async def attempt(self):
        async with self.serial:
            await self.wait()
            try:
                yield
            finally:
                # Transport starts after local request preparation. Anchor the next
                # slot after this attempt settles, so prep jitter cannot reduce the
                # observed HTTP start interval below one second.
                with self.lock:
                    self.last_start = self.clock()


# One instance for every app/user in the required single-worker event loop.
_starts = _StartGate()

def _coordinate(value):
    if not isinstance(value, list):
        raise ValueError('Expected coordinate array')
    return tuple(value)



def _route_response(result):
    try:
        if result.get('code') in ('NoRoute', 'NoSegment'):
            raise RelayError('route_unavailable')
        if result.get('code') != 'Ok' or not isinstance(result['routes'], list):
            raise ValueError('Invalid route response')
        if not result['routes']:
            raise RelayError('route_unavailable')
        route = result['routes'][0]
        steps = []
        if not isinstance(route['legs'], list) or not route['legs']:
            raise ValueError('Missing legs')
        for leg in route['legs']:
            if not isinstance(leg['steps'], list):
                raise ValueError('Missing steps')
            for step in leg['steps']:
                maneuver = step['maneuver']
                mapped = {'type': maneuver['type'], 'location': _coordinate(maneuver['location']),
                          'bearingBefore': maneuver['bearing_before'],
                          'bearingAfter': maneuver['bearing_after']}
                if 'modifier' in maneuver:
                    mapped['modifier'] = maneuver['modifier']
                steps.append({'distanceM': step['distance'], 'durationS': step['duration'],
                              'name': step['name'], 'maneuver': mapped})
        geometry = route['geometry']
        if not isinstance(geometry['coordinates'], list) or not isinstance(result['waypoints'], list):
            raise ValueError('Expected route arrays')
        body = {'geometry': {'type': geometry['type'],
                             'coordinates': [_coordinate(c) for c in geometry['coordinates']]},
                'distanceM': route['distance'], 'durationS': route['duration'], 'steps': steps,
                'waypoints': [{'location': _coordinate(w['location']), 'distanceM': w['distance']}
                              for w in result['waypoints']]}
        # Wire's before-validator turns JSON into Python; normalize only coordinate
        # containers so strict validation still rejects numeric strings and booleans.
        return RouteResponse.model_validate(body, strict=True)
    except (KeyError, IndexError, TypeError, ValueError, ValidationError):
        raise RelayError('upstream_error') from None


@router.post('/v1/route', response_model=RouteResponse, response_model_exclude_none=True)
async def route(request: RouteRequest, http: Request):
    if http.app.state.settings.mode == 'mock':
        replay, _ = http.app.state.fixtures.prepare(
            http.state.fixture_scenario, 'route', 1, request.model_dump())
        return replay.result()
    async with deadline(Operation.OSRM):
        async with _starts.attempt():
            result = await http.app.state.meta.route(
                request.origin.model_dump(), request.destination.model_dump())
            return _route_response(result)
