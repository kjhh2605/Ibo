import {Capacitor} from '@capacitor/core';
import type {Asset, Candidate, DeviceError, EntityMap, Fix, Photo, Piece, Point, QueueJob, Result, ResultPieceSnapshot, SelfPhoto, SessionState, Shop, Trip} from '../native/contracts';
import type {AgentState, FittingState, MapView, Services, WalkState} from './services';
import type {Route} from './navigation';
import {createEvents, deviceError, UiFixtures} from './web-fixtures';

type WalkMode='route'|'direction'|'nearby'|'offline'|'error'|'location_unavailable'|'route_unavailable';
type Counters={generations:number; rawSelfUploads:number; resultDownloads:number; resultDownloadAttempts:number; queries:number; voiceStarts:number; transcriptions:number; captures:number; mediaPicks:number; photoExports:number; deepLinks:number; providerRequests:number};
export type UiAdapterInspection={
  generations:number; rawSelfUploads:number; resultDownloads:number; counters:Counters;
  fixtureProvenance:'s11-unreviewed-synthetic'; offline:boolean; failure:string|null; maskFailure:boolean;
  ids:{trips:string[]; shops:string[]; photos:string[]; pieces:string[]; shopPieces:string[]; wardrobePieces:string[]; results:string[]};
  session:{phase:SessionState['phase']; tripId:string|null; shopId:string|null; photos:number};
  fitting:{targetPieceId:string|null; companionPieceIds:string[]; resultId:string|null; phase:FittingState['phase']; selfState:FittingState['selfState']; selfUpdatedAt:number|null};
  agent:{status:AgentState['status']; runId:string|null; candidateIds:string[]; photoIds:string[]};
  walk:{mode:WalkState['mode']; source:'item'|'result'; sourceId:string}|null;
  preview:{open:boolean; purpose:'shopping'|'wardrobe'|'self'|null};
};
export interface UiAdapterControls {
  reset(options?:{seed?:boolean}):Promise<void>;
  setFailure(operationOrMode:string|null):void;
  setOffline(value:boolean):void;
  setMaskFailure(value:boolean):void;
  setWalkMode(mode:WalkMode):void;
  emitDeepLink(url:string):Promise<void>;
  visit(route:Route):void;
  inspect():UiAdapterInspection;
}
declare global {interface Window {__sfUi?:UiAdapterControls}}

type Tables={[K in keyof EntityMap]:Map<string,EntityMap[K]>};
type Draft={id:string; targetPieceId:string; companionPieceIds:string[]; targetSnapshot:ResultPieceSnapshot; companionSnapshots:ResultPieceSnapshot[]};
type AssetRecord={asset:Asset; image:string; purpose:'shopping'|'wardrobe'|'self'};
const entities:(keyof EntityMap)[]=['Trip','TrailPoint','Shop','Photo','PhotoEmbedding','Piece','Result','QueueJob'];
const blankCounters=():Counters=>({generations:0,rawSelfUploads:0,resultDownloads:0,resultDownloadAttempts:0,queries:0,voiceStarts:0,transcriptions:0,captures:0,mediaPicks:0,photoExports:0,deepLinks:0,providerRequests:0});
const blankAgent=():AgentState=>({status:'idle',runId:null,query:'',stage:null,events:[],stepsExpanded:false,showAll:false,photos:[],candidates:[],visibleCandidates:[],concept:null,summary:null,error:null,notice:null});
const blankFitting=():FittingState=>({draft:{targetPieceId:null,companionPieceIds:[]},phase:'idle',selfState:'empty',selfPhoto:null,result:null,error:null});
const blankSession=():SessionState=>({phase:'idle',trip:null,shop:null,locationPermission:'granted',notificationPermission:'granted',photos:0,elapsedMinutes:0,latestFix:null});
const copy=<T>(value:T):T=>structuredClone(value);
function cleanText(value:string,max:number):string {const text=value.trim();if(!text||text.length>max)throw deviceError('invalid_argument','The saved text is invalid.',false);return text;}
function asError(cause:unknown):DeviceError {return typeof cause==='object'&&cause!==null&&'code' in cause?{code:String(cause.code),message:'The operation could not be completed.',retryable:'retryable' in cause?Boolean(cause.retryable):true}:{code:'io_error',message:'The operation could not be completed.',retryable:true};}
function distance(a:Point,b:Point):number {const radians=Math.PI/180;const lat=(b.lat-a.lat)*radians,lng=(b.lng-a.lng)*radians;const h=Math.sin(lat/2)**2+Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin(lng/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
function bearing(a:Point,b:Point):number {const r=Math.PI/180,delta=(b.lng-a.lng)*r;return (Math.atan2(Math.sin(delta)*Math.cos(b.lat*r),Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos(delta))/r+360)%360;}

/** Explicit, non-native UI verification only. No provider, permissions, microphone or GPS is invoked. */
export async function createUiAdapter():Promise<Services> {
  if (Capacitor.isNativePlatform()||import.meta.env.VITE_SF_UI_ADAPTER!=='1') throw deviceError('service_unavailable','The UI verification adapter is not enabled.',false);
  const fixtureBase=import.meta.env.VITE_SF_UI_FIXTURES;
  if (typeof fixtureBase!=='string'||!fixtureBase) throw deviceError('fixture_empty','VITE_SF_UI_FIXTURES must name the verification fixture server.',false);
  const fixtures=await UiFixtures.load(fixtureBase);
  const tables:Tables={Trip:new Map(),TrailPoint:new Map(),Shop:new Map(),Photo:new Map(),PhotoEmbedding:new Map(),Piece:new Map(),Result:new Map(),QueueJob:new Map()};
  const storeEvents=createEvents<{changed:{entities:(keyof EntityMap|'SelfPhoto')[];ids:string[]}}>();
  const shoppingEvents=createEvents<{state:SessionState;location:Fix;notice:{code:'notification_unavailable'};open:{url:'streetfitting://home'|'streetfitting://capture'|'streetfitting://capture?newShop=1'};error:{code:'location_permission_denied'|'location_disabled'|'service_unavailable';retryable:boolean}}>();
  const captureEvents=createEvents<{captured:{asset:Asset;photo:Photo|null};preview:{ready:boolean}}>();
  const mediaEvents=createEvents<{exported:{uri:string;sourceId:string}}>();
  const segmentEvents=createEvents<{prepared:{handle:string;assetId:string}}>();
  const walkEvents=createEvents<{state:WalkState}>();
  const fittingListeners=new Set<()=>void>(),agentListeners=new Set<()=>void>();
  const assets=new Map<string,AssetRecord>(),sourceImages=new Map<string,string>(),drafts=new Map<string,Draft>();
  const pendingSaves=new Map<string,Promise<Piece>>();
  let session=blankSession(),fittingState=blankFitting(),agentState=blankAgent();
  let selfPhoto:SelfPhoto|null=null,counters=blankCounters(),failure:string|null=null,maskFailure=false,offline=false;
  let sequence=0,epoch=0,agentRun=0,fittingRun=0,previewRun=0,stopped=false;
  let walkMode:WalkMode='route',walkState:WalkState|null=null,walkSource:{source:'item'|'result';id:string}|null=null;
  let segmentHandle:{id:string;asset:Asset;image:string}|null=null;
  let preview:{purpose:'shopping'|'wardrobe'|'self';canvas:HTMLCanvasElement;rect:{x:number;y:number;width:number;height:number}|null}|null=null;
  const onlineDescriptor=Object.getOwnPropertyDescriptor(navigator,'onLine');
  Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>!offline});
  const now=()=>Date.now();
  const id=(kind:string)=>`ui-${kind}-${++sequence}`;
  const assertLive=(version=epoch)=>{if(stopped||version!==epoch)throw deviceError('cancelled','The operation was cancelled.',false);};
  function injection(operation:string):DeviceError|null {
    if(!failure)return null;
    const group=operation.split('.')[0];
    const defaults:Record<string,string>={store:'io_error',shopping:'service_unavailable',capture:'camera_unavailable',media:'io_error',segmenter:'inference_failed',agent:'upstream_timeout',voice:'audio_unavailable',fitting:'upstream_timeout',walk:'upstream_timeout',map:'map_unavailable'};
    const codeGroups:Record<string,string[]>={
      location_permission_denied:['shopping','walk'],location_disabled:['shopping'],notification_unavailable:[],
      camera_permission_denied:['capture'],camera_unavailable:['capture'],fixture_invalid:['capture','media'],
      model_missing:['segmenter'],model_invalid:['segmenter'],inference_failed:['segmenter'],
      index_unavailable:['agent'],invalid_tool_response:['agent'],photo_limit_exceeded:['agent'],
      microphone_permission:['voice'],audio_unavailable:['voice'],
      content_policy_violation:['agent','fitting'],upstream_timeout:['agent','voice','fitting','walk'],
      unsafe_output:['fitting'],self_photo_changed:['fitting'],
      location_unavailable:['shopping','capture','walk'],route_unavailable:['walk'],map_unavailable:['map'],
      auth_required:['agent','voice','fitting','walk'],
    };
    if(failure==='all'||failure==='error'||failure===operation||failure===group||(failure==='search'&&group==='agent')||(failure==='generate'&&operation==='fitting.generate')) return {code:defaults[group]??'io_error',message:'The requested verification failure is active.',retryable:true};
    if(codeGroups[failure]?.includes(group))return {code:failure,message:'The requested verification failure is active.',retryable:failure!=='content_policy_violation'};
    return null;
  }
  function check(operation:string,needsConnection=false):void {assertLive();if(needsConnection&&offline)throw deviceError('offline','This operation needs a connection.');const error=injection(operation);if(error)throw deviceError(error.code,error.message,error.retryable);}
  function setAgent(next:AgentState) {agentState=next;for(const listener of [...agentListeners])listener();}
  function setFitting(next:FittingState) {fittingState=next;for(const listener of [...fittingListeners])listener();}
  function emitSession() {
    if(session.phase==='recording'&&session.trip&&session.shop){
      session={...session,trip:copy(tables.Trip.get(session.trip.id)??session.trip),shop:copy(tables.Shop.get(session.shop.id)??session.shop),photos:[...tables.Photo.values()].filter(photo=>photo.shopId===session.shop?.id).length,elapsedMinutes:Math.max(0,Math.floor((now()-session.trip.startedAt)/60000))};
    }
    shoppingEvents.emit('state',session);
  }
  function changed(changedEntities:(keyof EntityMap|'SelfPhoto')[],ids:string[]) {storeEvents.emit('changed',{entities:changedEntities,ids});if(changedEntities.includes('Photo')||changedEntities.includes('Shop'))emitSession();}
  function releaseSnapshot(snapshot:ResultPieceSnapshot) {fixtures.release(snapshot.cutoutFile);if(snapshot.shop?.storefrontFile)fixtures.release(snapshot.shop.storefrontFile);}
  function releaseDraft(draft:Draft) {releaseSnapshot(draft.targetSnapshot);for(const snapshot of draft.companionSnapshots)releaseSnapshot(snapshot);}
  function shopInfo(piece:Piece):ResultPieceSnapshot['shop'] {
    const shop=piece.shopId?tables.Shop.get(piece.shopId):null;
    if(!shop)return null;
    const storefront=shop.storefrontPhotoId?tables.Photo.get(shop.storefrontPhotoId):null;
    return {n:shop.n,startedAt:shop.startedAt,storefrontFile:storefront?.file??null,description:shop.description,note:shop.note};
  }
  async function snapshot(piece:Piece,shop:ResultPieceSnapshot['shop']):Promise<ResultPieceSnapshot> {
    const files:string[]=[];
    try {
      const cutoutFile=await fixtures.copyFile(piece.cutoutFile);files.push(cutoutFile);
      if(shop?.storefrontFile){shop.storefrontFile=await fixtures.copyFile(shop.storefrontFile);files.push(shop.storefrontFile);}
      return {pieceId:piece.id,origin:piece.origin,label:piece.label,category:piece.category,cutoutFile,walkTo:copy(piece.walkTo),shop};
    } catch(cause){for(const file of files)fixtures.release(file);throw cause;}
  }
  function removeJobs(predicate:(job:QueueJob)=>boolean) {for(const [key,job] of tables.QueueJob)if(predicate(job))tables.QueueJob.delete(key);}
  function reconcileSelection() {
    const target=fittingState.draft.targetPieceId;
    setFitting({...fittingState,draft:{targetPieceId:target&&tables.Piece.has(target)?target:null,companionPieceIds:fittingState.draft.companionPieceIds.filter(pieceId=>tables.Piece.has(pieceId))}});
  }
  function enqueueLocal(kind:QueueJob['kind'],refId:string):QueueJob {
    const current=[...tables.QueueJob.values()].find(job=>job.kind===kind&&job.refId===refId);
    if(current)return current;
    const job:QueueJob={id:id('job'),kind,refId,attempts:0,nextAt:now()};tables.QueueJob.set(job.id,job);return job;
  }
  function completeLocal(job:QueueJob,values:{description?:string;label?:string;category?:string}) {
    if(job.kind==='label_piece'){
      const piece=tables.Piece.get(job.refId);
      if(piece&&values.label&&values.category)tables.Piece.set(piece.id,{...piece,label:cleanText(values.label,120),category:cleanText(values.category,64)});
    }else{
      const photo=tables.Photo.get(job.refId),shop=photo?tables.Shop.get(photo.shopId):null;
      if(photo&&shop?.storefrontPhotoId===photo.id&&values.description)tables.Shop.set(shop.id,{...shop,description:cleanText(values.description,300),descriptionState:'done'});
    }
    tables.QueueJob.delete(job.id);
  }
  function processFixtureJobs() {
    if(offline||stopped)return;
    const completed:string[]=[];
    for(const job of [...tables.QueueJob.values()]){
      if(job.nextAt>now()||failure==='label_piece'||failure==='describe_storefront'||injection(`store.${job.kind}`))continue;
      tables.QueueJob.set(job.id,{...job,attempts:job.attempts+1});
      completeLocal(job,job.kind==='label_piece'?fixtures.pieceDescription:{description:fixtures.storeDescription});completed.push(job.refId,job.id);
    }
    if(completed.length)changed(['Piece','Shop','QueueJob'],completed);
  }
  function imageSource(asset:Asset):string {
    const source=assets.get(asset.id)?.image??sourceImages.get(asset.file);
    if(!source)throw deviceError('not_found','The source image is no longer available.',false);
    return source;
  }
  async function fixtureAsset(image:string,purpose:AssetRecord['purpose'],assetId=id('asset')):Promise<Asset> {
    const loaded=await fixtures.image(image);
    const asset:Asset={id:assetId,file:fixtures.url(image),w:loaded.naturalWidth,h:loaded.naturalHeight};
    assets.set(asset.id,{asset,image,purpose});sourceImages.set(asset.file,image);return asset;
  }
  function captureImage(kind:'item'|'storefront'='item'):string {
    if(preview?.purpose==='self')return 'images/self/positive/calibration-hat.png';
    if(preview?.purpose==='wardrobe')return 'images/shops/shop-3-items.png';
    const number=((session.shop?.n??1)-1)%3+1;
    const entry=fixtures.store.captureManifest.find(path=>path.includes(`shop${number}-${kind}.png`));
    if(!entry)throw deviceError('fixture_empty','The requested capture fixture is missing.',false);
    return entry;
  }
  function captureSource(image:string,kind:'item'|'storefront'):string {
    const number=((session.shop?.n??1)-1)%3+1;
    return image.startsWith('capture/')?(kind==='item'?`images/shops/shop-${number}-items.png`:`images/storefronts/shop-${number}.png`):image;
  }
  async function paintPreview() {
    const current=preview;if(!current)return;
    const image=await fixtures.image(captureImage());if(preview!==current)return;
    current.canvas.width=image.naturalWidth;current.canvas.height=image.naturalHeight;
    current.canvas.getContext('2d')?.drawImage(image,0,0);
  }
  function closePreview() {previewRun++;if(preview){preview.canvas.remove();preview=null;}captureEvents.emit('preview',{ready:false});}

  const store:Services['store']={
    addListener:storeEvents.addListener,
    async get<K extends keyof EntityMap>(options:{entity:K;id:string}):Promise<EntityMap[K]|null> {check('store.get');return copy(tables[options.entity].get(options.id)??null);},
    async list<K extends keyof EntityMap>(options:{entity:K;tripId?:string;shopId?:string;origin?:'shop'|'wardrobe';limit?:number;cursor?:string}) {
      check('store.list');const limit=options.limit??100,offset=options.cursor?Number(options.cursor):0;
      if(!Number.isInteger(limit)||limit<1||limit>200||!Number.isInteger(offset)||offset<0)throw deviceError('invalid_argument','The page is invalid.',false);
      const entries=[...tables[options.entity].entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,value])=>value).filter(value=>(!options.tripId||('tripId' in value&&value.tripId===options.tripId))&&(!options.shopId||('shopId' in value&&value.shopId===options.shopId))&&(!options.origin||('origin' in value&&value.origin===options.origin)));
      return {items:copy(entries.slice(offset,offset+limit)),nextCursor:offset+limit<entries.length?String(offset+limit):null};
    },
    async getSelfPhoto(){check('store.getSelfPhoto');return copy(selfPhoto);},
    async saveCandidate(options) {
      check('store.saveCandidate');const version=epoch;
      const mask=fixtures.findMask(options.candidate.mask);
      if(!mask)throw deviceError('invalid_argument','The selected mask is not available.',false);
      const source=options.origin==='shop'?tables.Photo.get(options.candidate.photoId):assets.get(options.candidate.photoId)?.asset;
      if(!source)throw deviceError('not_found','The source image is no longer available.',false);
      if(imageSource({id:source.id,file:source.file,w:source.w,h:source.h})!==mask.image)throw deviceError('invalid_argument','The mask does not belong to this image.',false);
      const candidate=await fixtures.candidate(options.candidate.photoId,options.candidate.source,mask,options.candidate.label);
      const pieceId=`piece:${candidate.id}`,existing=tables.Piece.get(pieceId);if(existing)return copy(existing);
      const pending=pendingSaves.get(pieceId);if(pending)return copy(await pending);
      const save=(async()=>{
        const cutoutFile=await fixtures.cutout(mask);
        try {
          assertLive(version);const photo=options.origin==='shop'?tables.Photo.get(candidate.photoId):null;
          if(options.origin==='shop'&&(!photo||photo.kind!=='item'))throw deviceError('not_found','The source image is no longer available.',false);
          if(options.origin==='wardrobe'&&!assets.has(candidate.photoId))throw deviceError('not_found','The imported image is no longer available.',false);
          const piece:Piece={id:pieceId,origin:options.origin,label:options.labelMode==='concept'?cleanText(candidate.label,120):'Picked item',category:'unknown',cutoutFile,createdAt:now(),photoId:photo?.id??null,shopId:photo?.shopId??null,tripId:photo?.tripId??null,walkTo:photo?{lat:photo.location.lat,lng:photo.location.lng}:null};
          tables.Piece.set(piece.id,piece);
          if(options.labelMode==='describe')enqueueLocal('label_piece',piece.id);
          changed(['Piece','QueueJob'],[piece.id]);processFixtureJobs();return copy(tables.Piece.get(piece.id)!);
        }catch(cause){fixtures.release(cutoutFile);throw cause;}
      })();
      pendingSaves.set(pieceId,save);try{return await save;}finally{pendingSaves.delete(pieceId);}
    },
    async updateShop({id:shopId,note}) {check('store.updateShop');const shop=tables.Shop.get(shopId);if(!shop)throw deviceError('not_found','The shop is no longer available.',false);const text=note?.trim()||null;if(text&&text.length>280)throw deviceError('invalid_argument','The note is too long.',false);const updated={...shop,note:text};tables.Shop.set(shopId,updated);changed(['Shop'],[shopId]);return copy(updated);},
    async updatePiece({id:pieceId,label,category}) {check('store.updatePiece');const piece=tables.Piece.get(pieceId);if(!piece)throw deviceError('not_found','The piece is no longer available.',false);const updated={...piece,label:cleanText(label,120),category:cleanText(category,64)};tables.Piece.set(pieceId,updated);removeJobs(job=>job.kind==='label_piece'&&job.refId===pieceId);changed(['Piece','QueueJob'],[pieceId]);return copy(updated);},
    async prepareResult({targetPieceId,companionPieceIds}) {
      check('store.prepareResult');const version=epoch,target=tables.Piece.get(targetPieceId);
      if(!target||target.origin!=='shop'||!target.walkTo)throw deviceError('invalid_reference','A saved shop target is required.',false);
      if(companionPieceIds.length>5||new Set(companionPieceIds).size!==companionPieceIds.length||companionPieceIds.includes(targetPieceId))throw deviceError('invalid_argument','Choose up to five different companions.',false);
      const companions=companionPieceIds.map(pieceId=>tables.Piece.get(pieceId));
      if(companions.some(piece=>!piece))throw deviceError('invalid_reference','A companion is no longer available.',false);
      const records=[target,...companions].map(piece=>({piece:copy(piece!),shop:shopInfo(piece!)}));
      const snapshots:ResultPieceSnapshot[]=[];
      try {
        for(const record of records)snapshots.push(await snapshot(record.piece,record.shop));
        assertLive(version);const draft:Draft={id:id('result'),targetPieceId,companionPieceIds:[...companionPieceIds],targetSnapshot:snapshots[0],companionSnapshots:snapshots.slice(1)};
        drafts.set(draft.id,draft);return {draftId:draft.id,targetSnapshot:copy(draft.targetSnapshot),companionSnapshots:copy(draft.companionSnapshots)};
      }catch(cause){for(const value of snapshots)releaseSnapshot(value);throw cause;}
    },
    async saveResult({draftId,file,faceless,providerFile}) {
      check('store.saveResult');const existing=tables.Result.get(draftId);if(existing)return copy(existing);
      const draft=drafts.get(draftId),version=epoch;if(!draft)throw deviceError('not_found','The result draft is no longer available.',false);
      const files:string[]=[];
      try {
        const savedFile=await fixtures.copyFile(file);files.push(savedFile);const savedProvider=await fixtures.copyFile(providerFile);files.push(savedProvider);assertLive(version);
        if(drafts.get(draftId)!==draft)throw deviceError('cancelled','The result draft was discarded.',false);
        const result:Result={id:draft.id,targetPieceId:draft.targetPieceId,companionPieceIds:[...draft.companionPieceIds],targetSnapshot:copy(draft.targetSnapshot),companionSnapshots:copy(draft.companionSnapshots),file:savedFile,providerFile:savedProvider,faceless,createdAt:now()};
        tables.Result.set(result.id,result);drafts.delete(draft.id);changed(['Result'],[result.id]);return copy(result);
      }catch(cause){for(const value of files)fixtures.release(value);throw cause;}
    },
    async discardResultDraft({draftId}) {const draft=drafts.get(draftId);if(draft){releaseDraft(draft);drafts.delete(draftId);}},
    async deleteTrip({id:tripId}) {
      check('store.deleteTrip');if(session.trip?.id===tripId)await shopping.stop();
      const photos=[...tables.Photo.values()].filter(photo=>photo.tripId===tripId),photoIds=new Set(photos.map(photo=>photo.id));
      for(const photo of photos){tables.Photo.delete(photo.id);tables.PhotoEmbedding.delete(photo.id);assets.delete(photo.id);}
      for(const [key,shop] of tables.Shop)if(shop.tripId===tripId)tables.Shop.delete(key);
      for(const [key,point] of tables.TrailPoint)if(point.tripId===tripId)tables.TrailPoint.delete(key);
      for(const [key,piece] of tables.Piece)if(piece.tripId===tripId)tables.Piece.set(key,{...piece,photoId:null,shopId:null,tripId:null});
      removeJobs(job=>job.kind==='describe_storefront'&&photoIds.has(job.refId));tables.Trip.delete(tripId);
      if(agentState.photos.some(photo=>photo.tripId===tripId)){agentRun++;setAgent({...blankAgent(),status:'error',error:{code:'data_changed',retryable:true}});}
      changed(['Trip','Shop','Photo','PhotoEmbedding','TrailPoint','Piece','QueueJob'],[tripId,...photoIds]);
    },
    async deletePhoto({id:photoId}) {
      check('store.deletePhoto');const photo=tables.Photo.get(photoId);if(!photo)return;
      tables.Photo.delete(photoId);tables.PhotoEmbedding.delete(photoId);assets.delete(photoId);
      for(const [key,piece] of tables.Piece)if(piece.photoId===photoId)tables.Piece.set(key,{...piece,photoId:null});
      const shop=tables.Shop.get(photo.shopId);if(shop?.storefrontPhotoId===photoId)tables.Shop.set(shop.id,{...shop,storefrontPhotoId:null,description:null,descriptionState:'none'});
      removeJobs(job=>job.kind==='describe_storefront'&&job.refId===photoId);
      if(agentState.photos.some(value=>value.id===photoId)){agentRun++;setAgent({...blankAgent(),status:'error',error:{code:'data_changed',retryable:true}});}
      changed(['Photo','PhotoEmbedding','Piece','Shop','QueueJob'],[photoId]);
    },
    async deletePiece({id:pieceId}) {check('store.deletePiece');const piece=tables.Piece.get(pieceId);if(!piece)return;tables.Piece.delete(pieceId);fixtures.release(piece.cutoutFile);removeJobs(job=>job.kind==='label_piece'&&job.refId===pieceId);reconcileSelection();changed(['Piece','QueueJob'],[pieceId]);},
    async deleteResult({id:resultId}) {check('store.deleteResult');const result=tables.Result.get(resultId);if(!result)return;tables.Result.delete(resultId);fixtures.release(result.file);fixtures.release(result.providerFile);releaseSnapshot(result.targetSnapshot);for(const value of result.companionSnapshots)releaseSnapshot(value);if(fittingState.result?.id===resultId)setFitting({...fittingState,result:null,phase:'idle'});changed(['Result'],[resultId]);},
    async enqueue({kind,refId}) {
      check('store.enqueue');let actualRef=refId;
      if(kind==='describe_storefront'&&tables.Shop.has(refId))actualRef=tables.Shop.get(refId)!.storefrontPhotoId??'';
      if((kind==='label_piece'&&!tables.Piece.has(actualRef))||(kind==='describe_storefront'&&!tables.Photo.has(actualRef)))throw deviceError('not_found','The job source is no longer available.',false);
      const job=enqueueLocal(kind,actualRef);
      if(kind==='describe_storefront'){const photo=tables.Photo.get(actualRef)!,shop=tables.Shop.get(photo.shopId);if(shop?.storefrontPhotoId===actualRef)tables.Shop.set(shop.id,{...shop,description:null,descriptionState:'pending'});}
      changed(['QueueJob','Shop'],[job.id,actualRef]);processFixtureJobs();return copy(job);
    },
    async nextJob({now:time}) {check('store.nextJob');return copy([...tables.QueueJob.values()].filter(job=>job.nextAt<=time).sort((a,b)=>a.nextAt-b.nextAt||a.id.localeCompare(b.id))[0]??null);},
    async beginJob({id:jobId,now:time}) {check('store.beginJob');const job=tables.QueueJob.get(jobId);if(!job)throw deviceError('not_found','The job is no longer available.',false);const attempts=job.attempts+1,updated={...job,attempts,nextAt:time+Math.min(300000,5000*2**Math.min(attempts-1,6))};tables.QueueJob.set(jobId,updated);changed(['QueueJob'],[jobId]);return copy(updated);},
    async completeJob({id:jobId,...values}) {check('store.completeJob');const job=tables.QueueJob.get(jobId);if(!job)return;completeLocal(job,values);changed(['QueueJob',job.kind==='label_piece'?'Piece':'Shop'],[jobId,job.refId]);},
    async failJob({id:jobId,retryable,retryAfterMs}) {check('store.failJob');const job=tables.QueueJob.get(jobId);if(!job)return;if(retryable)tables.QueueJob.set(jobId,{...job,nextAt:Math.max(job.nextAt,now()+(retryAfterMs??0))});else{tables.QueueJob.delete(jobId);if(job.kind==='describe_storefront'){const photo=tables.Photo.get(job.refId),shop=photo?tables.Shop.get(photo.shopId):null;if(shop?.storefrontPhotoId===photo?.id)tables.Shop.set(shop.id,{...shop,description:null,descriptionState:'failed'});}}changed(['QueueJob','Shop'],[jobId,job.refId]);},
    async discardTemp({file}) {fixtures.release(file);},
  };

  function locationFix():Fix {return {...fixtures.walkFixes[0],t:now()};}
  const shopping:Services['shopping']={
    addListener:shoppingEvents.addListener,
    async getState(){check('shopping.getState');return copy(session);},
    async start() {
      if(session.phase==='recording')return copy(session);
      try{check('shopping.start');}catch(cause){const error=asError(cause);session={...blankSession(),locationPermission:error.code==='location_permission_denied'?'denied':'granted'};emitSession();shoppingEvents.emit('error',{code:error.code==='location_permission_denied'||error.code==='location_disabled'?error.code:'service_unavailable',retryable:error.retryable});throw cause;}
      session={...blankSession(),phase:'starting'};emitSession();
      const fix=locationFix(),trip:Trip={id:id('trip'),startedAt:now(),endedAt:null,status:'recording'};
      const shop:Shop={id:id('shop'),tripId:trip.id,n:1,startedAt:trip.startedAt,spot:{lat:fix.lat,lng:fix.lng,accuracyM:fix.accuracyM},storefrontPhotoId:null,description:null,descriptionState:'none',note:null};
      tables.Trip.set(trip.id,trip);tables.Shop.set(shop.id,shop);tables.TrailPoint.set(`${trip.id}:${fix.t}`,{...fix,tripId:trip.id});
      session={...blankSession(),phase:'recording',trip,shop,latestFix:fix,notificationPermission:failure==='notification_unavailable'?'denied':'granted'};
      changed(['Trip','Shop','TrailPoint'],[trip.id,shop.id]);shoppingEvents.emit('location',fix);emitSession();
      if(failure==='notification_unavailable')shoppingEvents.emit('notice',{code:'notification_unavailable'});
      return copy(session);
    },
    async newShop() {
      check('shopping.newShop');if(session.phase!=='recording'||!session.trip)throw deviceError('not_recording','Shopping mode is off.',false);
      const fix=locationFix(),trip=session.trip,n=Math.max(0,...[...tables.Shop.values()].filter(shop=>shop.tripId===trip.id).map(shop=>shop.n))+1;
      const shop:Shop={id:id('shop'),tripId:trip.id,n,startedAt:now(),spot:{lat:fix.lat,lng:fix.lng,accuracyM:fix.accuracyM},storefrontPhotoId:null,description:null,descriptionState:'none',note:null};
      tables.Shop.set(shop.id,shop);tables.TrailPoint.set(`${trip.id}:${fix.t}`,{...fix,tripId:trip.id});session={...session,shop,photos:0,latestFix:fix};changed(['Shop','TrailPoint'],[shop.id]);shoppingEvents.emit('location',fix);emitSession();void paintPreview().catch(()=>captureEvents.emit('preview',{ready:false}));return copy(shop);
    },
    async stop() {
      check('shopping.stop');if(!session.trip||session.phase!=='recording')throw deviceError('not_recording','Shopping mode is off.',false);
      session={...session,phase:'stopping'};emitSession();const trip:Trip={...session.trip!,status:'ended',endedAt:Math.max(now(),session.trip!.startedAt)};tables.Trip.set(trip.id,trip);
      for(const [key,point] of tables.TrailPoint)if(point.tripId===trip.id)tables.TrailPoint.delete(key);
      session=blankSession();closePreview();changed(['Trip','TrailPoint'],[trip.id]);emitSession();return {trip:copy(trip)};
    },
    async openSettings(){check('shopping.openSettings');},
  };
  const capture:Services['capture']={
    addListener:captureEvents.addListener,
    async openPreview({purpose}) {
      check('capture.openPreview');if(purpose==='shopping'&&session.phase!=='recording')throw deviceError('not_recording','Shopping mode is off.',false);
      closePreview();const run=++previewRun,canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
      Object.assign(canvas.style,{position:'fixed',left:'0',top:'0',width:'100vw',height:'100vh',transformOrigin:'0 0',pointerEvents:'none',zIndex:'1',objectFit:'cover'});
      preview={purpose,canvas,rect:null};await paintPreview();if(run!==previewRun)throw deviceError('cancelled','The preview was closed.',false);document.body.append(canvas);captureEvents.emit('preview',{ready:true});
    },
    async setPreviewRect(rect) {
      check('capture.setPreviewRect');if(!preview)throw deviceError('preview_not_open','The preview is not open.',false);
      if(!Object.values(rect).every(Number.isFinite)||rect.width<0||rect.height<0)throw deviceError('invalid_argument','The preview rectangle is invalid.',false);
      preview.rect={...rect};preview.canvas.style.transform=`matrix(${rect.width/window.innerWidth},0,0,${rect.height/window.innerHeight},${rect.x},${rect.y})`;
    },
    async takePhoto({kind}) {
      check('capture.takePhoto');const current=preview,version=epoch;if(!current)throw deviceError('preview_not_open','The preview is not open.',false);
      if(current.purpose!=='shopping'&&kind!=='item')throw deviceError('invalid_argument','This capture purpose does not accept storefronts.',false);
      const image=captureImage(kind),asset=await fixtureAsset(image,current.purpose);assertLive(version);let photo:Photo|null=null;
      if(current.purpose==='shopping'){
        if(session.phase!=='recording'||!session.trip||!session.shop)throw deviceError('not_recording','Shopping mode is off.',false);
        const fix=locationFix();photo={id:asset.id,tripId:session.trip.id,shopId:session.shop.id,kind,takenAt:now(),location:{lat:fixtures.walkDestination.lat,lng:fixtures.walkDestination.lng,accuracyM:fix.accuracyM},file:asset.file,w:asset.w,h:asset.h,indexState:'done'};
        const source=captureSource(image,kind);assets.set(asset.id,{asset,image:source,purpose:'shopping'});sourceImages.set(asset.file,source);tables.Photo.set(photo.id,photo);
        const template=fixtures.store.photos.find(value=>value.image===source);if(template)tables.PhotoEmbedding.set(photo.id,{photoId:photo.id,model:'pe-core-t16-image',dim:512,vector:[...template.vector]});
        if(kind==='storefront'){const shop=tables.Shop.get(photo.shopId)!;if(shop.storefrontPhotoId)removeJobs(job=>job.kind==='describe_storefront'&&job.refId===shop.storefrontPhotoId);tables.Shop.set(shop.id,{...shop,storefrontPhotoId:photo.id,description:null,descriptionState:'pending'});enqueueLocal('describe_storefront',photo.id);}
        changed(['Photo','PhotoEmbedding','Shop','QueueJob'],[photo.id,photo.shopId]);processFixtureJobs();
      }
      counters.captures++;const captured={asset:copy(asset),photo:copy(photo)};captureEvents.emit('captured',captured);return captured;
    },
    async closePreview(){closePreview();},
  };
  async function rejectResultDownload():Promise<never> {counters.resultDownloadAttempts++;throw deviceError('result_download_disabled','Result download has not been approved.',false);}
  const media:Services['media']={
    addListener:mediaEvents.addListener,
    async pick({purpose}) {check('media.pick');const version=epoch,asset=await fixtureAsset(purpose==='self'?'images/self/positive/calibration-hat.png':'images/shops/shop-3-items.png',purpose);assertLive(version);counters.mediaPicks++;return {asset:copy(asset)};},
    async exportPhoto({photoId}) {check('media.exportPhoto');const photo=tables.Photo.get(photoId);if(!photo)throw deviceError('not_found','The photo is no longer available.',false);counters.photoExports++;const result={uri:photo.file};mediaEvents.emit('exported',{...result,sourceId:photoId});return result;},
    exportResult:rejectResultDownload,
    async discard({assetId}) {if(!tables.Photo.has(assetId))assets.delete(assetId);},
  };
  const segmenter:Services['segmenter']={
    addListener:segmentEvents.addListener,
    async prepare({asset}) {check('segmenter.prepare');const image=imageSource(asset),loaded=await fixtures.image(image),handle=id('segment');if(loaded.naturalWidth!==asset.w||loaded.naturalHeight!==asset.h)throw deviceError('invalid_argument','The source dimensions do not match.',false);segmentHandle={id:handle,asset:copy(asset),image};segmentEvents.emit('prepared',{handle,assetId:asset.id});return {handle,w:asset.w,h:asset.h};},
    async tap({handle,x,y}) {
      check('segmenter.tap');const current=segmentHandle;if(!current||current.id!==handle)throw deviceError('handle_expired','The segmentation handle is no longer available.',false);
      if(!Number.isFinite(x+y)||x<0||x>1||y<0||y>1)throw deviceError('invalid_argument','The tap must be inside the original image.',false);
      const candidates=fixtures.forImage(current.image);if(candidates.length<3)throw deviceError('inference_failed','No three fixture alternatives exist for this image.',false);
      const selected=[...candidates].sort((a,b)=>Math.hypot((a.bbox[0]+a.bbox[2]/2)/current.asset.w-x,(a.bbox[1]+a.bbox[3]/2)/current.asset.h-y)-Math.hypot((b.bbox[0]+b.bbox[2]/2)/current.asset.w-x,(b.bbox[1]+b.bbox[3]/2)/current.asset.h-y)).slice(0,3).sort((a,b)=>b.score-a.score);
      return {masks:await Promise.all(selected.map(mask=>fixtures.segMask(mask)))};
    },
    async person({handle}) {check('segmenter.person');if(!segmentHandle||segmentHandle.id!==handle)throw deviceError('handle_expired','The segmentation handle is no longer available.',false);throw deviceError('inference_failed','The item fixture adapter does not implement person inference.',false);},
    async release({handle}) {if(segmentHandle?.id===handle)segmentHandle=null;},
  };

  function agentEvent(type:string,stage:string|null,extra:Partial<AgentState['events'][number]>={}) {setAgent({...agentState,stage,events:[...agentState.events,{type,...extra}]});}
  const agent:Services['agent']={
    getState:()=>agentState,
    subscribe(listener){agentListeners.add(listener);return()=>{agentListeners.delete(listener);};},
    async submit(query) {
      if(!query.trim())return;const run=++agentRun,version=epoch;counters.queries++;
      setAgent({...blankAgent(),status:'running',runId:id('query'),query,stage:'thinking',events:[{type:'query_started'}]});
      try {
        check('agent.submit',true);agentEvent('tool_started','reading_visits',{toolName:'list_visits'});agentEvent('tool_completed','thinking',{toolName:'list_visits'});
        let photos=[...tables.Photo.values()].filter(photo=>photo.kind==='item');const normalized=query.toLowerCase();
        if(/saturday|last trip/.test(normalized))photos=photos.filter(photo=>fixtures.store.trips.some(trip=>trip.id===photo.tripId));
        if(/second shop|shop 2|vintage/.test(normalized)){
          const shops=[...tables.Shop.values()].filter(shop=>/vintage/.test(normalized)?shop.note?.toLowerCase().includes('vintage'):shop.n===2).sort((a,b)=>b.startedAt-a.startedAt);
          const selected=shops[0];photos=photos.filter(photo=>photo.shopId===selected?.id);
          if(selected)agentEvent('scope_narrowed','narrowing',{scope:{tripRef:selected.tripId,shopRef:selected.id,n:selected.n}});
        }
        agentEvent('tool_started','searching_photos',{toolName:'find_photos'});
        if(failure==='pending_index'||failure==='failed_index'||photos.some(photo=>photo.indexState!=='done'))throw deviceError('index_unavailable','The photo index is unavailable.');
        photos=photos.sort((a,b)=>b.takenAt-a.takenAt||a.id.localeCompare(b.id)).slice(0,3);agentEvent('tool_completed','thinking',{toolName:'find_photos'});
        if(!photos.length||failure==='not_found'||failure==='not-found'||failure==='turn_limit'||/yellow raincoat|striped coat/.test(normalized)){
          agentEvent('query_not_found',null);setAgent({...agentState,status:'not_found',stage:null,summary:"I couldn't find it within this search. Ask again or browse your trips."});return;
        }
        agentEvent('tool_started','outlining_items',{toolName:'extract_items'});
        const candidates:Candidate[]=[];
        if(failure!=='sam_empty'&&failure!=='sam-empty-tap')for(const photo of photos){const image=imageSource({id:photo.id,file:photo.file,w:photo.w,h:photo.h});for(const mask of fixtures.forImage(image))candidates.push(await fixtures.candidate(photo.id,'sam',mask,fixtures.concept));}
        assertLive(version);if(run!==agentRun)return;
        if(photos.some(photo=>!tables.Photo.has(photo.id)))throw deviceError('data_changed','A source photo was deleted.');
        candidates.sort((a,b)=>b.score-a.score||photos.findIndex(photo=>photo.id===a.photoId)-photos.findIndex(photo=>photo.id===b.photoId)||a.id.localeCompare(b.id));
        agentEvent('tool_completed','thinking',{toolName:'extract_items'});agentEvent('query_completed',null);
        setAgent({...agentState,status:'results',stage:null,photos:copy(photos),candidates,visibleCandidates:candidates.slice(0,3),concept:fixtures.concept,summary:fixtures.summary,stepsExpanded:false});
      }catch(cause){if(run!==agentRun||version!==epoch)return;const error=asError(cause);agentEvent('query_failed',null);setAgent({...agentState,status:'error',stage:null,error:{code:error.code,retryable:error.retryable},photos:[],candidates:[],visibleCandidates:[]});}
    },
    async startVoice() {
      ++agentRun;counters.voiceStarts++;
      try{check('voice.start',true);setAgent({...blankAgent(),status:'running',runId:id('voice'),stage:'listening',events:[{type:'voice_started'}]});}
      catch(cause){const error=asError(cause);setAgent({...blankAgent(),status:'error',error:{code:error.code,retryable:error.retryable},events:[{type:'query_failed'}]});}
    },
    async stopVoice() {
      if(agentState.stage!=='listening')return;
      agentEvent('voice_stopped','transcribing');counters.transcriptions++;
      try{check('voice.stop',true);if(failure==='voice_empty'||failure==='voice-empty'){setAgent({...blankAgent(),notice:"I didn't catch that. Try again."});return;}await agent.submit(fixtures.transcript);}
      catch(cause){const error=asError(cause);setAgent({...agentState,status:'error',stage:null,error:{code:error.code,retryable:error.retryable}});}
    },
    async cancel(){agentRun++;setAgent({...blankAgent(),events:[{type:'query_cancelled'}]});},
    setStepsExpanded(value){setAgent({...agentState,stepsExpanded:value});},
    setShowAll(value){setAgent({...agentState,showAll:value,visibleCandidates:value?agentState.candidates:agentState.candidates.slice(0,3)});},
  };

  const fitting:Services['fitting']={
    getSnapshot:()=>fittingState,
    subscribe(listener){fittingListeners.add(listener);return()=>{fittingListeners.delete(listener);};},
    async start(pieceId) {check('fitting.start');const piece=tables.Piece.get(pieceId);if(!piece||piece.origin!=='shop')throw deviceError('invalid_reference','The target must be a saved shop piece.',false);if(['preparing','sending','compositing','saving'].includes(fittingState.phase))throw deviceError('busy','A generation is already in progress.');setFitting({...fittingState,draft:{targetPieceId:pieceId,companionPieceIds:fittingState.draft.targetPieceId===pieceId?fittingState.draft.companionPieceIds.filter(value=>value!==pieceId):[]},phase:'idle',result:null,error:null});},
    async addCompanion(pieceId) {check('fitting.addCompanion');if(!fittingState.draft.targetPieceId||!tables.Piece.has(pieceId))throw deviceError('invalid_reference','Choose a saved target and companion.',false);if(pieceId===fittingState.draft.targetPieceId||fittingState.draft.companionPieceIds.includes(pieceId))throw deviceError('duplicate_piece','That piece is already selected.',false);if(fittingState.draft.companionPieceIds.length>=5)throw deviceError('too_many_pieces','Choose no more than five companions.',false);setFitting({...fittingState,draft:{...fittingState.draft,companionPieceIds:[...fittingState.draft.companionPieceIds,pieceId]},phase:'idle',error:null});},
    removeCompanion(pieceId){setFitting({...fittingState,draft:{...fittingState.draft,companionPieceIds:fittingState.draft.companionPieceIds.filter(value=>value!==pieceId)},phase:'idle',error:null});},
    async addTripCandidate(candidate) {if(fittingState.draft.companionPieceIds.length>=5)throw deviceError('too_many_pieces','Choose no more than five companions.',false);const piece=await store.saveCandidate({candidate,origin:'shop',labelMode:'describe'});await fitting.addCompanion(piece.id);return piece;},
    async registerSelf(asset) {
      const run=++fittingRun,version=epoch;setFitting({...fittingState,selfState:'registering',error:null});const files:string[]=[];
      try {
        check('fitting.registerSelf');const record=assets.get(asset.id);
        if(!record||record.purpose!=='self'||record.image!=='images/self/positive/calibration-hat.png')throw deviceError('invalid_argument','A selected full-body fixture is required.',false);
        if(maskFailure||failure==='mask'||failure==='masking_failure')throw deviceError('unsafe_boundary','The fixture masking failure is active.',false);
        const file=await fixtures.copyFile(record.asset.file);files.push(file);const headMask=await fixtures.copyFile('masks/head-drafts/calibration-hat.png');files.push(headMask);const maskedFile=await fixtures.copyFile('images/derived/calibration-hat-masked.png');files.push(maskedFile);
        assertLive(version);if(run!==fittingRun){for(const value of files)fixtures.release(value);return false;}
        const previous=selfPhoto;selfPhoto={file,headMask,maskedFile,updatedAt:Math.max(now(),(previous?.updatedAt??0)+1)};
        if(previous){fixtures.release(previous.file);fixtures.release(previous.headMask);fixtures.release(previous.maskedFile);}
        assets.delete(asset.id);setFitting({...fittingState,selfPhoto:copy(selfPhoto),selfState:'ready',phase:'idle',error:null});changed(['SelfPhoto'],[]);return true;
      }catch(cause){for(const value of files)fixtures.release(value);assets.delete(asset.id);if(run!==fittingRun||version!==epoch)return false;setFitting({...fittingState,selfPhoto:copy(selfPhoto),selfState:'failed',error:asError(cause)});return false;}
    },
    async generate() {
      counters.generations++;const run=++fittingRun,version=epoch;let draftId:string|null=null;
      try {
        if(['preparing','sending','compositing','saving'].includes(fittingState.phase))throw deviceError('busy','A generation is already in progress.');
        check('fitting.generate',true);if(fittingState.selfState!=='ready'||!selfPhoto||maskFailure)throw deviceError('unsafe_boundary','A safely registered replacement is required.',false);
        const target=fittingState.draft.targetPieceId;if(!target)throw deviceError('invalid_reference','Choose a saved shop target.',false);
        setFitting({...fittingState,phase:'preparing',error:null,result:null});const draft=await store.prepareResult({targetPieceId:target,companionPieceIds:[...fittingState.draft.companionPieceIds]});draftId=draft.draftId;
        if(run!==fittingRun||version!==epoch)return null;
        setFitting({...fittingState,phase:'sending'});
        // A fixture read is not a provider request or an assertion of privacy/model quality.
        const generated=fixtures.url(fixtures.generatedFile);await fixtures.image(generated);
        if(run!==fittingRun||version!==epoch)return null;
        setFitting({...fittingState,phase:'compositing'});setFitting({...fittingState,phase:'saving'});
        const result=await store.saveResult({draftId,file:generated,faceless:true,providerFile:generated});draftId=null;
        assertLive(version);if(run!==fittingRun){await store.deleteResult({id:result.id});return null;}setFitting({...fittingState,phase:'complete',result,error:null});return result;
      }catch(cause){if(run!==fittingRun||version!==epoch)return null;setFitting({...fittingState,phase:'failed',error:asError(cause)});return null;}
      finally{if(draftId)await store.discardResultDraft({draftId});}
    },
    cancel(){fittingRun++;setFitting({...fittingState,phase:'cancelled',selfState:fittingState.selfState==='registering'?(selfPhoto?'ready':'empty'):fittingState.selfState,error:null});},
    async restoreResult(result) {check('fitting.restoreResult');if(!await fitting.canChangePieces(result))throw deviceError('not_found','The original target piece is no longer saved.',false);setFitting({...fittingState,draft:{targetPieceId:result.targetPieceId,companionPieceIds:result.companionPieceIds.filter(pieceId=>tables.Piece.has(pieceId))},phase:'idle',result:null,error:null});},
    async canChangePieces(result) {check('fitting.canChangePieces');return tables.Piece.get(result.targetPieceId)?.origin==='shop';},
    exportResult:rejectResultDownload,
    async refresh(){check('fitting.refresh');reconcileSelection();setFitting({...fittingState,selfPhoto:copy(selfPhoto),selfState:fittingState.selfState==='failed'?'failed':selfPhoto?'ready':'empty'});},
  };

  function emitWalk(state:WalkState):WalkState {walkState=state;walkEvents.emit('state',state);return copy(state);}
  function walkFromMode(mode:WalkMode):WalkState {
    if(!walkState)throw deviceError('not_found','Walking guidance has not started.',false);
    const state=walkState,error=injection('walk.route');
    if(offline||mode==='offline')return emitWalk({...state,mode:'offline',errorCode:'offline',route:null,stepIndex:null,distanceM:null,durationS:null,bearingDeg:null});
    if(mode==='location_unavailable'||error?.code==='location_unavailable'||error?.code==='location_permission_denied')return emitWalk({...state,mode:'error',errorCode:error?.code??'location_unavailable',fix:null,route:null,distanceM:null,durationS:null,bearingDeg:null,stepIndex:null});
    if(mode==='error'||(error&&error.code!=='route_unavailable'))return emitWalk({...state,mode:'error',errorCode:error?.code??'upstream_timeout',route:null,distanceM:null,durationS:null,bearingDeg:null,stepIndex:null});
    const index=mode==='nearby'?5:mode==='direction'||mode==='route_unavailable'||error?.code==='route_unavailable'?2:0;
    const fixtureFix=fixtures.walkFixes[index],fix:Fix={...fixtureFix,lat:fixtureFix.lat+(state.destination.lat-fixtures.walkDestination.lat),lng:fixtureFix.lng+(state.destination.lng-fixtures.walkDestination.lng),t:now()};
    const route=copy(fixtures.route),deltaLat=state.destination.lat-fixtures.walkDestination.lat,deltaLng=state.destination.lng-fixtures.walkDestination.lng;
    route.geometry.coordinates=route.geometry.coordinates.map(([lng,lat])=>[lng+deltaLng,lat+deltaLat]);
    for(const step of route.steps)step.maneuver.location=[step.maneuver.location[0]+deltaLng,step.maneuver.location[1]+deltaLat];
    for(const waypoint of route.waypoints)waypoint.location=[waypoint.location[0]+deltaLng,waypoint.location[1]+deltaLat];
    const direction=mode==='direction'||mode==='nearby'||mode==='route_unavailable'||error?.code==='route_unavailable';
    return emitWalk({...state,mode:direction?(mode==='nearby'?'nearby':'direction'):'route',fix,route:direction?null:route,distanceM:direction?distance(fix,state.destination):route.distanceM,durationS:direction?null:route.durationS,bearingDeg:bearing(fix,state.destination),stepIndex:direction?null:0,errorCode:mode==='route_unavailable'||error?.code==='route_unavailable'?'route_unavailable':null,progressM:direction?Math.max(0,route.distanceM-distance(fix,state.destination)):0,stepDistanceM:direction?null:route.steps[0]?.distanceM??null,rerouting:false});
  }
  const walk:Services['walk']={
    addListener:walkEvents.addListener,
    async start(options) {
      assertLive();let destination:Point|null=null,label='',shop:ResultPieceSnapshot['shop']=null;
      if(options.source==='item'){const piece=tables.Piece.get(options.pieceId);if(!piece||piece.origin!=='shop')throw deviceError('destination_unavailable','The saved destination is unavailable.',false);destination=copy(piece.walkTo);label=piece.label;shop=shopInfo(piece);walkSource={source:'item',id:options.pieceId};}
      else{const result=tables.Result.get(options.resultId);if(!result)throw deviceError('destination_unavailable','The saved result destination is unavailable.',false);destination=copy(result.targetSnapshot.walkTo);label=result.targetSnapshot.label;shop=copy(result.targetSnapshot.shop);walkSource={source:'result',id:options.resultId};}
      if(!destination)throw deviceError('destination_unavailable','The saved photo location is unavailable.',false);
      emitWalk({mode:'loading',destination,distanceM:null,durationS:null,bearingDeg:null,stepIndex:null,route:null,fix:null,errorCode:null,rerouting:false,progressM:0,stepDistanceM:null,destinationInfo:{label,shop}});return walkFromMode(walkMode);
    },
    async retry(){assertLive();return walkFromMode(walkMode);},
    async confirmArrival(){assertLive();if(!walkState||walkState.mode!=='nearby'||offline||!walkState.fix||distance(walkState.fix,walkState.destination)>20||walkState.fix.accuracyM>30)throw deviceError('not_nearby','Confirm the shop only while nearby.',false);return emitWalk({...walkState,mode:'arrived',errorCode:null});},
    async stop(){walkState=null;walkSource=null;},
    getState:()=>walkState?copy(walkState):null,
  };
  const map=createMap(()=>injection('map.mount'));

  async function seedState() {
    for(const input of fixtures.store.trips)tables.Trip.set(input.id,{id:input.id,startedAt:Date.parse(input.startedAt),endedAt:input.endedAt?Date.parse(input.endedAt):null,status:input.status});
    for(const input of fixtures.store.shops)tables.Shop.set(input.id,{id:input.id,tripId:input.tripId,n:input.n,startedAt:Date.parse(input.startedAt),spot:{...input.spot,accuracyM:input.spot.accuracyM??5},storefrontPhotoId:null,description:input.description??null,descriptionState:input.descriptionState,note:input.note??null});
    for(const input of fixtures.store.photos){const asset=await fixtureAsset(input.image,'shopping',input.id);tables.Photo.set(input.id,{id:input.id,tripId:input.tripId,shopId:input.shopId,kind:'item',takenAt:Date.parse(input.takenAt),location:{...input.location,accuracyM:input.location.accuracyM??5},file:asset.file,w:asset.w,h:asset.h,indexState:input.indexState});tables.PhotoEmbedding.set(input.id,{photoId:input.id,model:'pe-core-t16-image',dim:512,vector:[...input.vector]});}
    const photos=[...tables.Photo.values()],first=photos[0],second=photos.find(photo=>photo.shopId!==first.shopId)!;let targetId:string|null=null;
    for(const photo of [first,second])for(const mask of fixtures.forImage(sourceImages.get(photo.file)!).slice(0,photo===first?4:2)){
      const candidate=await fixtures.candidate(photo.id,'sam',mask,fixtures.concept),piece=await store.saveCandidate({candidate,origin:'shop',labelMode:'concept'});targetId??=piece.id;
    }
    for(const kind of ['jeans','shoes'] as const){const mask=await fixtures.wardrobe(kind),candidate=await fixtures.candidate(`seed-${kind}`,'edgetam',mask,'Picked item');const piece:Piece={id:`piece:${candidate.id}`,origin:'wardrobe',label:kind==='jeans'?'Jeans':'Shoes',category:kind,cutoutFile:await fixtures.cutout(mask),createdAt:now(),photoId:null,shopId:null,tripId:null,walkTo:null};tables.Piece.set(piece.id,piece);}
    const asset=await fixtureAsset('images/self/positive/calibration-hat.png','self');await fitting.registerSelf(asset);
    if(targetId){await fitting.start(targetId);const draft=await store.prepareResult({targetPieceId:targetId,companionPieceIds:[]});await store.saveResult({draftId:draft.draftId,file:fixtures.url(fixtures.generatedFile),providerFile:fixtures.url(fixtures.generatedFile),faceless:true});}
  }
  const controls:UiAdapterControls={
    async reset({seed=false}={}) {
      epoch++;agentRun++;fittingRun++;failure=null;maskFailure=false;walkMode='route';walkState=null;walkSource=null;segmentHandle=null;closePreview();
      fixtures.releaseOwned();for(const entity of entities)tables[entity].clear();assets.clear();sourceImages.clear();drafts.clear();pendingSaves.clear();selfPhoto=null;sequence=0;counters=blankCounters();session=blankSession();setAgent(blankAgent());setFitting(blankFitting());controls.setOffline(false);
      if(seed)await seedState();counters=blankCounters();changed([...entities,'SelfPhoto'],[]);emitSession();window.dispatchEvent(new Event('sf-ui-reset'));
    },
    setFailure(value){failure=value?.toLowerCase().replaceAll(' ','_')??null;changed([...entities,'SelfPhoto'],[]);if(walkState&&walkState.mode!=='arrived')walkFromMode(walkMode);if(!failure)processFixtureJobs();},
    setOffline(value){offline=value;window.dispatchEvent(new Event(value?'offline':'online'));if(walkState&&walkState.mode!=='arrived'&&value)walkFromMode(walkMode);if(!value)processFixtureJobs();},
    setMaskFailure(value){maskFailure=value;},
    setWalkMode(mode){if(!['route','direction','nearby','offline','error','location_unavailable','route_unavailable'].includes(mode))throw deviceError('invalid_argument','Arrival must be confirmed by the user.',false);walkMode=mode;if(walkState&&walkState.mode!=='arrived')walkFromMode(mode);},
    async emitDeepLink(url) {if(url!=='streetfitting://home'&&url!=='streetfitting://capture'&&url!=='streetfitting://capture?newShop=1')throw deviceError('invalid_argument','The deep link is not supported.',false);counters.deepLinks++;if(session.phase!=='recording'&&url!=='streetfitting://home'){shoppingEvents.emit('open',{url:'streetfitting://home'});return;}if(url==='streetfitting://capture?newShop=1')await shopping.newShop();shoppingEvents.emit('open',{url});},
    visit(route){window.dispatchEvent(new CustomEvent<Route>('sf-ui-visit',{detail:copy(route)}));},
    inspect() {
      const pieces=[...tables.Piece.values()];
      return {generations:counters.generations,rawSelfUploads:0,resultDownloads:0,counters:copy(counters),fixtureProvenance:'s11-unreviewed-synthetic',offline,failure,maskFailure,ids:{trips:[...tables.Trip.keys()],shops:[...tables.Shop.keys()],photos:[...tables.Photo.keys()],pieces:pieces.map(piece=>piece.id),shopPieces:pieces.filter(piece=>piece.origin==='shop').map(piece=>piece.id),wardrobePieces:pieces.filter(piece=>piece.origin==='wardrobe').map(piece=>piece.id),results:[...tables.Result.keys()]},session:{phase:session.phase,tripId:session.trip?.id??null,shopId:session.shop?.id??null,photos:session.photos},fitting:{targetPieceId:fittingState.draft.targetPieceId,companionPieceIds:[...fittingState.draft.companionPieceIds],resultId:fittingState.result?.id??null,phase:fittingState.phase,selfState:fittingState.selfState,selfUpdatedAt:selfPhoto?.updatedAt??null},agent:{status:agentState.status,runId:agentState.runId,candidateIds:agentState.candidates.map(candidate=>candidate.id),photoIds:agentState.photos.map(photo=>photo.id)},walk:walkState&&walkSource?{mode:walkState.mode,source:walkSource.source,sourceId:walkSource.id}:null,preview:{open:!!preview,purpose:preview?.purpose??null}};
    },
  };
  window.__sfUi=controls;
  const services:Services={store,shopping,capture,media,segmenter,agent,fitting,walk,map,stop(){stopped=true;epoch++;agentRun++;fittingRun++;closePreview();void map.unmount();fixtures.stop();storeEvents.clear();shoppingEvents.clear();captureEvents.clear();mediaEvents.clear();segmentEvents.clear();walkEvents.clear();fittingListeners.clear();agentListeners.clear();if(window.__sfUi===controls)delete window.__sfUi;if(onlineDescriptor)Object.defineProperty(navigator,'onLine',onlineDescriptor);else Reflect.deleteProperty(navigator,'onLine');}};
  return services;
}

function createMap(getFailure:()=>DeviceError|null):MapView {
  const events=createEvents<{ready:unknown;error:unknown}>();let host:HTMLElement|null=null,svg:SVGSVGElement|null=null;
  function checkMap(){const failure=getFailure();if(failure){events.emit('error',{code:failure.code});throw deviceError(failure.code,failure.message,failure.retryable);}}
  function node<K extends keyof SVGElementTagNameMap>(tag:K,attributes:Record<string,string>):SVGElementTagNameMap[K] {const element=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [name,value]of Object.entries(attributes))element.setAttribute(name,value);return element;}
  return {
    addListener:events.addListener,
    async mount({element}) {checkMap();if(host&&host!==element)svg?.remove();host=element;svg?.remove();svg=node('svg',{viewBox:'0 0 400 400',width:'100%',height:'100%',role:'img','aria-label':'Walking route and saved photo spot'});svg.style.display='block';host.append(svg);events.emit('ready',{});},
    async update({fix,destination,route,progressM=0}) {
      checkMap();if(!svg||!host)throw deviceError('map_unavailable','The map is not mounted.');
      const points=[destination,...(fix?[fix]:[]),...(route?.geometry.coordinates.map(([lng,lat])=>({lat,lng}))??[])];
      const minLat=Math.min(...points.map(point=>point.lat)),maxLat=Math.max(...points.map(point=>point.lat)),minLng=Math.min(...points.map(point=>point.lng)),maxLng=Math.max(...points.map(point=>point.lng));
      const latRange=Math.max(maxLat-minLat,0.0005),lngRange=Math.max(maxLng-minLng,0.0005),centerLat=(minLat+maxLat)/2,centerLng=(minLng+maxLng)/2;
      const project=(point:Point)=>[200+(point.lng-centerLng)/lngRange*280,200-(point.lat-centerLat)/latRange*280];
      const children:SVGElement[]=[];for(const position of [60,130,200,270,340]){children.push(node('path',{d:`M ${position} 0 V 400 M 0 ${position} H 400`,fill:'none',stroke:'currentColor','stroke-opacity':'0.1','stroke-width':'8'}));}
      if(route){const path=route.geometry.coordinates.map(([lng,lat])=>project({lat,lng}).join(',')).join(' ');children.push(node('polyline',{points:path,fill:'none',stroke:'currentColor','stroke-width':'5','stroke-linejoin':'round'}));if(progressM>0)children.push(node('polyline',{points:path,fill:'none',stroke:'currentColor','stroke-opacity':'0.4','stroke-width':'7','stroke-dasharray':'4 8'}));}
      const [x,y]=project(destination);children.push(node('circle',{cx:String(x),cy:String(y),r:'26',fill:'currentColor','fill-opacity':'0.12'}),node('circle',{cx:String(x),cy:String(y),r:'8',fill:'currentColor'}));
      if(fix){const [fx,fy]=project(fix);children.push(node('circle',{cx:String(fx),cy:String(fy),r:'10',fill:'none',stroke:'currentColor','stroke-width':'4'}));}
      const title=node('title',{});title.textContent='Saved photo spot and walking route';children.unshift(title);svg.replaceChildren(...children);
    },
    async unmount(){svg?.remove();svg=null;host=null;},
  };
}
