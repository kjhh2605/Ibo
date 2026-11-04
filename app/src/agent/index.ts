import {Network} from '@capacitor/network';
import {PhotoIndex} from '../native/photoIndex';
import {Store} from '../native/store';
import {Voice} from '../native/voice';
import {readBytes, writeTemp} from '../native/files';
import {relay} from '../relay/client';
import {createAgentController} from './controller';
import {createAgentMedia} from './media';

export {createAgentController} from './controller';
export type {AgentController, AgentDependencies, AgentEvent, AgentSnapshot, AgentStage} from './types';

export const agent = createAgentController({
  store: Store,
  photoIndex: PhotoIndex,
  voice: Voice,
  relay,
  media: createAgentMedia({readBytes, writeTemp, discard: file => Store.discardTemp({file})}),
  isOnline: async () => (await Network.getStatus()).connected,
});
