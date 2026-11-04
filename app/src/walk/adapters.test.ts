import {afterEach, describe, expect, it, vi} from 'vitest';
import {Capacitor} from '@capacitor/core';
import type {GeolocationPlugin, Position, WatchPositionCallback} from '@capacitor/geolocation';
import {createRelayClient} from '../relay/client';
import {ForegroundLocation} from './location';
import {deferred} from '../deferred';
import {RelayRoute} from './route';
import {fix, position, routeFixture} from './test-fixtures';

vi.mock('../relay/auth', () => ({getAuthTokens: async () => ({idToken: 'test-id-token', appCheckToken: 'test-app-check'})}));
afterEach(() => vi.restoreAllMocks());

function pluginFixture() {
  let callback: WatchPositionCallback | null = null;
  const value: Position = {timestamp: 1000, coords: {latitude: 1, longitude: 2, accuracy: 7, altitudeAccuracy: null, altitude: null, speed: null, heading: null, magneticHeading: null, trueHeading: null, headingAccuracy: null, course: null}};
  const plugin: GeolocationPlugin = {
    requestPermissions: vi.fn(async () => ({location: 'granted' as const, coarseLocation: 'granted' as const})),
    checkPermissions: vi.fn(async () => ({location: 'granted' as const, coarseLocation: 'granted' as const})),
    getCurrentPosition: vi.fn(async () => value),
    watchPosition: vi.fn(async (_options, cb) => { callback = cb; return 'watch'; }),
    clearWatch: vi.fn(async () => {}),
  };
  return {plugin, value, push: (position: Position | null, error?: unknown) => callback?.(position, error)};
}

describe('foreground geolocation', () => {
  it('normalizes fixes and never emits after stop', async () => {
    const {plugin, value, push} = pluginFixture(); const location = new ForegroundLocation(plugin);
    const fixes = vi.fn(); const listener = await location.addListener('fix', fixes);
    await location.start();
    push(value); expect(fixes).toHaveBeenCalledWith({lat: 1, lng: 2, t: 1000, accuracyM: 7});
    expect(await location.current()).toEqual({lat: 1, lng: 2, t: 1000, accuracyM: 7});
    await location.stop(); push({...value, timestamp: 2000}); expect(fixes).toHaveBeenCalledTimes(1);
    expect(plugin.clearWatch).toHaveBeenCalledWith({id: 'watch'});
    await listener.remove();
  });

  it('clears a late watch registration after stop and ignores its callback', async () => {
    const {plugin, value, push} = pluginFixture();
    const pending = deferred<string>(); const began = deferred<void>();
    const initial = plugin.watchPosition;
    plugin.watchPosition = async (options, callback) => { await initial(options, callback); began.resolve(); return pending.promise; };
    const location = new ForegroundLocation(plugin); const fixes = vi.fn(); await location.addListener('fix', fixes);
    const starting = location.start(); await began.promise; await location.stop(); pending.resolve('late'); await starting; push(value);
    expect(plugin.clearWatch).toHaveBeenCalledWith({id: 'late'}); expect(fixes).not.toHaveBeenCalled();
  });

  it('distinguishes denied permission from unavailable location and removes subscription', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    const {plugin, push} = pluginFixture(); const location = new ForegroundLocation(plugin);
    const permission = vi.spyOn(plugin, 'requestPermissions').mockResolvedValue({location: 'denied', coarseLocation: 'denied'});
    await expect(location.start()).rejects.toMatchObject({code: 'location_permission_denied'});
    permission.mockRestore(); await location.start();
    const errors = vi.fn(); const listener = await location.addListener('error', errors);
    push(null, {code: 'OS-PLUG-GLOC-0003'}); expect(errors).toHaveBeenLastCalledWith({code: 'location_permission_denied'});
    push(null, {code: 'OS-PLUG-GLOC-0010'}); expect(errors).toHaveBeenLastCalledWith({code: 'location_unavailable'});
    await listener.remove(); push(null, {code: 'OS-PLUG-GLOC-0010'}); expect(errors).toHaveBeenCalledTimes(2);
    await location.stop();
  });
});

describe('privacy authenticated relay route', () => {
  it('sends only origin/destination to the configured relay with auth and lng-lat response intact', async () => {
    const response = routeFixture();
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), {status: 200, headers: {'content-type': 'application/json'}}));
    const client = createRelayClient({baseUrl: 'http://127.0.0.1:9876', auth: async () => ({idToken: 'test-id-token', appCheckToken: 'test-app-check'})});
    const route = new RelayRoute(client, async () => true);
    const result = await route.request({origin: fix(0, 0), destination: position(200, 200)});
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:9876/v1/route');
    expect(JSON.parse(init!.body as string)).toEqual({origin: position(0, 0), destination: position(200, 200)});
    const headers = new Headers(init!.headers); expect(headers.get('Authorization')).toBe('Bearer test-id-token'); expect(headers.get('X-Firebase-AppCheck')).toBe('test-app-check');
    expect(result.geometry.coordinates).toEqual(response.geometry.coordinates);
  });

  it('makes zero auth or network calls while offline', async () => {
    const auth = vi.fn(); const fetch = vi.spyOn(globalThis, 'fetch');
    const route = new RelayRoute(createRelayClient({baseUrl: 'http://127.0.0.1:9876', auth}), async () => false);
    await expect(route.request({origin: position(0, 0), destination: position(200, 200)})).rejects.toMatchObject({code: 'offline'});
    expect(auth).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });

  it('cancels and rejects stale data even if transport ignores the abort signal', async () => {
    const pending = deferred<Response>(); const started = deferred<void>();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => { started.resolve(); return pending.promise; });
    const route = new RelayRoute(createRelayClient({baseUrl: 'http://127.0.0.1:9876', auth: async () => ({idToken: 'test', appCheckToken: 'test'})}), async () => true);
    const request = route.request({origin: position(0, 0), destination: position(200, 200)});
    await started.promise;
    await expect(route.request({origin: position(0, 0), destination: position(200, 200)})).rejects.toMatchObject({code: 'busy'});
    await route.cancel(); pending.resolve(new Response(JSON.stringify(routeFixture()), {status: 200}));
    await expect(request).rejects.toMatchObject({code: 'cancelled'});
  });

  it('rejects malformed geometry without exposing coordinate payload or provider URL', async () => {
    const response = routeFixture(); response.geometry.coordinates[0] = [200, 95];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), {status: 200}));
    const route = new RelayRoute(createRelayClient({baseUrl: 'http://127.0.0.1:9876', auth: async () => ({idToken: 'test', appCheckToken: 'test'})}), async () => true);
    try { await route.request({origin: position(0, 0), destination: position(200, 200)}); expect.fail('Invalid response accepted'); }
    catch (error) { expect(error).toMatchObject({code: 'invalid_response', message: 'Walking guidance is unavailable.'}); }
  });
});
