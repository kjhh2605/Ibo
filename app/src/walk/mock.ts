import type {Listener} from '../native/contracts';
import {EventSource} from './events';
import {splitRoute} from './geometry';
import {WalkError} from './types';
import type {Fix, LocationAPI, MapAPI, MapUpdate, RouteAPI, RouteRequest, RouteResponse, WalkEnvironment} from './types';

/** Explicit fixture adapters. None is selected automatically by production code. */
export class MockLocation extends EventSource<{fix: Fix; error: {code: string}}> implements LocationAPI {
  private fix: Fix;
  private watching = false;
  constructor(fix: Fix) { super(); this.fix = {...fix}; }
  async start(): Promise<void> { this.watching = true; }
  async current(): Promise<Fix> { return {...this.fix}; }
  async stop(): Promise<void> { this.watching = false; }
  push(fix: Fix): void { this.fix = {...fix}; if (this.watching) this.emit('fix', fix); }
  fail(code: string): void { if (this.watching) this.emit('error', {code}); }
}

export class MockRoute implements RouteAPI {
  private respond: (input: RouteRequest, signal: AbortSignal) => Promise<RouteResponse>;
  private controller: AbortController | null = null;
  constructor(respond: RouteResponse | ((input: RouteRequest, signal: AbortSignal) => Promise<RouteResponse>)) {
    this.respond = typeof respond === 'function' ? respond : async () => structuredClone(respond);
  }
  async request(input: RouteRequest): Promise<RouteResponse> {
    if (this.controller) throw new WalkError('busy');
    const controller = new AbortController();
    this.controller = controller;
    try {
      const response = await this.respond(structuredClone(input), controller.signal);
      if (controller.signal.aborted) throw new WalkError('cancelled', false);
      return response;
    } finally { if (this.controller === controller) this.controller = null; }
  }
  async cancel(): Promise<void> { this.controller?.abort(); this.controller = null; }
}

export class MockEnvironment implements WalkEnvironment {
  connected = true;
  private onlineCallbacks = new Set<(online: boolean) => void>();
  private activeCallbacks = new Set<(active: boolean) => void>();
  async online(): Promise<boolean> { return this.connected; }
  async onOnline(callback: (online: boolean) => void): Promise<Listener> {
    this.onlineCallbacks.add(callback);
    return {remove: async () => { this.onlineCallbacks.delete(callback); }};
  }
  async onActive(callback: (active: boolean) => void): Promise<Listener> {
    this.activeCallbacks.add(callback);
    return {remove: async () => { this.activeCallbacks.delete(callback); }};
  }
  setOnline(online: boolean): void { this.connected = online; for (const callback of this.onlineCallbacks) callback(online); }
  setActive(active: boolean): void { for (const callback of this.activeCallbacks) callback(active); }
}

export class MockMap extends EventSource<{ready: Record<string, never>; error: {code: 'map_unavailable'}}> implements MapAPI {
  private element: HTMLElement | null = null;
  private svg: SVGSVGElement | null = null;
  private destination: MapUpdate['destination'] | null = null;
  async mount({element}: {element: HTMLElement}): Promise<void> {
    await this.unmount();
    this.element = element;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', '0 0 400 400');
    this.svg.setAttribute('width', '100%');
    this.svg.setAttribute('height', '100%');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'Walking route fixture');
    element.append(this.svg);
    this.emit('ready', {});
  }
  async update(input: MapUpdate): Promise<void> {
    if (this.destination && (input.destination.lat !== this.destination.lat || input.destination.lng !== this.destination.lng)) throw new WalkError('destination_immutable', false);
    this.destination = {...input.destination};
    if (!this.svg || !this.element) return;
    this.svg.replaceChildren();
    const coordinates = [input.destination, ...(input.fix ? [input.fix] : []), ...(input.route?.geometry.coordinates.map(([lng, lat]) => ({lng, lat})) ?? [])];
    const cosLat = Math.cos(input.destination.lat * Math.PI / 180);
    const xs = coordinates.map(p => (p.lng - input.destination.lng) * cosLat);
    const ys = coordinates.map(p => p.lat - input.destination.lat);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const scale = 340 / Math.max(maxX - minX, maxY - minY, 0.0001);
    const project = (lng: number, lat: number) => [200 + ((lng - input.destination.lng) * cosLat - (maxX + minX) / 2) * scale, 200 - (lat - input.destination.lat - (maxY + minY) / 2) * scale];
    if (input.route) {
      const split = splitRoute(input.route, input.progressM ?? 0);
      for (const [kind, line] of [['remaining', split.remaining], ['passed', split.passed]] as const) {
        if (line.length < 2) continue;
        const path = document.createElementNS(this.svg.namespaceURI, 'polyline');
        path.setAttribute('points', line.map(([lng, lat]) => project(lng, lat).join(',')).join(' '));
        path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '3');
        if (kind === 'passed') path.setAttribute('stroke-dasharray', '3 6');
        this.svg.append(path);
      }
    }
    for (const [kind, position] of [['destination', input.destination], ['current', input.fix]] as const) {
      if (!position) continue;
      const [cx, cy] = project(position.lng, position.lat);
      const marker = document.createElementNS(this.svg.namespaceURI, 'circle');
      marker.setAttribute('cx', String(cx)); marker.setAttribute('cy', String(cy));
      marker.setAttribute('r', kind === 'destination' ? '9' : '5'); marker.setAttribute('fill', 'currentColor');
      marker.setAttribute('data-kind', kind);
      this.svg.append(marker);
    }
  }
  async unmount(): Promise<void> { this.svg?.remove(); this.svg = null; this.element = null; this.destination = null; }
}
