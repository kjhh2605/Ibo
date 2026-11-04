import type {Listener} from '../contracts';
import {getMockContext} from './context';
import type {MockContext} from './context';

/** Bootstrap operations reject until their owning feature slice implements them. */
export function createBootstrapPlugin<T>(name: string, context?: MockContext): T {
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const api = {
    async addListener(event: string, listener: (value: unknown) => void): Promise<Listener> {
      let set = listeners.get(event);
      if (!set) { set = new Set(); listeners.set(event, set); }
      set.add(listener);
      return {async remove() { set.delete(listener); }};
    },
  };
  return new Proxy(api, {
    get(target, key, receiver) {
      if (typeof key !== 'string' || key in target) return Reflect.get(target, key, receiver);
      // A proxy must not look like a Promise to Capacitor's async loader.
      if (key === 'then') return undefined;
      return async () => {
        const failure = (context ?? getMockContext()).failure(`${name}.${key}`);
        throw failure ?? {code: 'unimplemented', message: `${name}.${key} is not implemented`, retryable: false};
      };
    },
  }) as T;
}
