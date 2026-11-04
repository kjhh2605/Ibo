import type {Capture as CaptureContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';

export const Capture = registerDevicePlugin<CaptureContract>('Capture', async () => {
  const {createBootstrapPlugin} = await import('./web/bootstrap');
  return createBootstrapPlugin<CaptureContract>('Capture');
});
