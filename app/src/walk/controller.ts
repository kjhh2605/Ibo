import type {Listener, Result, ResultPieceSnapshot} from '../native/contracts';
import {EventSource} from './events';
import {bearing, distance, point, project, routeLengths, validPoint} from './geometry';
import {WalkError, errorCode} from './types';
import type {Fix, WalkAPI, WalkDependencies, WalkSource, WalkState} from './types';

/** The shop piece of a look to walk back to: the requested one, else the first with a saved spot. */
export function resultDestination(result: Result | null, pieceId?: string): ResultPieceSnapshot | null {
  if (!result) return null;
  const walkable = (piece: ResultPieceSnapshot) => piece.origin === 'shop' && validPoint(piece.walkTo) && (pieceId === undefined || piece.pieceId === pieceId);
  // The lead piece is checked first so companions are read only when needed.
  if (walkable(result.targetSnapshot)) return result.targetSnapshot;
  return result.companionSnapshots.find(walkable) ?? null;
}

export class WalkController extends EventSource<{state: WalkState}> implements WalkAPI {
  private deps: WalkDependencies;
  private state: WalkState | null = null;
  private generation = 0;
  private requestGeneration = 0;
  private activityGeneration = 0;
  private countedFixTime = -1;
  private listeners: Listener[] = [];
  private paused = false;
  private initializing = false;
  private inFlight = false;
  private connected = true;
  private lengths: number[] = [];
  private stepEnds: number[] = [];
  private offSince: number | null = null;
  private offCount = 0;
  private nearSince: number | null = null;
  private nearCount = 0;
  private lastRequestTime = -Infinity;
  private direction = false;
  private noRoute = false;
  private lastFixTime = -1;

  constructor(dependencies: WalkDependencies) {
    super();
    this.deps = dependencies;
  }

  getState(): WalkState | null { return this.state ? structuredClone(this.state) : null; }

  private publish(): WalkState {
    if (!this.state) throw new WalkError('destination_unavailable', false);
    this.emit('state', this.state);
    return structuredClone(this.state);
  }

  private async retain(listener: Promise<Listener>, generation: number): Promise<void> {
    const handle = await listener;
    if (generation !== this.generation) await handle.remove();
    else this.listeners.push(handle);
  }

  async start(input: WalkSource): Promise<WalkState> {
    const stopped = this.stop();
    const generation = this.generation;
    await stopped;
    if (generation !== this.generation) throw new WalkError('cancelled', false);
    let destination;
    let info: WalkState['destinationInfo'];
    if (input.source === 'item') {
      const piece = await this.deps.store.get({entity: 'Piece', id: input.pieceId});
      if (!piece || piece.origin !== 'shop' || !validPoint(piece.walkTo)) throw new WalkError('destination_unavailable', false);
      destination = {lat: piece.walkTo.lat, lng: piece.walkTo.lng};
      let shopInfo: ResultPieceSnapshot['shop'] = null;
      if (piece.shopId) {
        const shop = await this.deps.store.get({entity: 'Shop', id: piece.shopId});
        if (shop) {
          const photo = shop.storefrontPhotoId ? await this.deps.store.get({entity: 'Photo', id: shop.storefrontPhotoId}) : null;
          shopInfo = {n: shop.n, startedAt: shop.startedAt, storefrontFile: photo?.file ?? null, description: shop.description, note: shop.note};
        }
      }
      info = {label: piece.label, shop: shopInfo};
    } else if (input.source === 'result') {
      const result = await this.deps.store.get({entity: 'Result', id: input.resultId});
      const snapshot = resultDestination(result, input.pieceId);
      if (!snapshot || snapshot.origin !== 'shop' || !validPoint(snapshot.walkTo)) throw new WalkError('destination_unavailable', false);
      destination = {lat: snapshot.walkTo.lat, lng: snapshot.walkTo.lng};
      info = {label: snapshot.label, shop: structuredClone(snapshot.shop)};
    } else throw new WalkError('destination_unavailable', false);
    if (generation !== this.generation) throw new WalkError('cancelled', false);
    this.state = {mode: 'loading', destination, destinationInfo: info, distanceM: null, durationS: null, bearingDeg: null, stepIndex: null, stepDistanceM: null, route: null, fix: null, errorCode: null, rerouting: false, progressM: 0};
    this.publish();
    await this.retain(this.deps.location.addListener('fix', fix => { if (generation === this.generation) this.acceptFix(fix); }), generation);
    await this.retain(this.deps.location.addListener('error', error => {
      if (generation !== this.generation || !this.state || this.paused || this.state.mode === 'arrived') return;
      this.state.fix = null;
      this.state.distanceM = null;
      this.state.durationS = null;
      this.state.bearingDeg = null;
      this.setError(error.code);
      void this.cancelRequest();
    }), generation);
    await this.retain(this.deps.environment.onOnline(online => {
      if (generation !== this.generation) return;
      this.connected = online;
      if (!online && this.state && this.state.mode !== 'arrived') {
        this.setError('offline');
        void this.cancelRequest();
      }
    }), generation);
    await this.retain(this.deps.environment.onActive(active => { if (generation === this.generation) void (active ? this.resume() : this.pause()); }), generation);
    if (generation !== this.generation) throw new WalkError('cancelled', false);
    return this.retry();
  }

  private setError(code: string): void {
    if (!this.state) return;
    this.state.mode = code === 'offline' ? 'offline' : 'error';
    this.state.errorCode = code;
    this.state.rerouting = false;
    this.publish();
  }

  async retry(): Promise<WalkState> {
    if (!this.state) throw new WalkError('destination_unavailable', false);
    if (this.state.mode === 'arrived' || this.paused || this.initializing || this.inFlight) return this.publish();
    const generation = this.generation;
    const activity = this.activityGeneration;
    this.initializing = true;
    this.state.mode = 'loading';
    this.state.errorCode = null;
    this.publish();
    try {
      this.connected = await this.deps.environment.online();
      if (generation !== this.generation || activity !== this.activityGeneration || this.paused) throw new WalkError('cancelled', false);
      if (!this.connected) { this.setError('offline'); return this.publish(); }
      await this.deps.location.start();
      if (generation !== this.generation || activity !== this.activityGeneration || this.paused) throw new WalkError('cancelled', false);
      const fix = await this.deps.location.current();
      if (generation !== this.generation || activity !== this.activityGeneration || this.paused) throw new WalkError('cancelled', false);
      this.acceptFix(fix);
      if (this.state?.fix) await this.requestRoute();
    } catch (error) {
      if (generation === this.generation && activity === this.activityGeneration && !this.paused) this.setError(errorCode(error, 'location_unavailable'));
    } finally {
      if (generation === this.generation && activity === this.activityGeneration) this.initializing = false;
    }
    if (generation !== this.generation) throw new WalkError('cancelled', false);
    return this.publish();
  }

  private async requestRoute(): Promise<void> {
    const state = this.state;
    if (!state?.fix || this.inFlight || this.paused || !this.connected) return;
    const generation = this.generation;
    const request = ++this.requestGeneration;
    this.inFlight = true;
    this.lastRequestTime = state.fix.t;
    state.rerouting = state.route !== null;
    if (!state.route) state.mode = 'loading';
    state.errorCode = null;
    this.publish();
    try {
      const route = await this.deps.route.request({origin: {lat: state.fix.lat, lng: state.fix.lng}, destination: {...state.destination}});
      if (generation !== this.generation || request !== this.requestGeneration || this.paused || !this.connected) return;
      if (route.geometry.coordinates.length < 2) throw new WalkError('route_unavailable', false);
      state.route = structuredClone(route);
      this.lengths = routeLengths(route);
      this.stepEnds = route.steps.map((_, index) => index + 1 < route.steps.length ? project(point(route.steps[index + 1].maneuver.location), route.geometry.coordinates, this.lengths).progressM : this.lengths.at(-1) ?? 0);
      state.progressM = 0;
      state.stepIndex = route.steps.length ? 0 : null;
      this.noRoute = false;
      this.offSince = null;
      this.offCount = 0;
      state.mode = 'route';
      this.updateGuidance();
    } catch (error) {
      if (generation !== this.generation || request !== this.requestGeneration || this.paused) return;
      const code = errorCode(error, 'route_failed');
      if (code === 'route_unavailable') {
        state.route = null;
        state.stepIndex = null;
        state.stepDistanceM = null;
        this.noRoute = true;
        this.direction = true;
        state.errorCode = code;
        state.mode = 'direction';
        this.updateGuidance();
      } else this.setError(this.connected ? code : 'offline');
    } finally {
      if (generation === this.generation && request === this.requestGeneration) {
        this.inFlight = false;
        state.rerouting = false;
        this.publish();
      }
    }
  }

  private acceptFix(fix: Fix): void {
    const state = this.state;
    if (!state || this.paused || state.mode === 'arrived') return;
    if (!validPoint(fix) || !Number.isFinite(fix.accuracyM) || fix.accuracyM < 0 || !Number.isSafeInteger(fix.t) || fix.t <= this.lastFixTime) return;
    this.lastFixTime = fix.t;
    state.fix = {...fix};
    if (!this.connected || state.mode === 'offline' || state.mode === 'error') { this.publish(); return; }
    this.updateGuidance();
    this.publish();
  }

  private updateGuidance(): void {
    const state = this.state;
    if (!state?.fix) return;
    const fix = state.fix;
    const directM = distance(fix, state.destination);
    state.bearingDeg = bearing(fix, state.destination);
    const fresh = fix.t > this.countedFixTime;
    this.countedFixTime = fix.t;
    if (fresh) {
      if (directM <= 20 && fix.accuracyM <= 30) {
        if (this.nearSince === null) { this.nearSince = fix.t; this.nearCount = 1; }
        else this.nearCount++;
      } else { this.nearSince = null; this.nearCount = 0; }
    }
    const nearby = this.nearSince !== null && fix.t - this.nearSince >= 5000 && this.nearCount >= 2;
    let unmapped = false;
    if (state.route) {
      const projection = project(fix, state.route.geometry.coordinates, this.lengths);
      // Small backward GPS jitter leaves progress untouched; steps never regress.
      if (projection.progressM >= state.progressM || projection.progressM < state.progressM - 5) state.progressM = projection.progressM;
      const total = this.lengths.at(-1) ?? 0;
      const endpoint = point(state.route.geometry.coordinates.at(-1)!);
      unmapped = distance(endpoint, state.destination) > 15 && (total - state.progressM <= 15 || distance(fix, endpoint) <= 15);
      if (state.stepIndex !== null) {
        while (state.stepIndex < state.route.steps.length - 1 && (state.progressM >= this.stepEnds[state.stepIndex] || distance(fix, point(state.route.steps[state.stepIndex + 1].maneuver.location)) <= 15)) state.stepIndex++;
        state.stepDistanceM = Math.max(0, this.stepEnds[state.stepIndex] - state.progressM);
        let duration = 0;
        for (let i = state.stepIndex; i < state.route.steps.length; i++) {
          const begin = i ? this.stepEnds[i - 1] : 0;
          const length = this.stepEnds[i] - begin;
          duration += state.route.steps[i].durationS * (length > 0 ? Math.max(0, Math.min(1, (this.stepEnds[i] - state.progressM) / length)) : 0);
        }
        state.durationS = duration;
      }
      state.distanceM = Math.max(0, total - state.progressM);
      if (fresh) {
        if (fix.accuracyM <= 30) {
          if (projection.distanceM <= 20) { this.offSince = null; this.offCount = 0; }
          else if (projection.distanceM > 30) {
            if (this.offSince === null) { this.offSince = fix.t; this.offCount = 1; }
            else this.offCount++;
            if (!this.initializing && !this.direction && !unmapped && this.offCount >= 3 && fix.t - this.offSince >= 10000 && fix.t - this.lastRequestTime >= 10000 && !this.inFlight) void this.requestRoute();
          }
        } else { this.offSince = null; this.offCount = 0; }
      }
    }
    if (directM <= 50 || this.noRoute || unmapped) this.direction = true;
    else if (directM > 65 && state.route) this.direction = false;
    if (this.direction || nearby) {
      state.mode = nearby ? 'nearby' : 'direction';
      state.distanceM = directM;
      state.durationS = null;
      state.stepDistanceM = null;
    } else if (state.route) state.mode = 'route';
  }

  async confirmArrival(): Promise<WalkState> {
    if (!this.state || this.state.mode !== 'nearby') throw new WalkError('invalid_argument', false);
    this.state.mode = 'arrived';
    this.state.rerouting = false;
    await this.cancelRequest();
    await this.deps.location.stop();
    return this.publish();
  }

  private async cancelRequest(): Promise<void> {
    ++this.requestGeneration;
    this.inFlight = false;
    await this.deps.route.cancel();
  }

  async pause(): Promise<void> {
    ++this.activityGeneration;
    this.paused = true;
    this.initializing = false;
    this.nearSince = null;
    this.nearCount = 0;
    this.offSince = null;
    this.offCount = 0;
    await Promise.all([this.cancelRequest(), this.deps.location.stop()]);
  }

  async resume(): Promise<void> {
    if (!this.paused || !this.state) return;
    this.paused = false;
    await this.retry();
  }

  async stop(): Promise<void> {
    ++this.generation;
    ++this.activityGeneration;
    this.countedFixTime = -1;
    this.state = null;
    this.paused = false;
    this.initializing = false;
    this.direction = false;
    this.noRoute = false;
    this.lastFixTime = -1;
    this.lastRequestTime = -Infinity;
    this.lengths = [];
    this.stepEnds = [];
    this.offSince = null;
    this.offCount = 0;
    this.nearSince = null;
    this.nearCount = 0;
    const listeners = this.listeners.splice(0);
    await Promise.all([this.cancelRequest(), this.deps.location.stop(), ...listeners.map(listener => listener.remove())]);
  }
}

export function createWalk(dependencies: WalkDependencies): WalkController { return new WalkController(dependencies); }
