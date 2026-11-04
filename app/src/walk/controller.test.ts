import {deferred} from '../deferred';
import type {RouteResponse} from './types';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createWalk} from './controller';
import {bearing, distance, instruction, project, routeLengths} from './geometry';
import {MockRoute} from './mock';
import {fix, harness, position, routeFixture} from './test-fixtures';
import {WalkError} from './types';
import type {WalkController} from './controller';

const controllers: WalkController[] = [];
async function start(response = routeFixture()) {
  const context = harness(response);
  controllers.push(context.walk);
  await context.walk.start({source: 'item', pieceId: 'piece'});
  return context;
}
afterEach(async () => { await Promise.all(controllers.splice(0).map(walk => walk.stop())); vi.restoreAllMocks(); });

async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }

describe('gpx geometry and progress', () => {
  it('uses metres, true north bearing and longitude-latitude geometry', () => {
    expect(distance(position(0, 0), position(100, 0))).toBeCloseTo(100, 6);
    expect(bearing(position(0, 0), position(0, 100))).toBe(0);
    expect(bearing(position(0, 0), position(100, 0))).toBe(90);
    expect(bearing(position(0, 0), position(0, -100))).toBe(180);
    expect(bearing(position(0, 0), position(-100, 0))).toBe(270);
    expect(distance({lat: 0, lng: 179.999}, {lat: 0, lng: -179.999})).toBeLessThan(225);
    const route = routeFixture();
    expect(project(position(50, 200), route.geometry.coordinates, routeLengths(route)).progressM).toBeCloseTo(250, 4);
  });

  it('advances turns at 15m, uses remaining geometry and duration, and keeps step on GPS jitter', async () => {
    const {walk, location} = await start();
    location.push(fix(0, 100, 2000));
    expect(walk.getState()).toMatchObject({mode: 'route', stepIndex: 0});
    expect(walk.getState()!.distanceM).toBeCloseTo(300, 3);
    expect(walk.getState()!.durationS).toBeCloseTo(150, 3);
    location.push(fix(0, 184, 3000));
    expect(walk.getState()!.stepIndex).toBe(0);
    location.push(fix(0, 186, 4000));
    expect(walk.getState()!.stepIndex).toBe(1);
    const progress = walk.getState()!.progressM;
    location.push(fix(0, 183, 5000));
    expect(walk.getState()!.progressM).toBe(progress);
    expect(walk.getState()!.stepIndex).toBe(1);
    location.push(fix(0, 170, 6000));
    expect(walk.getState()!.stepIndex).toBe(1);
    expect(instruction(routeFixture(), 1)).toBe('Turn right on Second Street');
  });

  it('advances when cumulative progress passes a turn even outside 15m', async () => {
    const {walk, location} = await start();
    location.push(fix(40, 240, 2000));
    expect(walk.getState()!.stepIndex).toBe(1);
  });

  it('ignores duplicate, stale, and invalid location samples', async () => {
    const {walk, location} = await start();
    location.push(fix(0, 100, 3000));
    const before = walk.getState();
    location.push(fix(0, 180, 3000));
    location.push(fix(0, 180, 2000));
    location.push({...fix(0, 180, 4000), lat: NaN});
    expect(walk.getState()).toEqual(before);
  });
});

describe('gpx rerouting', () => {
  it('requires three accurate fixes over 10 seconds; 9 seconds does not reroute', async () => {
    const {location, requests} = await start();
    location.push(fix(-40, 50, 2000));
    location.push(fix(-40, 60, 7000));
    location.push(fix(-40, 70, 11000));
    expect(requests).toHaveLength(1);
    location.push(fix(-40, 80, 12000));
    await settle();
    expect(requests).toHaveLength(2);
  });

  it('two fixes over 10 seconds are insufficient', async () => {
    const {location, requests} = await start();
    location.push(fix(-40, 50, 2000));
    location.push(fix(-40, 60, 12000));
    expect(requests).toHaveLength(1);
    location.push(fix(-40, 65, 13000));
    await settle();
    expect(requests).toHaveLength(2);
  });

  it('accuracy >30 resets sustained deviation; exactly 30 qualifies', async () => {
    const {location, requests} = await start();
    location.push(fix(-40, 50, 2000, 30));
    location.push(fix(-40, 60, 7000, 31));
    location.push(fix(-40, 70, 12000, 30));
    location.push(fix(-40, 80, 17000, 30));
    expect(requests).toHaveLength(1);
    location.push(fix(-40, 90, 22000, 30));
    await settle();
    expect(requests).toHaveLength(2);
  });

  it('returning within 20m resets deviation and prevents premature cooldown reroutes', async () => {
    const {location, requests} = await start();
    location.push(fix(-40, 50, 2000));
    location.push(fix(-40, 60, 7000));
    location.push(fix(-19, 70, 11000));
    location.push(fix(-40, 80, 12000));
    location.push(fix(-40, 90, 17000));
    expect(requests).toHaveLength(1);
    location.push(fix(-40, 100, 22000));
    await settle();
    expect(requests).toHaveLength(2);
    location.push(fix(-40, 105, 23000));
    location.push(fix(-40, 110, 27000));
    location.push(fix(-40, 115, 31000));
    expect(requests).toHaveLength(2);
    location.push(fix(-40, 120, 33000));
    await settle();
    expect(requests).toHaveLength(3);
  });

  it('suppresses duplicate reroute and retry while an in-flight request is pending', async () => {
    const {walk, location, route} = await start();
    const pending = deferred<RouteResponse>();
    const request = vi.spyOn(route, 'request').mockReturnValue(pending.promise);
    location.push(fix(-40, 50, 2000)); location.push(fix(-40, 60, 7000)); location.push(fix(-40, 70, 12000));
    location.push(fix(-40, 80, 22000));
    await walk.retry();
    expect(request).toHaveBeenCalledTimes(1);
    expect(walk.getState()!.rerouting).toBe(true);
    pending.resolve(routeFixture());
    await settle();
    expect(walk.getState()!.rerouting).toBe(false);
  });
});

describe('gpx final segment and manual arrival', () => {
  it('enters direction at 50m and requires >65m before returning to route', async () => {
    const {walk, location} = await start();
    location.push(fix(149.9, 200, 2000)); expect(walk.getState()!.mode).toBe('route');
    location.push(fix(150, 200, 3000)); expect(walk.getState()!.mode).toBe('direction');
    location.push(fix(135, 200, 4000)); expect(walk.getState()!.mode).toBe('direction');
    location.push(fix(134.9, 200, 5000)); expect(walk.getState()!.mode).toBe('route');
  });

  it('keeps routing until the mapped endpoint, then uses original destination across unmapped gap', async () => {
    const {walk, location, piece} = await start(routeFixture(100));
    expect(walk.getState()!.mode).toBe('route');
    location.push(fix(90, 200, 2000));
    expect(walk.getState()!.mode).toBe('direction');
    expect(walk.getState()!.destination).toEqual(piece.walkTo);
    expect(walk.getState()!.distanceM).toBeCloseTo(110, 4);
    expect(walk.getState()!.bearingDeg).toBeCloseTo(90, 2);
  });

  it('requires <=20m, accurate fixes over five seconds and explicit confirmation', async () => {
    const {walk, location} = await start();
    location.push(fix(180, 200, 2000, 30));
    location.push(fix(185, 200, 6999, 30)); expect(walk.getState()!.mode).toBe('direction');
    await expect(walk.confirmArrival()).rejects.toMatchObject({code: 'invalid_argument'});
    location.push(fix(190, 200, 7000, 30)); expect(walk.getState()!.mode).toBe('nearby');
    location.push(fix(200, 200, 9000)); expect(walk.getState()!.mode).toBe('nearby');
    expect((await walk.confirmArrival()).mode).toBe('arrived');
    location.push(fix(0, 0, 10000)); expect(walk.getState()!.mode).toBe('arrived');
  });

  it('resets nearby qualification outside radius or with poor accuracy', async () => {
    const {walk, location} = await start();
    location.push(fix(185, 200, 2000)); location.push(fix(185, 200, 5000, 31));
    location.push(fix(185, 200, 7000)); expect(walk.getState()!.mode).toBe('direction');
    location.push(fix(179, 200, 10000)); location.push(fix(185, 200, 12000));
    location.push(fix(190, 200, 16999)); expect(walk.getState()!.mode).toBe('direction');
    location.push(fix(190, 200, 17000)); expect(walk.getState()!.mode).toBe('nearby');
  });
});

describe('walk lifecycle and errors', () => {
  it('uses direction for NoRoute but retains network errors for retry', async () => {
    const context = harness(); controllers.push(context.walk);
    const request = vi.spyOn(context.route, 'request').mockRejectedValue(new WalkError('route_unavailable'));
    expect((await context.walk.start({source: 'item', pieceId: 'piece'})).mode).toBe('direction');
    expect(context.walk.getState()!.distanceM).toBeCloseTo(Math.sqrt(80000), 3);
    request.mockRejectedValue(new WalkError('network_error'));
    expect((await context.walk.retry()).errorCode).toBe('network_error');
    expect(context.walk.getState()!.mode).toBe('error');
    request.mockResolvedValue(routeFixture());
    expect((await context.walk.retry()).mode).toBe('route');
  });

  it('treats empty geometry as direction, not a fabricated route', async () => {
    const response = routeFixture(); response.geometry.coordinates = [];
    const {walk} = await start(response);
    expect(walk.getState()).toMatchObject({mode: 'direction', route: null, errorCode: 'route_unavailable'});
  });

  it('invalidates stale responses after exit and starts a distinct destination safely', async () => {
    const context = harness();
    const pending = deferred<RouteResponse>();
    const requested = deferred<void>();
    const route = new MockRoute(async () => { requested.resolve(); return pending.promise; });
    const walk = createWalk({...context, route}); controllers.push(walk);
    const first = walk.start({source: 'item', pieceId: 'piece'});
    await requested.promise;
    await walk.stop();
    pending.resolve(routeFixture());
    await expect(first).rejects.toMatchObject({code: 'cancelled'});
    expect(walk.getState()).toBeNull();
    context.piece.walkTo = position(400, 400);
    await walk.start({source: 'item', pieceId: 'piece'});
    expect(walk.getState()!.destination).toEqual(position(400, 400));
  });

  it('stops foreground watch and route on pause, resumes only while owned, and removes exit subscriptions', async () => {
    const {walk, location, environment} = await start();
    const stop = vi.spyOn(location, 'stop');
    const before = walk.getState();
    await walk.pause(); location.push(fix(0, 100, 2000));
    expect(walk.getState()).toEqual(before);
    await walk.resume(); expect(walk.getState()!.fix!.t).toBe(2000);
    await walk.stop(); environment.setActive(true); location.push(fix(0, 180, 3000)); environment.setOnline(false);
    expect(walk.getState()).toBeNull();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('reports permission denial and location loss without stale distance', async () => {
    const context = harness(); controllers.push(context.walk);
    const startLocation = vi.spyOn(context.location, 'start').mockRejectedValue(new WalkError('location_permission_denied'));
    expect((await context.walk.start({source: 'item', pieceId: 'piece'})).errorCode).toBe('location_permission_denied');
    expect(context.requests).toHaveLength(0);
    startLocation.mockRestore(); await context.walk.retry(); context.location.fail('location_unavailable');
    expect(context.walk.getState()).toMatchObject({mode: 'error', errorCode: 'location_unavailable', fix: null, distanceM: null, bearingDeg: null});
  });
});
