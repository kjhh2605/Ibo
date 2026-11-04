import {writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {adb,check,deepLink,fix,fixture,gpx,json,launch,list,native,notification,permissions,readPrivate,replay,screenshot,swipeTask,until} from './android.mjs';
import {installPhaseHeaders,phaseProof} from './phases.mjs';

async function inspect(page) {
  return page.evaluate(() => {
    if (!window.__sfVerification?.inspect) throw new Error('verification_observer_unavailable');
    return window.__sfVerification.inspect();
  });
}
async function click(page,name,scope=page) {await scope.getByRole('button',{name,exact:typeof name==='string'}).first().click();}
async function route(page,name) {await page.locator(`[data-route="${name}"]`).waitFor({state:'visible'});}
async function confirm(page,name) {await click(page,name);await click(page,name,page.getByRole('dialog'));}
// A searched piece is not sorted yet; Try it on then asks for its mannequin slot.
async function tryItOn(page,slot='outer') {await click(page,'Try it on');const sort=page.getByRole('button',{name:`Wear as ${slot}`,exact:true});if(await sort.waitFor({timeout:3000}).then(()=>true,()=>false))await sort.click();await route(page,'outfit');}
async function home(page) {await deepLink('streetfitting://home');await route(page,'home');}
async function openTrip(page,id) {
  const trips=(await list(page,'Trip')).sort((a,b)=>b.startedAt-a.startedAt);
  const labels=await page.evaluate(values=>values.map(t=>new Date(t.startedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})),trips.map(t=>({startedAt:t.startedAt})));
  const index=trips.findIndex(t=>t.id===id);check(index>=0,'trip_to_open_missing');
  const occurrence=labels.slice(0,index).filter(label=>label===labels[index]).length;
  await page.locator('[data-route="trips"]').getByRole('button',{name:labels[index],exact:true}).nth(occurrence).click();await route(page,'trip');
}
async function openResult(page,id) {
  await home(page);await click(page,'Try-ons');await route(page,'results');
  const rows=(await list(page,'Result')).sort((a,b)=>b.createdAt-a.createdAt);const index=rows.findIndex(r=>r.id===id);check(index>=0,'result_to_open_missing');
  const label=rows[index].targetSnapshot.label;const occurrence=rows.slice(0,index).filter(r=>r.targetSnapshot.label===label).length;
  await page.getByRole('button',{name:`Open look with ${label}`,exact:true}).nth(occurrence).click();await route(page,'result');
}
async function absentPrivate(file) {
  const local=file.replace(/^file:\/\//,'');
  const prefix=['/data/user/0/com.streetfitting.app/','/data/data/com.streetfitting.app/'].find(value=>local.startsWith(value));
  check(prefix&&!local.includes('..'),'deletion_check_outside_app');
  const result=await adb('shell','run-as','com.streetfitting.app','sh','-c',`'if [ -e "${local.slice(prefix.length)}" ]; then echo present; else echo absent; fi'`);
  check(result.toString().trim()==='absent','deleted_private_file_retained');
}
function observeVoice(page) {
  let transcript=null,query=null,transcriptions=0,turns=0;const pending=[];
  const response=res=>{
    if(new URL(res.url()).pathname!=='/v1/transcribe')return;
    transcriptions++;pending.push(res.json().then(body=>{transcript=body.text;}));
  };
  const request=req=>{
    if(new URL(req.url()).pathname==='/v1/search/turn'){turns++;if(query===null)query=req.postDataJSON().query;}
  };
  page.on('response',response);page.on('request',request);
  return async()=>{
    try{await Promise.all(pending);check(transcriptions===1&&typeof transcript==='string'&&transcript.trim()&&query===transcript&&turns>0&&turns<=4,'voice_not_verbatim_single_transcription');return {transcriptions,searchTurns:turns,verbatim:true};}
    finally{page.off('response',response);page.off('request',request);}
  };
}
async function offline(page,value) {
  await adb('shell','svc','wifi',value?'disable':'enable');
  await adb('shell','svc','data',value?'disable':'enable');
  await until(()=>page.evaluate(()=>navigator.onLine),online=>online!==value,'network_state_not_observed');
}
async function captureSource(page,relative,name) {
  check(/^[a-z0-9-]+$/.test(name),'invalid_capture_case');
  const active=await page.locator('[data-route="capture"]').count()>0;
  if(active)await home(page);
  const remote='files/capture-cases/'+name;
  const temporary='/data/local/tmp/sf-e2e-'+randomUUID()+'.png';
  try {
    await adb('push',path.join(fixture,relative),temporary);
    await adb('shell','run-as','com.streetfitting.app','mkdir','-p',remote);
    await adb('shell','run-as','com.streetfitting.app','cp',temporary,remote+'/01.png');
  }finally{await adb('shell','rm','-f',temporary);}
  await launch('capture-cases/'+name);
  if(active){await click(page,'Take photo');await route(page,'capture');}
}
async function startShopping(page) {
  await click(page,'Start shopping');
  const deadline=performance.now()+90000;
  while(performance.now()<deadline){
    const state=await native(page,'ShoppingSession','getState');
    if(state.phase==='recording'){await route(page,'capture');return state;}
    if(state.phase==='requesting_location'||state.phase==='requesting_notification')await permissions(true);
    else await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw new Error('shopping_start_timeout');
}
async function shoppingFix(page,point) {
  const previous=(await native(page,'ShoppingSession','getState')).latestFix?.t??-Infinity;
  await fix(point);
  return until(()=>native(page,'ShoppingSession','getState'),s=>{
    const current=s.latestFix;
    if(!current||!Number.isFinite(current.t)||!(current.t>previous))return false;
    const radians=Math.PI/180;
    const a=Math.sin((current.lat-point.lat)*radians/2)**2+Math.cos(point.lat*radians)*Math.cos(current.lat*radians)*Math.sin((current.lng-point.lng)*radians/2)**2;
    const distanceM=6371008.8*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    // Emulator/FLP output was observed submeter away from the injected target.
    // This 1m target-identity bound is not a product accuracy or freshness policy.
    return distanceM<=1;
  },'injected_fix_not_received');
}
async function priorTrip(context,points) {
  const {page}=context;
  check((await list(page,'Trip')).length===0,'prior_trip_prep_requires_empty_database');
  await fix(points[0]);await home(page);await captureSource(page,'images/shops/shop-1-items.png','e2e-prior-one');
  const session=await startShopping(page);
  await click(page,'Take photo');await until(()=>list(page,'Photo',{tripId:session.trip.id}),rows=>rows.length===1,'prior_first_photo_missing');
  await shoppingFix(page,points[3]);await click(page,'New shop');
  await captureSource(page,'images/shops/shop-2-items.png','e2e-prior-two');await click(page,'Take photo');
  await until(()=>list(page,'Photo',{tripId:session.trip.id}),rows=>rows.length===2,'prior_second_photo_missing');
  await confirm(page,'End shopping');await route(page,'home');
  check((await list(page,'TrailPoint',{tripId:session.trip.id})).length===0,'prior_trip_retains_trail');
  await launch('capture-fixtures');
}
async function chooseArea(page,point={x:0.5,y:0.5}) {
  const target=page.getByRole('button',{name:/^Tap the item in the photo/});
  const box=await target.boundingBox();check(box,'tap_surface_missing');
  await target.click({position:{x:box.width*point.x,y:box.height*point.y}});
  await click(page,/^1\./);
}
async function snapshotFiles(result) {
  const paths=[result.file,result.providerFile,...[result.targetSnapshot,...result.companionSnapshots].flatMap(p=>[p.cutoutFile,p.shop?.storefrontFile]).filter(Boolean)];
  return Promise.all(paths.map(async file=>createHash('sha256').update(await readPrivate(file)).digest('hex')));
}
async function identities(context) {
  const {page}=context;
  context.identities??={rawSelfPixelHashes:[],headMaskSha256:[],maskedSelfPixelHashes:[],cutoutPixelHashes:[]};
  const pixelHash=file=>page.evaluate(async file=>{
    const image=new Image();image.src=window.Capacitor.convertFileSrc(file);await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const prefix=new TextEncoder().encode(`(${canvas.width}, ${canvas.height})`);
    const bytes=new Uint8Array(prefix.length+pixels.length);bytes.set(prefix);bytes.set(pixels,prefix.length);
    return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  },file);
  const self=await native(page,'Store','getSelfPhoto');
  if(self){
    context.identities.rawSelfPixelHashes.push(await pixelHash(self.file));
    context.identities.maskedSelfPixelHashes.push(await pixelHash(self.maskedFile));
    context.identities.headMaskSha256.push(createHash('sha256').update(await readPrivate(self.headMask)).digest('hex'));
  }
  for(const piece of await list(page,'Piece'))context.identities.cutoutPixelHashes.push(await pixelHash(piece.cutoutFile));
  for(const key of Object.keys(context.identities))context.identities[key]=[...new Set(context.identities[key])];
  const output=process.env.SF_PRIVACY_IDENTITIES;
  check(output,'privacy_identity_output_not_configured');
  const temporary=output+'.next';
  await writeFile(temporary,JSON.stringify(context.identities));await rename(temporary,output);
}
async function checkpoint(context,step,assertions) {
  const {page,options}=context;
  await identities(context);
  const text=await page.locator('body').innerText();
  check(!/\bDemo\b|Walk a step|Go off route|mock mode|dev badge/i.test(text),'development_controls_visible');
  check(await page.getByRole('button',{name:/Save look to gallery|Download result|Regenerate|Look\/Original/}).count()===0,'forbidden_result_control');
  const name=`${String(step).padStart(2,'0')}-${context.steps?.length??0}-screen`;
  await screenshot(options.output,name);
  context.steps??=[];context.steps.push({step,assertions,passed:true,screenshot:name+'.png'});
}
async function prepare(context) {
  const {page,options}=context;
  await page.waitForFunction(()=>typeof window.__sfVerification?.inspect==='function');
  const state=await inspect(page);
  check(state.mode===options.mode,'app_relay_mode_mismatch');
  check(state.relayBaseUrl===`http://10.0.2.2:${process.env.RELAY_PORT||'8787'}`,'app_relay_origin_mismatch');
  check(state.resultDownload===false,'result_download_must_be_off');
  check(state.transport&&state.transport.scope==='relay-attempts/shared-file-reads/media-export-attempts','genuine_transport_observer_required');
  check((await native(page,'Store','getRuntimeInfo')).debug===true,'native_debug_proof_required');
  await installPhaseHeaders(context);
  check((await adb('shell','getconf','PAGE_SIZE')).toString().trim()==='16384','device_page_size_not_16k');
  check((await adb('shell','getprop','ro.build.version.sdk')).toString().trim()==='37','device_api_not_37');
  const webgl=await page.evaluate(()=>{
    const gl=document.createElement('canvas').getContext('webgl');
    const gl2=document.createElement('canvas').getContext('webgl2');
    return {webgl:!!gl,webgl2:!!gl2,renderer:gl?.getParameter(gl.RENDERER)||null};
  });
  check(webgl.webgl&&webgl.webgl2,'map_webgl_unavailable');
  context.webgl=webgl;
  await checkpoint(context,0,['native-runtime','relay-mode','download-off','webgl','page-size']);
}
async function addWardrobe(context) {
  const {page}=context;
  await home(page);await click(page,'Wardrobe');await route(page,'wardrobe');
  await captureSource(page,'images/wardrobe/jeans-original.png','e2e-wardrobe');
  await click(page,'Add a piece');await click(page,'Take a photo');await route(page,'capture');
  await click(page,'Take photo');await route(page,'pick');await chooseArea(page);await click(page,'Add to wardrobe');await route(page,'wardrobe');
  const pieces=await until(()=>list(page,'Piece',{origin:'wardrobe'}),rows=>rows.length===1,'wardrobe_piece_not_saved');
  return pieces[0];
}
async function selfPhoto(context) {
  const {page}=context;
  const cases=await json(path.join(fixture,'review/head.json'));
  const positive=cases.cases.find(c=>c.expectedRegistration&&c.status==='human-approved');
  check(positive,'approved_positive_self_missing');
  await captureSource(page,positive.image,'e2e-self');
  await click(page,'Add your photo');await click(page,'Take a photo');await route(page,'capture');
  await click(page,'Use this photo');await route(page,'outfit');
  const self=await native(page,'Store','getSelfPhoto');check(self?.maskedFile,'self_not_registered');
  // A failed replacement must preserve the accepted singleton.
  const negative=cases.cases.find(c=>!c.expectedRegistration&&c.status==='human-approved');
  check(negative,'approved_negative_self_missing');
  await captureSource(page,negative.image,'e2e-self-negative');
  const tryonRequests=(await inspect(page)).transport.counts['/v1/tryon']||0;
  await click(page,'Change');await click(page,'Take a photo');await route(page,'capture');await click(page,'Use this photo');
  await page.getByText(/Could not safely remove your head/).waitFor();
  check((await native(page,'Store','getSelfPhoto'))?.updatedAt===self.updatedAt,'failed_self_replacement_changed_singleton');
  check(((await inspect(page)).transport.counts['/v1/tryon']||0)===tryonRequests,'failed_self_replacement_uploaded');
  await click(page,'Cancel');await route(page,'outfit');
  // Recover through another real registration; no state override.
  await captureSource(page,positive.image,'e2e-self-restored');
  await click(page,'Retake');await click(page,'Take a photo');await click(page,'Use this photo');await route(page,'outfit');
}
async function provenanceGuard(context,result=context.result) {
  const {page}=context;
  const raw=await readPrivate(result.providerFile);
  const beforeHash=createHash('sha256').update(raw).digest('hex');
  const galleryBefore=await adb('shell','content','query','--uri','content://media/external/images/media','--projection','_id');
  let denied=false;
  try {await native(page,'Media','exportResult',{resultId:result.id});}
  catch(error){denied=error?.code==='result_download_disabled'||String(error?.message).includes('result_download_disabled');}
  check(denied,'result_download_gate_not_enforced');
  const galleryAfter=await adb('shell','content','query','--uri','content://media/external/images/media','--projection','_id');
  check(galleryBefore.equals(galleryAfter),'download_off_created_media');
  check(createHash('sha256').update(await readPrivate(result.providerFile)).digest('hex')===beforeHash,'export_changed_provider_file');
  context.provenance??={status:'passed',resultDownload:false,galleryUnchanged:true,results:[],watermarkPreservation:'unverified',metadataPreservation:'unverified'};
  context.provenance.results.push({resultId:result.id,providerSha256:beforeHash,providerBytes:raw.length,providerUnchanged:true,exportBlocked:true});
}
export async function tryon(context) {
  const {page}=context;
  if(!context.steps)await prepare(context);
  const pieces=await list(page,'Piece',{origin:'shop'});check(pieces.length>0,'tryon_requires_saved_shop_piece');
  const target=context.target||pieces[0];
  await home(page);await click(page,target.label);await route(page,'item');await tryItOn(page);
  if(!await native(page,'Store','getSelfPhoto'))await selfPhoto(context);
  const before=new Set((await list(page,'Result')).map(result=>result.id));
  context.tryonPhase='e2e-tryon-target-only';await identities(context);
  await click(page,'Fit');await route(page,'result');
  const results=await until(()=>list(page,'Result'),rows=>rows.length===before.size+1,'tryon_result_not_saved',240000);
  context.result=results.find(result=>!before.has(result.id));
  check(context.result.targetPieceId===target.id,'tryon_wrong_target');
  check(context.result.companionSnapshots.length<=2,'tryon_one_piece_per_slot');
  await checkpoint(context,12,['generation-saved-once','target-fixed','snapshot-created']);
  await provenanceGuard(context);
  await checkpoint(context,13,['download-off','no-gallery-write']);
  return {status:'passed',steps:context.steps,webgl:context.webgl,provenance:context.provenance,phaseHeaders:phaseProof(context)};
}
export async function walk(context,source='result') {
  const {page}=context;
  if(!context.steps)await prepare(context);
  let expected;
  if(source==='item'){
    check(context.target?.walkTo,'walk_requires_saved_shop_target');
    await home(page);await click(page,context.target.label);await route(page,'item');
    expected=context.target.walkTo;
  }else{
    if(!context.result){context.result=(await list(page,'Result')).sort((a,b)=>b.createdAt-a.createdAt)[0];check(context.result,'walk_requires_saved_result');await openResult(page,context.result.id);}
    expected=context.result.targetSnapshot.walkTo;
  }
  // From a look, walk back to its lead (outer) piece; other shops have their own buttons.
  const walkButton=source==='item'?/Walk to Shop|Walk back to the photo spot/:context.result.targetSnapshot.shop?`Walk to Shop ${context.result.targetSnapshot.shop.n}`:`Walk back to ${context.result.targetSnapshot.label}`;
  check(expected,'walk_requires_destination');
  const first=(await gpx('walk'))[0];context.routePhase='e2e-route-start';await fix(first);
  await until(()=>native(page,'Geolocation','getCurrentPosition',{enableHighAccuracy:true,timeout:15000,maximumAge:0}),p=>Math.abs(p.coords.latitude-first.lat)<1e-7&&Math.abs(p.coords.longitude-first.lng)<1e-7,'walk_initial_fix_not_received');
  await click(page,walkButton);await route(page,'walk');
  const initial=await until(()=>inspect(page),s=>s.walk&&s.walk.mode!=='loading','walk_not_loaded');
  check(initial.walk.route&&initial.walk.mode!=='error','normal_walk_route_unavailable');
  check(JSON.stringify(initial.walk.destination)===JSON.stringify(expected),'walk_destination_not_target_snapshot');
  const samples=[];let lastFix=initial.walk.fix.t;
  const baseCalls=initial.transport.counts['/v1/route']||0;
  context.routePhase='e2e-route-reroute';
  for(const trace of ['walk-off-route','walk-boundaries','walk']){
    let thresholdStart;
    await replay(trace,async point=>{
      let value=await until(()=>inspect(page),s=>s.walk?.fix&&s.walk.fix.t>lastFix&&Math.abs(s.walk.fix.lat-point.lat)<1e-7&&Math.abs(s.walk.fix.lng-point.lng)<1e-7,'walk_gpx_fix_not_observed',30000);
      lastFix=value.walk.fix.t;
      if(point.event==='off-route-fix1'||point.event==='nearby-start')thresholdStart=value.walk.fix.t;
      check(value.walk.mode!=='arrived','automatic_arrival_forbidden');
      check(value.walk.fix.accuracyM<=30,'gpx_accuracy_ineligible_for_threshold_proof');
      check(JSON.stringify(value.walk.destination)===JSON.stringify(expected),'walk_destination_moved');
      if(trace==='walk-off-route'){
        if(point.event==='off-route-fix1'||point.event==='off-route-fix2')check((value.transport.counts['/v1/route']||0)===baseCalls,'reroute_before_three_fixes_and_ten_seconds');
        if(point.event==='reroute')value=await until(()=>inspect(page),s=>(s.transport.counts['/v1/route']||0)===baseCalls+1&&!s.walk.rerouting&&s.walk.mode!=='error','reroute_not_observed',30000);
        if(point.event==='cooldown')check((value.transport.counts['/v1/route']||0)===baseCalls+1,'reroute_cooldown_violated');
      }
      if(trace==='walk-boundaries'){
        const mode=point.event==='nearby-start'?'direction':point.event==='manual-confirm-arrival'?'nearby':point.event;
        check(value.walk.mode===mode,'walk_distance_or_arrival_boundary_wrong');
      }
      samples.push({trace,checkpoint:point.index,event:point.event,mode:value.walk.mode,accuracyM:value.walk.fix.accuracyM,routeRequests:value.transport.counts['/v1/route']||0});
    },async point=>{
      const duration=point.event==='reroute'?10000:point.event==='manual-confirm-arrival'?5000:0;
      if(duration&&thresholdStart!==undefined)await until(()=>page.evaluate(()=>Date.now()),now=>now>=thresholdStart+duration,'native_threshold_clock_not_elapsed',20000);
    });
  }
  await checkpoint(context,14,['target-destination-'+source,'fresh-native-gpx-fixes','offroute-cooldown-boundaries','no-auto-arrival']);
  await page.getByRole('button',{name:'I found this shop',exact:true}).waitFor();
  await click(page,'I found this shop');await page.getByText(/You confirmed Shop|You confirmed the shop|You confirmed Saved/).first().waitFor();
  check((await inspect(page)).walk.mode==='arrived','manual_arrival_not_committed');
  await checkpoint(context,15,['nearby-before-manual-arrival']);await click(page,'Done');
  context.walkProof??=[];context.walkProof.push({source,samples});
  return {status:'passed',steps:context.steps,walk:context.walkProof,webgl:context.webgl,phaseHeaders:phaseProof(context)};
}
export async function shopping(context) {
  let {page}=context;
  if(!context.steps)await prepare(context);
  const prior=await list(page,'Trip');
  check(prior.length<=1&&prior.every(t=>t.status==='ended'),'requires_empty_or_one_prior_trip');
  check((await native(page,'ShoppingSession','getState')).phase==='idle','requires_idle_shopping');
  check((await list(page,'Result')).length===0&&(await list(page,'Piece')).length===0,'requires_clean_e2e_saved_state');
  const points=await gpx('shopping-three-shops');
  if(!prior.length)await priorTrip(context,points);
  try {
    await fix(points[0]);await home(page);
    const session=await startShopping(page);const tripId=session.trip.id;context.tripId=tripId;
    check((await list(page,'Shop',{tripId})).length===1,'initial_shop_count');
    await checkpoint(context,1,['trip-created','first-shop','recording']);
    for(let n=1;n<=3;n++){
      if(n>1){
        const count=(await list(page,'Shop',{tripId})).length;
        await shoppingFix(page,points.find(p=>p.event===`new-shop${n}`));
        check((await list(page,'Shop',{tripId})).length===count,'movement_created_shop');
        if(n===2)await notification('New shop');else await click(page,'New shop');
        await until(()=>list(page,'Shop',{tripId}),rows=>rows.length===count+1,'new_shop_not_created_once');
      }
      if(n===3)await offline(page,true);
      if(n===1){await click(page,'Add note');await page.getByRole('dialog').getByRole('textbox').first().fill('blue tarp, near the entrance');await click(page,'Save',page.getByRole('dialog'));}
      for(const kind of ['storefront','item']){
        await shoppingFix(page,points.find(p=>p.event===`shop${n}-${kind}`));
        const before=(await list(page,'Photo',{tripId})).length;
        if(kind==='storefront'){await click(page,'Storefront photo');await click(page,'Capture storefront');}
        else await click(page,'Take photo');
        const photos=await until(()=>list(page,'Photo',{tripId}),rows=>rows.length===before+1,'capture_not_committed');
        for(const photo of photos)check((await readPrivate(photo.file)).length>0,'capture_file_missing');
      }
      await checkpoint(context,n+1,['photo-files','storefront-and-item','manual-shop-number']);
    }
    const jobs=await list(page,'QueueJob');check(jobs.every(j=>['describe_storefront','label_piece'].includes(j.kind)),'forbidden_queued_operation');
    check(jobs.filter(j=>j.kind==='describe_storefront').every(j=>j.attempts===0),'offline_queue_attempt_consumed');
    await offline(page,false);
    await until(()=>list(page,'Photo',{tripId}),rows=>rows.filter(p=>p.kind==='item').every(p=>p.indexState==='done'),'photo_index_not_complete');
    await until(()=>list(page,'Shop',{tripId}),rows=>rows.length===3&&rows.every(s=>s.descriptionState==='done'),'storefront_queue_not_completed',120000);
    await swipeTask();await fix(points[8]);await launch();await context.reconnect();page=context.page;
    await installPhaseHeaders(context);await home(page);
    check((await native(page,'ShoppingSession','getState')).phase==='recording','task_swipe_stopped_session');
    await confirm(page,'End shopping');await route(page,'home');
    check((await list(page,'TrailPoint',{tripId})).length===0,'ended_trip_retains_trail');
    check((await list(page,'Photo',{tripId})).length===6,'end_deleted_photos');
    await click(page,'All trips');await route(page,'trips');await openTrip(page,tripId);
    await checkpoint(context,5,['trip-ended','trail-deleted','photos-retained','task-swipe-restored']);
    return {status:'passed',segment:'shopping',steps:context.steps,webgl:context.webgl};
  }finally{await offline(page,false);}
}

export async function search(context) {
  const {page}=context;if(!context.steps)await prepare(context);
  const trips=(await list(page,'Trip')).sort((a,b)=>b.startedAt-a.startedAt);
  context.tripId??=trips[0]?.id;check(context.tripId,'search_requires_shopping_segment');
  check((await list(page,'Shop',{tripId:context.tripId})).length===3,'search_requires_three_shop_trip');
  await home(page);await click(page,'Find it');await route(page,'ask');
  const voiceProof=observeVoice(page);
  await click(page,'Speak');
  await page.getByRole('button',{name:'Best match',exact:true}).waitFor({timeout:300000});
  context.voice=await voiceProof();
  await checkpoint(context,6,['native-vad-transcript-search','transcript-verbatim']);
  const agent=(await inspect(page)).agent;
  check(agent.status==='results'&&agent.candidates.length>0,'search_not_completed');
  check(agent.visibleCandidates.length===Math.min(3,agent.candidates.length),'top_three_visibility');
  const callsBefore=(await inspect(page)).transport.counts;
  if(agent.candidates.length>3)await click(page,/Show all/);
  check(JSON.stringify((await inspect(page)).transport.counts)===JSON.stringify(callsBefore),'show_all_started_network');
  await checkpoint(context,7,['search-real-agent-events','top-three','show-all-no-network']);
  await click(page,'Best match');await route(page,'pick');await click(page,/^1\./);await click(page,'Use this item');await route(page,'item');
  context.target=(await list(page,'Piece',{origin:'shop'}))[0];check(context.target,'target_not_saved');
  const targetShop=await native(page,'Store','get',{entity:'Shop',id:context.target.shopId});
  check(targetShop?.n===2&&targetShop.tripId===context.tripId,'search_selected_wrong_trip_or_shop');
  check(JSON.stringify(targetShop.spot)!==JSON.stringify(context.target.walkTo),'target_location_equals_shop_spot_fixture');
  await click(page,'Original photo');await route(page,'pick');
  await page.getByRole('button',{name:/^Tap the item in the photo/}).waitFor();
  await click(page,'Back');await route(page,'item');await click(page,'Back');await route(page,'pick');
  await click(page,/^1\./);await click(page,'Use this item');await route(page,'item');
  check((await list(page,'Piece',{origin:'shop'})).length===1,'duplicate_candidate_saved_twice');
  await checkpoint(context,8,['candidate-saved-idempotently','original-photo-linked']);
  return {status:'passed',segment:'search',steps:context.steps,webgl:context.webgl};
}

export async function full(context) {
  await shopping(context);await search(context);const tripId=context.tripId;const {page}=context;
  await walk(context,'item');
  try {
    const wardrobe=await addWardrobe(context);await checkpoint(context,9,['wardrobe-cutout-saved']);
    await home(page);await click(page,context.target.label);await tryItOn(page);
    // Spark's mock names the jeans an outer layer; re-sorting it into the bottom slot is the user's call.
    await click(page,'Add bottom');await click(page,`Use ${wardrobe.label} as bottom`);
    await click(page,'Add top');await click(page,'From a trip photo');await route(page,'trips');await openTrip(page,tripId);await click(page,/Open photo/);await route(page,'pick');
    await offline(page,true);await chooseArea(page,{x:0.75,y:0.5});await click(page,'Add to outfit');await route(page,'outfit');
    const draft=(await inspect(page)).fitting.draft;check(draft.outfit.outer===context.target.id&&draft.outfit.bottom===wardrobe.id&&!!draft.outfit.top,'direct_cut_lost_draft');
    await offline(page,false);await checkpoint(context,10,['offline-direct-cut','draft-preserved','three-slots-filled']);
    await selfPhoto(context);await checkpoint(context,11,['self-registered','failed-replacement-preserved-self']);
    await click(page,'Fit');await route(page,'result');
    context.result=(await list(page,'Result'))[0];check(context.result?.companionSnapshots.length===2,'result_snapshot_companions');
    await checkpoint(context,12,['real-generation','independent-snapshots']);
    const files=await snapshotFiles(context.result);const snapshot=JSON.stringify(context.result);
    await provenanceGuard(context);
    await checkpoint(context,13,['download-not-exposed','result-displayed']);
    await click(page,'Change pieces');await route(page,'outfit');await click(page,`Remove ${wardrobe.label} from bottom`);
    context.tryonPhase='e2e-tryon-other';await identities(context);
    await click(page,'Fit');await route(page,'result');
    context.otherResult=(await list(page,'Result')).find(result=>result.id!==context.result.id);
    check(context.otherResult?.companionSnapshots.length===1,'second_changed_combination_not_saved');
    const otherFiles=await snapshotFiles(context.otherResult);const otherSnapshot=JSON.stringify(context.otherResult);
    await provenanceGuard(context,context.otherResult);
    await openResult(page,context.result.id);
    await walk(context);
    const removedPhotos=await list(page,'Photo',{tripId});const removedIds=new Set(removedPhotos.map(p=>p.id));
    await home(page);await click(page,'All trips');await openTrip(page,tripId);await click(page,/Open photo/);await route(page,'pick');await confirm(page,'Delete photo');
    await home(page);await click(page,'All trips');await openTrip(page,tripId);await confirm(page,'Delete trip');
    for(const entity of ['Shop','Photo','TrailPoint'])check((await list(page,entity,{tripId})).length===0,'trip_delete_left_'+entity.toLowerCase());
    check((await list(page,'PhotoEmbedding')).every(e=>!removedIds.has(e.photoId)),'trip_delete_left_embedding');
    check((await list(page,'QueueJob')).every(job=>!removedIds.has(job.refId)),'trip_delete_left_queue_job');
    for(const photo of removedPhotos)await absentPrivate(photo.file);
    const saved=await native(page,'Store','get',{entity:'Piece',id:context.target.id});check(saved&&saved.photoId===null&&saved.shopId===null&&JSON.stringify(saved.walkTo)===JSON.stringify(context.target.walkTo),'trip_delete_changed_piece');
    await checkpoint(context,16,['photo-and-trip-deleted','saved-piece-location-preserved']);
    const deleting=[saved,...await list(page,'Piece').then(pieces=>pieces.filter(piece=>piece.id!==saved.id&&Object.values(draft.outfit).includes(piece.id)))];
    for(const piece of deleting){await home(page);if(piece.origin==='wardrobe'){await click(page,'Wardrobe');await click(page,`Open ${piece.label}`);}else await click(page,piece.label);await route(page,'item');await confirm(page,'Delete piece');await absentPrivate(piece.cutoutFile);}
    const unchanged=await native(page,'Store','get',{entity:'Result',id:context.result.id});
    check(JSON.stringify(unchanged)===snapshot&&JSON.stringify(await snapshotFiles(unchanged))===JSON.stringify(files),'source_delete_changed_result_snapshot');
    await openResult(page,context.result.id);check(await page.getByRole('button',{name:'Change pieces',exact:true}).isDisabled(),'deleted_target_allows_change_pieces');
    await checkpoint(context,17,['snapshot-bytes-preserved','change-pieces-disabled']);
    await walk(context);await confirm(page,'Delete look');await route(page,'results');
    const retained=await list(page,'Result');check(retained.length===1&&retained[0].id===context.otherResult.id,'result_delete_changed_other_row');
    check(JSON.stringify(retained[0])===otherSnapshot&&JSON.stringify(await snapshotFiles(retained[0]))===JSON.stringify(otherFiles),'result_delete_changed_other_snapshot');
    for(const file of new Set([context.result.file,context.result.providerFile,...[context.result.targetSnapshot,...context.result.companionSnapshots].flatMap(p=>[p.cutoutFile,p.shop?.storefrontFile]).filter(Boolean)]))await absentPrivate(file);
    await openResult(page,context.otherResult.id);await confirm(page,'Delete look');await route(page,'results');
    check((await list(page,'Result')).length===0,'final_result_delete_left_row');
    for(const file of new Set([context.otherResult.file,context.otherResult.providerFile,...[context.otherResult.targetSnapshot,...context.otherResult.companionSnapshots].flatMap(p=>[p.cutoutFile,p.shop?.storefrontFile]).filter(Boolean)]))await absentPrivate(file);
    await home(page);await offline(page,true);await click(page,'Privacy');await route(page,'privacy');
    await checkpoint(context,18,['result-deleted','privacy-available-offline']);
    const final=await inspect(page);check(final.transport.rawSelfReads===0&&final.transport.headMaskReads===0&&final.transport.resultExports===0,'device_privacy_observer_failure');
    check(new Set(context.steps.map(s=>s.step)).size===19,'full_scenario_missing_acceptance_steps');
    return {status:'passed',steps:context.steps,webgl:context.webgl,voice:context.voice,walk:context.walkProof,phaseHeaders:phaseProof(context),provenance:context.provenance,devicePrivacy:{rawSelfReads:final.transport.rawSelfReads,headMaskReads:final.transport.headMaskReads,resultExports:final.transport.resultExports,snapshotIndependent:true,otherResultPreserved:true,deletedOwnedFiles:true,embeddingCascade:true,endedTrailCount:0,observerScope:final.transport.scope},transport:final.transport};
  } finally {await offline(page,false);}
}

export {inspect,click,route,home,startShopping,shoppingFix,prepare,confirm};
