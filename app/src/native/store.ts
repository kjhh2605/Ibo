import type {Store as StoreContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';

export const Store = registerDevicePlugin<StoreContract>('Store', async () => {
  const {createBootstrapPlugin} = await import('./web/bootstrap');
  return createBootstrapPlugin<StoreContract>('Store');
});
