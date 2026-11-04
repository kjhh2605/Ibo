import {Capacitor, registerPlugin} from '@capacitor/core';
import type {DeviceError} from './contracts';
import {observePluginAttempt, observePluginResult} from '../verification';

function normalizeDeviceError(error: unknown): DeviceError {
  const value = typeof error === 'object' && error !== null ? error : {};
  const code = 'code' in value && typeof value.code === 'string' ? value.code.toLowerCase() : '';
  const data = 'data' in value && typeof value.data === 'object' && value.data !== null ? value.data : {};
  return {
    code: /^[a-z_]{1,64}$/.test(code) ? code : 'io_error',
    message: 'The device operation could not be completed.',
    retryable: 'retryable' in value && typeof value.retryable === 'boolean'
      ? value.retryable
      : 'retryable' in data && data.retryable === true,
  };
}

/** Only an explicitly selected browser fixture runtime may replace device plugins. */
export function registerDevicePlugin<T>(name: string, web: () => Promise<T>): T {
  const mock = !Capacitor.isNativePlatform() && import.meta.env.VITE_SF_RUNTIME === 'web-mock';
  const native = mock ? undefined : registerPlugin<T>(name);
  let instance: Promise<T> | undefined;
  return new Proxy({}, {
    get(_target, key) {
      if (key === 'then') return undefined;
      return async (...args: unknown[]) => {
        try {
          const plugin = mock ? await (instance ??= web()) : native;
          const method = Reflect.get(plugin as object, key);
          if (typeof method !== 'function') throw new TypeError(`${name} has no such method`);
          observePluginAttempt(name, key);
          const result = await Reflect.apply(method, plugin, args);
          observePluginResult(name, key, result);
          return result;
        } catch (error) {
          throw normalizeDeviceError(error);
        }
      };
    },
  }) as T;
}
