import {Capacitor} from '@capacitor/core';

export type Runtime = 'native' | 'web' | 'web-mock';

/** Cleartext is limited to the local relay's approved development hosts. */
export function validateRelayOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Invalid relay origin.');
  }
  const local = ['10.0.2.2', '127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Invalid relay origin.');
  }
  return url.origin;
}

export function runtimeConfig(env: Record<string, string | boolean | undefined> = import.meta.env) {
  const native = Capacitor.isNativePlatform();
  if (native && env.VITE_SF_RUNTIME === 'web-mock') {
    throw new Error('Web mock runtime is not available on Android.');
  }
  const runtime: Runtime = native ? 'native' : env.VITE_SF_RUNTIME === 'web-mock' ? 'web-mock' : 'web';
  const relayBaseUrl = String(env.VITE_SF_RELAY_URL || (native ? 'http://10.0.2.2:8787' : 'http://127.0.0.1:8787'));
  return {runtime, relayBaseUrl: validateRelayOrigin(relayBaseUrl), resultDownload: false as const};
}

export const config = runtimeConfig();
