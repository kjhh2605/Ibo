import {WebPlugin} from '@capacitor/core';
import type {Fix, SessionState, ShoppingSession as ShoppingSessionContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';
import {getMockContext} from './web/context';
import type {MockContext} from './web/context';
import {getWebRepository} from '../data/web/repository';

export function validFix(fix: Fix | undefined | null, time: number): fix is Fix {
  return !!fix && Number.isFinite(fix.lat) && Number.isFinite(fix.lng) && Number.isFinite(fix.t) && Math.abs(fix.t - time) <= 15_000 && fix.accuracyM >= 0 && fix.accuracyM <= 100;
}
export function deviceFailure(code: string, retryable = true) { return {code, message: code, retryable}; }
export type ShutterSnapshot = {tripId: string; shopId: string; takenAt: number; release(): Promise<void>};

export class ShoppingSessionWeb extends WebPlugin implements ShoppingSessionContract {
  private phase: SessionState['phase'] = 'idle';
  private starting?: Promise<SessionState>;
  private stopping?: Promise<{trip: NonNullable<SessionState['trip']>}>;
  private noticeSent = false;
  private captures = new Set<Promise<void>>();
  private readonly injected?: MockContext;
  constructor(context?: MockContext) { super(); this.injected = context; }
  private get context() { return this.injected ?? getMockContext(); }
  async getState(): Promise<SessionState> {
    const saved = await getWebRepository().getSession();
    return {phase: this.phase === 'idle' && saved.trip ? 'recording' : this.phase, trip: saved.trip, shop: saved.shop, photos: saved.photos.length,
      elapsedMinutes: saved.trip ? Math.max(0, Math.floor((this.context.clock.now() - saved.trip.startedAt) / 60_000)) : 0,
      latestFix: saved.latestFix, locationPermission: this.context.permission('location'), notificationPermission: this.context.permission('notification')};
  }
  private async publish() { const state = await this.getState(); await this.notifyListeners('state', state); return state; }
  start(): Promise<SessionState> {
    if (this.starting) return this.starting;
    this.starting = this.begin().finally(() => { this.starting = undefined; });
    return this.starting;
  }
  private async begin() {
    const existing = await this.getState();
    if (existing.trip) return existing;
    const failure = this.context.failure('ShoppingSession.start'); if (failure) throw failure;
    this.phase = 'requesting_location'; await this.publish();
    if (this.context.permission('location') !== 'granted') {
      this.phase = 'idle'; await this.publish(); throw deviceFailure('location_permission_denied', false);
    }
    this.phase = 'requesting_notification'; await this.publish();
    this.phase = 'starting'; await this.publish();
    const fix = this.context.fixture<Fix>('location');
    if (!validFix(fix, this.context.clock.now())) { this.phase = 'idle'; await this.publish(); throw deviceFailure('location_disabled'); }
    await getWebRepository().startSession({fix});
    this.phase = 'recording'; this.stopping = undefined; this.noticeSent = false;
    const state = await this.publish();
    if (this.context.permission('notification') !== 'granted' && !this.noticeSent) {
      this.noticeSent = true; await this.notifyListeners('notice', {code: 'notification_unavailable'});
    }
    await this.notifyListeners('location', fix);
    return state;
  }
  async newShop() {
    const state = await this.getState();
    if (state.phase !== 'recording' || !state.trip) throw deviceFailure('not_recording');
    const fix = this.context.fixture<Fix>('location');
    if (!validFix(fix, this.context.clock.now())) throw deviceFailure('location_disabled');
    const shop = await getWebRepository().newShop({tripId: state.trip.id, fix});
    await this.publish(); return shop;
  }
  stop() {
    this.stopping ??= this.end(); return this.stopping;
  }
  private async end() {
    const state = await this.getState(); if (!state.trip) throw deviceFailure('not_recording');
    this.phase = 'stopping'; await this.publish();
    await Promise.all(this.captures);
    const trip = await getWebRepository().stopSession({tripId: state.trip.id, endedAt: this.context.clock.now()});
    this.phase = 'idle'; await this.publish(); return {trip};
  }
  async openSettings() { this.context.setFixture('settingsOpened', true); }
  async acquireShutter(): Promise<ShutterSnapshot> {
    const state = await this.getState();
    if (state.phase !== 'recording' || !state.trip || !state.shop) throw deviceFailure('not_recording');
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; }); this.captures.add(pending);
    return {tripId: state.trip.id, shopId: state.shop.id, takenAt: this.context.clock.now(), release: async () => { release(); this.captures.delete(pending); await this.publish(); }};
  }
}
let web: ShoppingSessionWeb | undefined;
export function getShoppingSessionWeb() { return web ??= new ShoppingSessionWeb(); }
export const ShoppingSession = registerDevicePlugin<ShoppingSessionContract>('ShoppingSession', async () => getShoppingSessionWeb());
