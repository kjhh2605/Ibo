import type {Media as MediaContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';

export const Media = registerDevicePlugin<MediaContract>('Media', async () => {
  const {createBootstrapPlugin} = await import('./web/bootstrap');
  return createBootstrapPlugin<MediaContract>('Media');
});
