import type {Segmenter as SegmenterContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';

export const Segmenter = registerDevicePlugin<SegmenterContract>('Segmenter', async () => {
  const {createBootstrapPlugin} = await import('./web/bootstrap');
  return createBootstrapPlugin<SegmenterContract>('Segmenter');
});
