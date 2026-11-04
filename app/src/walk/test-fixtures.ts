import type {EntityMap, Piece, Store} from '../native/contracts';
import {createWalk} from './controller';
import {MockEnvironment, MockLocation, MockRoute} from './mock';
import type {Fix, Point, RouteResponse} from './types';

const degreesPerM = 180 / (Math.PI * 6371008.8);
export function position(eastM: number, northM: number): Point { return {lng: eastM * degreesPerM, lat: northM * degreesPerM}; }
export function fix(eastM: number, northM: number, t = 1000, accuracyM = 5): Fix { return {...position(eastM, northM), t, accuracyM}; }
export function routeFixture(endM = 200): RouteResponse {
  const origin = position(0, 0); const turn = position(0, 200); const end = position(endM, 200);
  return {
    geometry: {type: 'LineString', coordinates: [[origin.lng, origin.lat], [turn.lng, turn.lat], [end.lng, end.lat]]},
    distanceM: 200 + endM, durationS: (200 + endM) / 2,
    steps: [
      {name: 'First Street', distanceM: 200, durationS: 100, maneuver: {location: [origin.lng, origin.lat], bearingBefore: 0, bearingAfter: 0, type: 'depart'}},
      {name: 'Second Street', distanceM: endM, durationS: endM / 2, maneuver: {location: [turn.lng, turn.lat], bearingBefore: 0, bearingAfter: 90, type: 'turn', modifier: 'right'}},
      {name: '', distanceM: 0, durationS: 0, maneuver: {location: [end.lng, end.lat], bearingBefore: 90, bearingAfter: 90, type: 'arrive'}},
    ],
    waypoints: [{location: [origin.lng, origin.lat], distanceM: 0}, {location: [end.lng, end.lat], distanceM: 0}],
  };
}
export function pieceFixture(): Piece { return {id: 'piece', origin: 'shop', label: 'Coat', category: 'outerwear', cutoutFile: 'private://coat.png', createdAt: 1, photoId: null, shopId: null, tripId: null, walkTo: position(200, 200)}; }
export function harness(response = routeFixture()) {
  const piece = pieceFixture();
  const location = new MockLocation(fix(0, 0));
  const environment = new MockEnvironment();
  const requests: {origin: Point; destination: Point}[] = [];
  const route = new MockRoute(async input => { requests.push(input); return structuredClone(response); });
  const entities: Partial<{[K in keyof EntityMap]: Map<string, EntityMap[K]>}> = {Piece: new Map([[piece.id, piece]])};
  const store: Pick<Store, 'get'> = {get: async <K extends keyof EntityMap>({entity, id}: {entity: K; id: string}) => (entities[entity]?.get(id) as EntityMap[K] | undefined) ?? null};
  const walk = createWalk({store, location, route, environment});
  return {walk, piece, location, environment, route, requests, store, entities};
}
