import type {Events, Fix, Point, ResultPieceSnapshot, Store} from '../native/contracts';
import type {RelayRequest, RelayResponse} from '../relay/client';

export type {Fix, Point} from '../native/contracts';
export type RouteResponse = RelayResponse<'/v1/route'>;
export type RouteRequest = RelayRequest<'/v1/route'>;
// A result may hold several shop pieces; `pieceId` picks one (default: the first that has a spot).
export type WalkSource = {source: 'item'; pieceId: string} | {source: 'result'; resultId: string; pieceId?: string};
export interface LocationAPI extends Events<{fix: Fix; error: {code: string}}> {
  start(): Promise<void>;
  current(): Promise<Fix>;
  stop(): Promise<void>;
}
export interface RouteAPI {
  request(input: RouteRequest): Promise<RouteResponse>;
  cancel(): Promise<void>;
}
export type MapUpdate = {fix: Fix | null; destination: Point; route: RouteResponse | null; progressM?: number};
export interface MapAPI extends Events<{ready: Record<string, never>; error: {code: 'map_unavailable'}}> {
  mount(input: {element: HTMLElement}): Promise<void>;
  update(input: MapUpdate): Promise<void>;
  unmount(): Promise<void>;
}
export type WalkState = {
  mode: 'loading' | 'route' | 'direction' | 'nearby' | 'arrived' | 'offline' | 'error';
  destination: Point;
  destinationInfo: {label: string; shop: ResultPieceSnapshot['shop']};
  distanceM: number | null;
  durationS: number | null;
  bearingDeg: number | null;
  stepIndex: number | null;
  stepDistanceM: number | null;
  route: RouteResponse | null;
  fix: Fix | null;
  errorCode: string | null;
  rerouting: boolean;
  progressM: number;
};
export interface WalkAPI extends Events<{state: WalkState}> {
  start(input: WalkSource): Promise<WalkState>;
  retry(): Promise<WalkState>;
  confirmArrival(): Promise<WalkState>;
  getState(): WalkState | null;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
}
export interface WalkEnvironment {
  online(): Promise<boolean>;
  onOnline(callback: (online: boolean) => void): Promise<{remove(): Promise<void>}>;
  onActive(callback: (active: boolean) => void): Promise<{remove(): Promise<void>}>;
}
export type WalkDependencies = {store: Pick<Store, 'get'>; location: LocationAPI; route: RouteAPI; environment: WalkEnvironment};

export class WalkError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, retryable = true) {
    super('Walking guidance is unavailable.');
    this.name = 'WalkError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function errorCode(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && /^[a-z_]{1,64}$/.test(error.code)) return error.code;
  return fallback;
}
