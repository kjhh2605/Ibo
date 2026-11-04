import {relay} from '../relay/client';
import {validPoint, point} from './geometry';
import {WalkError, errorCode} from './types';
import type {RouteAPI, RouteRequest, RouteResponse} from './types';

/** Reject corrupt responses without exposing payloads in errors or logs. */
function validateRoute(route: RouteResponse): void {
  if (route?.geometry?.type !== 'LineString' || !Array.isArray(route.geometry.coordinates)) throw new WalkError('invalid_response');
  if (route.geometry.coordinates.length < 2) throw new WalkError('route_unavailable', false);
  const coordinate = (value: number[]) => Array.isArray(value) && value.length === 2 && validPoint(point(value));
  const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;
  if (!route.geometry.coordinates.every(coordinate) || !nonnegative(route.distanceM) || !nonnegative(route.durationS) ||
      !Array.isArray(route.steps) || !route.steps.every(step => nonnegative(step.distanceM) && nonnegative(step.durationS) && typeof step.name === 'string' && step.maneuver && typeof step.maneuver.type === 'string' && coordinate(step.maneuver.location) && nonnegative(step.maneuver.bearingBefore) && step.maneuver.bearingBefore < 360 && nonnegative(step.maneuver.bearingAfter) && step.maneuver.bearingAfter < 360) ||
      !Array.isArray(route.waypoints) || route.waypoints.length !== 2 || !route.waypoints.every(waypoint => coordinate(waypoint.location) && nonnegative(waypoint.distanceM))) throw new WalkError('invalid_response');
}

export class RelayRoute implements RouteAPI {
  private controller: AbortController | null = null;
  private client: typeof relay;
  private online: () => Promise<boolean>;

  constructor(client: typeof relay = relay, online: () => Promise<boolean> = async () => globalThis.navigator?.onLine !== false) {
    this.client = client;
    this.online = online;
  }

  async request(input: RouteRequest): Promise<RouteResponse> {
    if (this.controller) throw new WalkError('busy');
    if (!validPoint(input.origin) || !validPoint(input.destination)) throw new WalkError('invalid_argument', false);
    const controller = new AbortController();
    this.controller = controller;
    try {
      if (!await this.online()) throw new WalkError('offline');
      controller.signal.throwIfAborted();
      const response = await this.client.request('/v1/route', {
        origin: {lat: input.origin.lat, lng: input.origin.lng},
        destination: {lat: input.destination.lat, lng: input.destination.lng},
      }, {signal: controller.signal});
      controller.signal.throwIfAborted();
      validateRoute(response);
      return response;
    } catch (error) {
      if (controller.signal.aborted) throw new WalkError('cancelled', false);
      throw new WalkError(errorCode(error, 'route_failed'));
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }

  async cancel(): Promise<void> {
    this.controller?.abort();
    this.controller = null;
  }
}
