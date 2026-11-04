import {afterEach, describe, expect, it, vi} from 'vitest';
import {Capacitor} from '@capacitor/core';
import {runtimeConfig} from '../config';
import {createRelayClient} from './client';

afterEach(() => vi.restoreAllMocks());

describe('relay origin boundary', () => {
  it.each([
    'http://relay.example.com:8787',
    'http://192.168.1.2:8787',
    'http://10.0.2.3:8787',
    'http://localhost.example.com',
    'http://127.0.0.1.example.com',
    'https://user:password@relay.example.com',
    'https://relay.example.com/private',
    'https://relay.example.com?token=secret',
    'https://relay.example.com#fragment',
    'file:///tmp/relay',
    'not-an-origin',
  ])('rejects unsafe configuration and client override: %s', baseUrl => {
    expect(() => runtimeConfig({VITE_SF_RELAY_URL: baseUrl})).toThrow('Invalid relay origin.');
    expect(() => createRelayClient({baseUrl})).toThrow('Invalid relay origin.');
  });

  it.each([
    'http://10.0.2.2:8789',
    'http://127.0.0.1:8789',
    'http://localhost:8789',
    'http://[::1]:8789',
    'https://relay.example.com',
  ])('uses an approved origin without a double-slash path: %s', async origin => {
    expect(runtimeConfig({VITE_SF_RELAY_URL: `${origin}/`}).relayBaseUrl).toBe(origin);
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const client = createRelayClient({baseUrl: `${origin}/`, auth: async () => ({idToken: 'id', appCheckToken: 'app'})});
    await client.request('/v1/route', {origin: {lat: 0, lng: 0}, destination: {lat: 1, lng: 1}});
    expect(fetch.mock.calls[0][0]).toBe(`${origin}/v1/route`);
  });

  it('rejects an explicit web mock runtime on a native platform', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    expect(() => runtimeConfig({VITE_SF_RUNTIME: 'web-mock'})).toThrow('Web mock runtime is not available on Android.');
  });
});
