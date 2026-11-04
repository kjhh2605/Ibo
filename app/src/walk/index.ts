import {App} from '@capacitor/app';
import {Network} from '@capacitor/network';
import {Store} from '../native/store';
import {WalkController} from './controller';
import {ForegroundLocation} from './location';
import {WalkMap} from './map';
import {RelayRoute} from './route';
import type {WalkEnvironment} from './types';

const environment: WalkEnvironment = {
  online: async () => (await Network.getStatus()).connected,
  onOnline: async callback => Network.addListener('networkStatusChange', status => callback(status.connected)),
  onActive: async callback => App.addListener('appStateChange', state => callback(state.isActive)),
};

export const Location = new ForegroundLocation();
export const Route = new RelayRoute(undefined, environment.online);
export const Map = new WalkMap();
export const Walk = new WalkController({store: Store, location: Location, route: Route, environment});
export {createWalk, WalkController} from './controller';
export {WalkMap} from './map';
export {ForegroundLocation} from './location';
export {RelayRoute} from './route';
export {MockLocation, MockRoute, MockMap, MockEnvironment} from './mock';
export {distance, bearing, instruction} from './geometry';
export {WalkError} from './types';
export type {WalkAPI, WalkDependencies, WalkEnvironment, WalkSource, WalkState, LocationAPI, RouteAPI, MapAPI, MapUpdate, RouteRequest, RouteResponse, Fix, Point} from './types';
