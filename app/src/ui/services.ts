import {Capacitor} from '@capacitor/core';
import {Store} from '../native/store';
import {ShoppingSession} from '../native/shoppingSession';
import {Capture} from '../native/capture';
import {Media} from '../native/media';
import {Segmenter} from '../native/segmenter';
import type {Asset, Candidate, DeviceError, Fix, Listener, Photo, Piece, Point, Result, ResultPieceSnapshot, SelfPhoto} from '../native/contracts';
import type {components} from '../generated/relay-api';

type RouteResponse = components['schemas']['RouteResponse'];
export type AgentState = {status: 'idle' | 'running' | 'results' | 'not_found' | 'error'; runId: string|null; query: string; stage: string|null; events: {type: string; toolName?: string; scope?: {tripRef: string; shopRef: string; n: number}}[]; stepsExpanded: boolean; showAll: boolean; photos: Photo[]; candidates: Candidate[]; visibleCandidates: Candidate[]; concept: string|null; summary: string|null; error: {code: string; retryable: boolean}|null; notice: string|null};
export interface Agent {getState(): AgentState; subscribe(fn:()=>void):()=>void; submit(query:string):Promise<void>; startVoice():Promise<void>; stopVoice():Promise<void>; cancel():Promise<void>; setStepsExpanded(value:boolean):void; setShowAll(value:boolean):void}
export type FittingState = {draft:{targetPieceId:string|null; companionPieceIds:readonly string[]}; phase:'idle'|'preparing'|'sending'|'compositing'|'saving'|'complete'|'failed'|'cancelled'; selfState:'empty'|'ready'|'registering'|'failed'; selfPhoto:SelfPhoto|null; result:Result|null; error:DeviceError|null};
export interface Fitting {getSnapshot():FittingState; subscribe(fn:()=>void):()=>void; start(id:string):Promise<void>; addCompanion(id:string):Promise<void>; removeCompanion(id:string):void; addTripCandidate(candidate:Candidate):Promise<Piece>; registerSelf(asset:Asset):Promise<boolean>; generate():Promise<Result|null>; cancel():void; restoreResult(result:Result):Promise<void>; canChangePieces(result:Result):Promise<boolean>; exportResult(id:string):Promise<{uri:string}>; refresh():Promise<void>}
export type WalkState = {mode:'loading'|'route'|'direction'|'nearby'|'arrived'|'offline'|'error'; destination:Point; distanceM:number|null; durationS:number|null; bearingDeg:number|null; stepIndex:number|null; route:RouteResponse|null; fix:Fix|null; errorCode:string|null; rerouting:boolean; progressM:number; stepDistanceM:number|null; destinationInfo:{label:string; shop:ResultPieceSnapshot['shop']}};
export interface Walking {start(options:{source:'item';pieceId:string}|{source:'result';resultId:string}):Promise<WalkState>; retry():Promise<WalkState>; confirmArrival():Promise<WalkState>; stop():Promise<void>; getState():WalkState|null; addListener(name:'state', fn:(state:WalkState)=>void):Promise<Listener>}
export interface MapView {mount(options:{element:HTMLElement}):Promise<void>; update(options:{fix:Fix|null;destination:Point;route:RouteResponse|null;progressM?:number}):Promise<void>; unmount():Promise<void>; addListener(name:'ready'|'error',fn:(event:unknown)=>void):Promise<Listener>}
export type Services = {store:typeof Store; shopping:typeof ShoppingSession; capture:typeof Capture; media:typeof Media; segmenter:typeof Segmenter; agent:Agent; fitting:Fitting; walk:Walking; map:MapView; stop():void};

// S08 independent-work boundary: owner modules are optional only until wave integration.
// The Android branch never imports the browser-only contract adapter.
const owners = import.meta.glob(['../agent/index.ts', '../tryon/index.ts', '../walk/index.ts', '../data/index.ts']);
let loaded:Promise<Services>|undefined;
export function loadServices():Promise<Services> {
  // A single app-lifetime owner set, including React StrictMode's effect replay.
  loaded??=initializeServices().catch(error=>{loaded=undefined;throw error;});
  return loaded;
}
async function initializeServices():Promise<Services> {
  if (!Capacitor.isNativePlatform() && import.meta.env.VITE_SF_UI_ADAPTER === '1') {
    // Platform-only test module; production Android must not initialize this adapter.
    const {createUiAdapter} = await import('./web-adapter');
    return createUiAdapter();
  }
  async function owner(path:string):Promise<Record<string, unknown>> {
    if (!owners[path]) throw new Error('Required device service is unavailable.');
    return await owners[path]() as Record<string,unknown>;
  }
  const [search, fitting, walking, data] = await Promise.all([owner('../agent/index.ts'), owner('../tryon/index.ts'), owner('../walk/index.ts'), owner('../data/index.ts')]);
  await (data.startDataWorker as ()=>Promise<void>)();
  return {store:Store, shopping:ShoppingSession, capture:Capture, media:Media, segmenter:Segmenter, agent:search.agent as Agent, fitting:fitting.tryOn as Fitting, walk:walking.Walk as Walking, map:walking.Map as MapView, stop:()=>{void (data.stopDataWorker as ()=>Promise<void>)();}};
}
export function fileUrl(file:string):string {return Capacitor.convertFileSrc(file);}
