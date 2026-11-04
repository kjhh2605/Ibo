import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const device = vi.hoisted(() => ({native: false, debug: false, unavailable: false, reads: 0}));
vi.mock('@capacitor/core', () => ({Capacitor: {isNativePlatform: () => device.native}}));
vi.mock('./native/store', () => ({Store: {
  async getRuntimeInfo() {if (device.unavailable) throw new Error('Unavailable'); return {debug: device.debug};},
  async getSelfPhoto() {device.reads++; return null;},
}}));

beforeEach(() => {
  vi.resetModules();
  device.native = false; device.debug = false; device.unavailable = false; device.reads = 0;
  vi.stubEnv('VITE_SF_RUNTIME', 'web-mock');
  vi.stubEnv('VITE_SF_VERIFICATION', '1');
  vi.stubEnv('DEV', true);
});
afterEach(() => vi.unstubAllEnvs());

// Fresh imports intentionally exercise each build/runtime exposure boundary.
describe('verification observer exposure', () => {
  it('does not expose state without explicit opt-in', async () => {
    vi.stubEnv('VITE_SF_VERIFICATION', '');
    const observer = await import('./verification');
    expect(await observer.enableVerification()).toBe(false);
    expect(observer.verificationSnapshot()).toBeNull();
    expect(device.reads).toBe(0);
  });
  it.each(['release', 'unavailable'] as const)('fails closed for native %s despite the Vite flag', async mode => {
    device.native = true; device.unavailable = mode === 'unavailable';
    vi.stubEnv('VITE_SF_RUNTIME', 'native');
    const observer = await import('./verification');
    expect(await observer.enableVerification()).toBe(false);
    expect(observer.verificationSnapshot()).toBeNull();
    expect(device.reads).toBe(0);
  });
  it('does not expose a production browser build', async () => {
    vi.stubEnv('DEV', false);
    const observer = await import('./verification');
    expect(await observer.enableVerification()).toBe(false);
    expect(observer.verificationSnapshot()).toBeNull();
    expect(device.reads).toBe(0);
  });
  it('requires the native debug proof even when running a production Vite bundle', async () => {
    device.native = true; device.debug = true;
    vi.stubEnv('VITE_SF_RUNTIME', 'native'); vi.stubEnv('DEV', false);
    const observer = await import('./verification');
    expect(await observer.enableVerification()).toBe(true);
    expect(observer.verificationSnapshot()?.scope).toBe('relay-attempts/shared-file-reads/media-export-attempts');
  });
});
