import type {FaceMask as FaceMaskContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';

export const FaceMask = registerDevicePlugin<FaceMaskContract>('FaceMask', async () => {
  const {createBootstrapPlugin} = await import('./web/bootstrap');
  return createBootstrapPlugin<FaceMaskContract>('FaceMask');
});
