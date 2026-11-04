import type {PhotoIndex as PhotoIndexContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';

export const PhotoIndex = registerDevicePlugin<PhotoIndexContract>('PhotoIndex', async () => {
  const {createBootstrapPlugin} = await import('./web/bootstrap');
  return createBootstrapPlugin<PhotoIndexContract>('PhotoIndex');
});
