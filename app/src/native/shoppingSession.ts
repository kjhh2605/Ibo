import type {ShoppingSession as ShoppingSessionContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';

export const ShoppingSession = registerDevicePlugin<ShoppingSessionContract>('ShoppingSession', async () => {
  const {createBootstrapPlugin} = await import('./web/bootstrap');
  return createBootstrapPlugin<ShoppingSessionContract>('ShoppingSession');
});
