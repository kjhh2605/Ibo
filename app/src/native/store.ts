import {Capacitor} from '@capacitor/core';
import type {EntityMap, QueueJob, SelfPhoto, Store as StoreContract} from './contracts';
import {getWebRepository} from '../data/web/repository';
import {registerDevicePlugin} from './registerDevicePlugin';

// Capacitor resolves objects only; unwrap nullable values without changing the public DTOs.
type NativeTransport = Omit<StoreContract, 'get' | 'getSelfPhoto' | 'nextJob'> & {
  get<K extends keyof EntityMap>(options: {entity: K; id: string}): Promise<{value: EntityMap[K] | null}>;
  getSelfPhoto(): Promise<{value: SelfPhoto | null}>;
  nextJob(options: {now: number}): Promise<{value: QueueJob | null}>;
};
const transport = registerDevicePlugin<NativeTransport>('Store', async () => {
  return getWebRepository() as unknown as NativeTransport;
});
const nullable: Record<string, true | undefined> = {get: true, getSelfPhoto: true, nextJob: true};
export const Store = new Proxy(transport, {
  get(target, key) {
    if (key === 'then') return undefined;
    const method = Reflect.get(target, key);
    return async (...args: unknown[]) => {
      const result = await Reflect.apply(method, target, args);
      return Capacitor.isNativePlatform() && nullable[String(key)] ? result.value : result;
    };
  },
}) as unknown as StoreContract;
