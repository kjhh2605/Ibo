import {deferred} from '../deferred';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {Result, Shop} from '../native/contracts';
import {createWalk} from './controller';
import {harness, fix, position, routeFixture} from './test-fixtures';
import type {WalkController} from './controller';
import type {RouteResponse, WalkSource} from './types';

const controllers: WalkController[] = [];
afterEach(async () => { await Promise.all(controllers.splice(0).map(walk => walk.stop())); vi.restoreAllMocks(); });

describe('privacy destination and no side channels', () => {
  it('uses Piece.walkTo without reading Shop.spot, queueing trails or sending coordinates to Meta', async () => {
    const context = harness(); controllers.push(context.walk);
    context.piece.shopId = 'shop';
    const shop: Shop = {id: 'shop', tripId: 'trip', n: 3, startedAt: 1, get spot(): never { throw new Error('Shop.spot must not be accessed'); }, storefrontPhotoId: null, description: null, descriptionState: 'none', note: 'Blue door'};
    context.entities.Shop = new Map([['shop', shop]]);
    const read = vi.spyOn(context.store, 'get');
    const write = vi.fn();
    Object.assign(context.store, {write, put: write, enqueue: write, appendTrail: write});
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network'));
    const log = vi.spyOn(console, 'log'); const warn = vi.spyOn(console, 'warn'); const error = vi.spyOn(console, 'error');
    const open = vi.fn(); vi.stubGlobal('open', open);
    const result = await context.walk.start({source: 'item', pieceId: 'piece'});
    context.location.push(fix(0, 100, 2000));
    expect(context.requests[0]).toEqual({origin: position(0, 0), destination: context.piece.walkTo});
    expect(result.destinationInfo.shop).toMatchObject({n: 3, note: 'Blue door', storefrontFile: null});
    expect(read.mock.calls.map(([input]) => input.entity)).toEqual(['Piece', 'Shop']);
    expect(write).not.toHaveBeenCalled(); expect(network).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('guides from immutable target snapshot after target/trip deletion and never reads companion destinations', async () => {
    const context = harness(); controllers.push(context.walk);
    context.entities.Piece!.clear();
    const snapshot = {pieceId: 'deleted', origin: 'shop' as const, label: 'Saved coat', category: 'outerwear', cutoutFile: 'private://coat.png', walkTo: position(200, 200), shop: {n: 1, startedAt: 1, storefrontFile: null, description: null, note: null}};
    const result: Result = {id: 'result', targetPieceId: 'deleted', companionPieceIds: ['companion'], targetSnapshot: snapshot, get companionSnapshots(): never { throw new Error('Companions are not destinations'); }, file: 'private://result.png', faceless: false, providerFile: 'private://provider.png', createdAt: 1};
    context.entities.Result = new Map([['result', result]]);
    const read = vi.spyOn(context.store, 'get');
    const state = await context.walk.start({source: 'result', resultId: 'result'});
    expect(read.mock.calls.map(([input]) => input.entity)).toEqual(['Result']);
    snapshot.walkTo = position(900, 900); snapshot.label = 'Changed';
    state.destination.lat = 89; state.destinationInfo.label = 'Changed externally';
    expect(context.walk.getState()!.destination).toEqual(position(200, 200));
    expect(context.walk.getState()!.destinationInfo.label).toBe('Saved coat');
    context.location.push(fix(0, 100, 2000));
    await context.walk.retry();
    expect(context.requests.at(-1)!.destination).toEqual(position(200, 200));
  });

  it('rejects wardrobe, missing destinations, nonfinite coordinates and non-item/result entry', async () => {
    const context = harness(); controllers.push(context.walk);
    context.piece.origin = 'wardrobe';
    await expect(context.walk.start({source: 'item', pieceId: 'piece'})).rejects.toMatchObject({code: 'destination_unavailable'});
    context.piece.origin = 'shop'; context.piece.walkTo = null;
    await expect(context.walk.start({source: 'item', pieceId: 'piece'})).rejects.toMatchObject({code: 'destination_unavailable'});
    context.piece.walkTo = {lat: NaN, lng: 0};
    await expect(context.walk.start({source: 'item', pieceId: 'piece'})).rejects.toMatchObject({code: 'destination_unavailable'});
    await expect(context.walk.start({source: 'shop', shopId: 'shop'} as unknown as WalkSource)).rejects.toMatchObject({code: 'destination_unavailable'});
    await expect(context.walk.start({source: 'result', resultId: 'missing'})).rejects.toMatchObject({code: 'destination_unavailable'});
    expect(context.requests).toHaveLength(0);
  });

  it('performs zero route calls offline and waits for manual retry after reconnection', async () => {
    const context = harness(); controllers.push(context.walk);
    context.environment.setOnline(false);
    expect((await context.walk.start({source: 'item', pieceId: 'piece'})).mode).toBe('offline');
    await context.walk.retry(); expect(context.requests).toHaveLength(0);
    context.environment.setOnline(true); context.location.push(fix(0, 100, 2000));
    expect(context.walk.getState()!.mode).toBe('offline'); expect(context.requests).toHaveLength(0);
    expect((await context.walk.retry()).mode).toBe('route'); expect(context.requests).toHaveLength(1);
    context.environment.setOnline(false); context.location.push(fix(-40, 50, 3000)); context.location.push(fix(-40, 60, 13000)); context.location.push(fix(-40, 70, 23000));
    expect(context.walk.getState()!.mode).toBe('offline'); expect(context.requests).toHaveLength(1);
  });

  it('discards route response after connectivity loss without a delayed online request', async () => {
    const context = harness();
    const response = deferred<RouteResponse>();
    const began = deferred<void>();
    const request = vi.fn(async () => { began.resolve(); return response.promise; });
    const walk = createWalk({...context, route: {request, cancel: async () => {}}}); controllers.push(walk);
    const starting = walk.start({source: 'item', pieceId: 'piece'});
    await began.promise; context.environment.setOnline(false); response.resolve(routeFixture());
    await starting; expect(walk.getState()).toMatchObject({mode: 'offline', route: null});
    context.environment.setOnline(true); expect(request).toHaveBeenCalledTimes(1);
  });
});
