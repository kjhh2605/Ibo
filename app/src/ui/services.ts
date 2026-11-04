import {Store} from '../native/store';
import {ShoppingSession} from '../native/shoppingSession';
import {Capture} from '../native/capture';
import {Media} from '../native/media';
import {Segmenter} from '../native/segmenter';
import {agent} from '../agent';
import {tryOn} from '../tryon';
import {Walk, Map} from '../walk';
import {startDataWorker, stopDataWorker} from '../data';
import {config} from '../config';
import {installWebFixtures} from './web-fixtures';

export type {AgentSnapshot as AgentState} from '../agent';
export type {TryOnState as FittingState} from '../tryon';
export type {WalkState, MapAPI as MapView} from '../walk';
export type Services = {store:typeof Store; shopping:typeof ShoppingSession; capture:typeof Capture; media:typeof Media; segmenter:typeof Segmenter; agent:typeof agent; fitting:typeof tryOn; walk:typeof Walk; map:typeof Map; stop():Promise<void>};

let loaded:Promise<Services>|undefined;
export function loadServices():Promise<Services> {
  // One app-lifetime owner set, including React StrictMode's effect replay.
  loaded??=initializeServices().catch(error=>{loaded=undefined;throw error;});
  return loaded;
}
async function initializeServices():Promise<Services> {
  const removeFixtures=config.runtime==='web-mock' ? await installWebFixtures() : ()=>{};
  await startDataWorker();
  return {store:Store, shopping:ShoppingSession, capture:Capture, media:Media, segmenter:Segmenter, agent, fitting:tryOn, walk:Walk, map:Map, async stop(){await stopDataWorker();removeFixtures();}};
}
