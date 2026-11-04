import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {check,fixture,gpx,json,list,native,stage,removeStaged,until,adb,screenshot,root,fix} from './android.mjs';
import {inspect,click,route,home,startShopping,shoppingFix,prepare,confirm} from './scenarios.mjs';

function observeQuery(page) {
  const value={calls:[],context:null,turns:0,samPhotos:0,latencies:[],failures:[]};const pending=[];const starts=new Map();
  const request=req=>{
    const endpoint=new URL(req.url()).pathname;
    if(!['/v1/search/turn','/v1/search/segment'].includes(endpoint))return;
    starts.set(req,performance.now());
    try {
      const body=req.postDataJSON();
      if(endpoint.endsWith('/turn')){value.turns++;if(body.context)value.context={now:body.context.now,timeZone:body.context.timeZone};}
      else value.samPhotos+=body.photos.length;
    } catch {value.failures.push('request_observation_failed');}
  };
  const response=res=>{
    if(new URL(res.url()).pathname!=='/v1/search/turn')return;
    pending.push((async()=>{
      try {
        const body=await res.json();
        for(const call of body.toolCalls||[]){
          const args=call.arguments||{};
          // No query text, note, token, vector or image bytes leave this callback.
          value.calls.push({name:call.name,...Object.fromEntries(['shopRefs','timeFrom','timeTo','from','to'].filter(k=>k in args).map(k=>[k,args[k]]))});
        }
      }catch{value.failures.push('response_observation_failed');}
    })());
  };
  const finished=req=>{if(starts.has(req))value.latencies.push({endpoint:new URL(req.url()).pathname,elapsedMs:Math.round(performance.now()-starts.get(req))});};
  page.on('request',request);page.on('response',response);page.on('requestfinished',finished);
  return async()=>{await Promise.all(pending);page.off('request',request);page.off('response',response);page.off('requestfinished',finished);return value;};
}

async function maskIou(page,actual,groundTruth) {
  const gt=await stage(groundTruth);
  try{return await page.evaluate(async({actual,gt})=>{
    async function pixels(file){const image=new Image();image.src=window.Capacitor.convertFileSrc(file);await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return {w:canvas.width,h:canvas.height,rgba:ctx.getImageData(0,0,canvas.width,canvas.height).data};}
    const a=await pixels(actual),b=await pixels(gt);if(a.w!==b.w||a.h!==b.h)throw Error('sam_gt_dimensions_differ');let intersection=0,union=0,foreground=0;
    for(let i=0;i<a.rgba.length;i+=4){const ap=a.rgba[i]!==0&&a.rgba[i+3]!==0,bp=b.rgba[i]!==0&&b.rgba[i+3]!==0;if(ap&&bp)intersection++;if(ap||bp)union++;if(ap)foreground++;}
    if(!union||!foreground)throw Error('sam_empty_mask');return {iou:intersection/union,intersection,union,foreground,width:a.w,height:a.h};
  },{actual,gt});}finally{await removeStaged(gt);}
}

async function locationRequestConfiguration() {
  const source='app/android/app/src/main/java/com/streetfitting/app/plugins/shopping/ShoppingService.java';
  const text=await readFile(path.join(root,source),'utf8');
  const match=text.match(/new\s+LocationRequest\.Builder\(\s*Priority\.PRIORITY_HIGH_ACCURACY\s*,\s*(\d+)\s*\)\s*\.setMinUpdateIntervalMillis\(\s*(\d+)\s*\)\s*\.setMaxUpdateDelayMillis\(\s*(\d+)\s*\)/);
  check(match,'location_request_configuration_unrecognized');
  return {intervalMs:Number(match[1]),minUpdateIntervalMs:Number(match[2]),maxUpdateDelayMs:Number(match[3]),source,scope:'native source configuration, not observed OS scheduling'};
}

/** Standalone component evidence is not full research/live/privacy acceptance. */
export async function hourForeground(context) {
  const {page,options}=context;const point=(await gpx('shopping-three-shops'))[0];
  const requestedLocation=await locationRequestConfiguration();
  await home(page);await fix(point);const session=await startShopping(page);
  const samples=[];const fixTimes=new Set();let error;
  try {
    const initial=await shoppingFix(page,point);
    let previousFixTime=initial.latestFix.t;
    let previousTrailCount=(await list(page,'TrailPoint',{tripId:session.trip.id})).length;
    await adb('shell','input','keyevent','KEYCODE_HOME');
    const start=performance.now();
    for(;;){
      const state=await shoppingFix(page,point);
      check(state.phase==='recording'&&state.trip.id===session.trip.id,'fgs_session_not_retained');
      check(state.latestFix.t>previousFixTime,'fgs_fix_not_advancing');
      check((await list(page,'Shop',{tripId:session.trip.id})).length===1,'gps_created_automatic_shop');
      const services=(await adb('shell','dumpsys','activity','services','com.streetfitting.app')).toString();
      check(/isForeground=true/.test(services),'foreground_service_not_observed');
      const trail=await list(page,'TrailPoint',{tripId:session.trip.id});
      check(trail.length>previousTrailCount&&trail.some(value=>value.t===state.latestFix.t),'fgs_trail_not_advancing');
      for(const value of trail){check(Number.isFinite(value.t),'fgs_trail_timestamp_invalid');fixTimes.add(value.t);}
      samples.push({elapsedMs:Math.round(performance.now()-start),phase:state.phase,foreground:true,trailCount:trail.length,newTrailPoints:trail.length-previousTrailCount,latestFixAdvanceMs:state.latestFix.t-previousFixTime});
      previousFixTime=state.latestFix.t;previousTrailCount=trail.length;
      await writeFile(path.join(options.output,'fgs-progress.json'),JSON.stringify({scope:'emulator liveness, not physical battery',requestedLocation,samples},null,2));
      // Observe another fresh fix at/after the full hour, not merely a sleep ending at the deadline.
      const remaining=3600000-(performance.now()-start);if(remaining<=0)break;
      await new Promise(resolve=>setTimeout(resolve,Math.min(30000,remaining)));
    }
  }catch(cause){error=cause;}
  finally{
    try{
      const state=await native(page,'ShoppingSession','getState');
      if(state.phase==='recording'&&state.trip.id===session.trip.id){await home(page);await confirm(page,'End shopping');}
    }catch(cause){error??=cause;}
  }
  if(error)throw error;
  check((await list(page,'TrailPoint',{tripId:session.trip.id})).length===0,'fgs_end_retains_raw_trail');
  const times=[...fixTimes].sort((a,b)=>a-b);const intervals=times.slice(1).map((time,i)=>time-times[i]);
  check(samples.length>=2&&samples.at(-1).elapsedMs>=3600000&&intervals.length>0,'fgs_location_samples_missing');
  return {durationMs:samples.at(-1).elapsedMs,samples,requestedLocation,observedFixIntervalsMs:intervals,scope:'one-hour emulator FGS/location retention; not battery drain'};
}

export async function research(context) {
  const {page,options}=context;await prepare(context);
  const review=await json(path.join(fixture,'review/search.json'));const seed=options.seed;
  check(seed?.dataset==='search'&&seed.actualIdsGenerated&&seed.syntheticEmbeddingsCommitted===0,'research_native_seed_missing');
  await until(()=>list(page,'Photo'),rows=>rows.length===seed.photos&&rows.every(p=>p.kind!=='item'||p.indexState==='done'),'research_native_index_incomplete',240000);
  await until(()=>list(page,'Shop'),rows=>review.storefronts.every(item=>rows.some(shop=>shop.id===seed.shopIds[item.shopId]&&shop.descriptionState==='done')),'research_storefront_descriptions_incomplete',240000);
  const embeddings=await list(page,'PhotoEmbedding');const photos=await list(page,'Photo');
  check(photos.filter(p=>p.kind==='item').every(p=>embeddings.some(e=>e.photoId===p.id&&e.dim===512&&e.vector.length===512)),'research_real_embeddings_missing');
  const rows=[];
  for(const item of review.cases){
    await home(page);await click(page,'Find it');await route(page,'ask');
    const stop=observeQuery(page);const started=performance.now();let snapshot,observed;
    try {
      await page.getByRole('searchbox',{name:'Describe the item'}).fill(item.query);await click(page,'Find');
      snapshot=await until(()=>inspect(page),s=>['results','not_found','error'].includes(s.agent.status),'research_query_did_not_settle',300000);
    } finally {observed=await stop();}
    const state=snapshot.agent;check(!observed.failures.length&&observed.context&&observed.turns<=4&&observed.samPhotos<=3,'research_query_observation_or_budget_failed');
    check(state.status===item.expectedStatus,'research_semantic_status_wrong');
    const wanted=new Set(item.relevantPhotoIds.map(id=>seed.photoIds[id]));check(!wanted.has(undefined),'research_gt_photo_not_seeded');
    const ids=state.photoIds;check(Array.isArray(ids),'research_photo_ids_not_observable');const hit1=wanted.has(ids[0]);const hit3=ids.slice(0,3).some(id=>wanted.has(id));
    const scopes=state.events.filter(e=>e.type==='scope_narrowed').map(e=>e.scope?.shopId).filter(Boolean);
    if(item.expectedShopIds){const expected=item.expectedShopIds.map(id=>seed.shopIds[id]);check(expected.every(Boolean)&&scopes.length>0&&scopes.every(id=>expected.includes(id)),'research_shop_scope_wrong');}
    const masks=[];
    for(const candidate of state.candidates){
      const originalId=Object.keys(seed.photoIds).find(id=>seed.photoIds[id]===candidate.photoId);const gt=item.maskGroundTruth?.[originalId];
      check(gt,'research_candidate_has_no_human_mask_gt');
      const metrics=await maskIou(page,candidate.mask,gt);
      masks.push({photoFixtureId:originalId,score:candidate.score,bbox:candidate.bbox,...metrics});
    }
    check(state.visibleCandidates.length===Math.min(3,state.candidates.length),'research_candidate_filter_or_visibility');
    if(state.candidates.length>3){await click(page,/Show all/);const all=(await inspect(page)).agent;check(all.visibleCandidates.length===all.candidates.length,'research_show_all_dropped_candidates');}
    const row={id:item.id,status:state.status,elapsedMs:Math.round(performance.now()-started),hit1,hit3,relevantCount:wanted.size,returnedPhotoFixtureIds:ids.map(id=>Object.keys(seed.photoIds).find(key=>seed.photoIds[key]===id)),candidateCount:state.candidates.length,masks,observed};
    rows.push(row);await writeFile(path.join(options.output,'research-progress.json'),JSON.stringify({queries:rows},null,2));await screenshot(options.output,'research-'+item.id);
  }
  const foreground=await hourForeground(context);
  return {status:'passed',queries:rows,foreground,photosIndexed:embeddings.length,semanticFixtureOnly:true,unverified:['real-store hit rate','physical-device battery drain','physical destination rediscovery']};
}
