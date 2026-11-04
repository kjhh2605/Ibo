import {Capacitor} from '@capacitor/core';
import {Geolocation} from '@capacitor/geolocation';
import type {GeolocationPlugin, Position} from '@capacitor/geolocation';
import {EventSource} from './events';
import {validPoint} from './geometry';
import {WalkError} from './types';
import type {Fix, LocationAPI} from './types';

const options = {enableHighAccuracy: true, timeout: 15000, maximumAge: 5000, minimumUpdateInterval: 5000, interval: 5000};

function normalize(position: Position): Fix {
  const fix = {lat: position.coords.latitude, lng: position.coords.longitude, accuracyM: position.coords.accuracy, t: position.timestamp};
  if (!validPoint(fix) || !Number.isFinite(fix.accuracyM) || fix.accuracyM < 0 || !Number.isSafeInteger(fix.t) || fix.t < 0) throw new WalkError('location_unavailable');
  return fix;
}

function locationError(error: unknown): WalkError {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  return new WalkError(code === 'OS-PLUG-GLOC-0003' || code === 1 ? 'location_permission_denied' : 'location_unavailable');
}

export class ForegroundLocation extends EventSource<{fix: Fix; error: {code: string}}> implements LocationAPI {
  private watchId: string | null = null;
  private generation = 0;
  private starting: Promise<void> | null = null;
  private plugin: GeolocationPlugin;

  constructor(plugin: GeolocationPlugin = Geolocation) {
    super();
    this.plugin = plugin;
  }

  async start(): Promise<void> {
    if (this.watchId !== null) return;
    if (this.starting) return this.starting;
    const generation = ++this.generation;
    const task = (async () => {
      try {
        // Browser watch/getCurrentPosition own the permission prompt; requestPermissions is native-only.
        if (Capacitor.isNativePlatform()) {
          const permission = await this.plugin.requestPermissions({permissions: ['location']});
          if (generation !== this.generation) return;
          if (permission.location !== 'granted' && permission.coarseLocation !== 'granted') throw new WalkError('location_permission_denied');
        }
        const id = await this.plugin.watchPosition(options, (position, error) => {
          if (generation !== this.generation) return;
          if (error || !position) { this.emit('error', {code: locationError(error).code}); return; }
          try { this.emit('fix', normalize(position)); }
          catch { this.emit('error', {code: 'location_unavailable'}); }
        });
        if (generation !== this.generation) await this.plugin.clearWatch({id});
        else this.watchId = id;
      } catch (error) {
        if (error instanceof WalkError) throw error;
        throw locationError(error);
      }
    })();
    this.starting = task;
    try { await task; }
    finally { if (this.starting === task) this.starting = null; }
  }

  async current(): Promise<Fix> {
    try { return normalize(await this.plugin.getCurrentPosition(options)); }
    catch (error) { throw locationError(error); }
  }

  async stop(): Promise<void> {
    ++this.generation;
    this.starting = null;
    const id = this.watchId;
    this.watchId = null;
    if (id !== null) await this.plugin.clearWatch({id});
  }
}
