import type {Voice as VoiceContract} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';

export const Voice = registerDevicePlugin<VoiceContract>('Voice', async () => {
  const {createBootstrapPlugin} = await import('./web/bootstrap');
  return createBootstrapPlugin<VoiceContract>('Voice');
});
