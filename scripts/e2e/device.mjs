import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {adb,check,connect,fixture,json,list,native,stage,readPrivate,removeStaged} from './android.mjs';
import {full,shopping,search,walk,tryon} from './scenarios.mjs';
import {research} from './research.mjs';

async function headMask(page) {
  const review=await json(path.join(fixture,'review/head.json'));const manifest=await json(path.join(fixture,'manifest.json'));const cases=[];
  for(const item of review.cases){
    check(item.status==='human-approved' && item.humanAttestation===true,'head_case_not_human_approved');
    const assetFile=await stage(item.image);
    const asset=manifest.assets.find(value=>value.path===item.image);
    check(asset,'head_asset_not_manifested');
    const gt=item.expectedRegistration?await stage(item.groundTruthMask):null;
    try {
      const before=await native(page,'Store','getSelfPhoto');
      const started=performance.now();
      const result=await native(page,'FaceMask','evaluateFixture',{asset:{id:item.id,file:assetFile,w:asset.width,h:asset.height},expectedPerson:item.expectedRegistration,groundTruthHeadMask:gt});
      const after=await native(page,'Store','getSelfPhoto');
      check(JSON.stringify(before)===JSON.stringify(after),'evaluate_fixture_replaced_self');
      const passed=item.expectedRegistration?result.registrationOk===true&&result.metrics.exposedHeadPixels===0&&result.metrics.privacyPassed===true:result.registrationOk===false;
      cases.push({id:item.id,sourceSha256:item.sourceSha256,groundTruthSha256:item.groundTruthSha256??null,expectedRegistration:item.expectedRegistration,registrationOk:result.registrationOk,reason:result.reason,metrics:result.metrics,elapsedMs:Math.round(performance.now()-started),passed:passed&&result.passed===true});
    } finally {
      await removeStaged(assetFile);
      if(gt)await removeStaged(gt);
    }
  }
  return {status:cases.every(value=>value.passed)?'passed':'failed',cases,providerCalls:0};
}
async function inference(page) {
  const photos=await list(page,'Photo');check(photos.length>0,'inference_requires_captured_photo');
  const photo=photos.find(p=>p.kind==='item');check(photo,'inference_requires_item_photo');
  const start=performance.now();
  const vector=await native(page,'PhotoIndex','index',{photoId:photo.id});
  const values=vector.vector;check(values?.length===512&&values.every(Number.isFinite),'invalid_native_embedding');
  const prepared=await native(page,'Segmenter','prepare',{asset:{id:photo.id,file:photo.file,w:photo.w,h:photo.h}});
  try {
    const result=await native(page,'Segmenter','tap',{handle:prepared.handle,x:0.5,y:0.5});
    check(result.masks.length===3,'native_tap_requires_three_masks');
    for(const mask of result.masks)check((await readPrivate(mask.mask)).length>0,'native_mask_file_missing');
  } finally {await native(page,'Segmenter','release',{handle:prepared.handle});}
  const head=await headMask(page);check(head.status==='passed','native_head_mask_failed');
  return {status:'passed',index:true,tap:true,mask:true,elapsedMs:Math.round(performance.now()-start),headCases:head.cases.length};
}
async function provenance(page) {
  const results=await list(page,'Result');check(results.length>0,'provenance_requires_saved_result');
  const rows=[];
  const before=await adb('shell','content','query','--uri','content://media/external/images/media','--projection','_id');
  for(const result of results){
    const provider=await readPrivate(result.providerFile);const beforeHash=createHash('sha256').update(provider).digest('hex');
    let blocked=false;
    try {await native(page,'Media','exportResult',{resultId:result.id});}
    catch(error){blocked=error?.code==='result_download_disabled'||String(error?.message).includes('result_download_disabled');}
    check(blocked,'result_export_not_disabled');
    const afterHash=createHash('sha256').update(await readPrivate(result.providerFile)).digest('hex');
    check(beforeHash===afterHash,'provider_file_mutated');
    rows.push({providerSha256:beforeHash,providerBytes:provider.length,providerUnchanged:true,exportBlocked:true});
  }
  const after=await adb('shell','content','query','--uri','content://media/external/images/media','--projection','_id');
  check(before.equals(after),'disabled_export_created_gallery_media');
  return {status:'passed',results:rows,resultDownload:false,galleryUnchanged:true,watermarkPreservation:'unverified',metadataPreservation:'unverified'};
}
export async function execute(options) {
  let connection=await connect();const {page}=connection;
  try {
    if(options.operation==='head-mask')return await headMask(page);
    if(options.operation==='inference')return await inference(page);
    if(options.operation==='provenance')return await provenance(page);
    const context={page,options,reconnect:async()=>{
      await connection.device.close();
      connection=await connect();context.page=connection.page;
    }};
    if(options.operation==='research')return await research(context);
    if(options.scenario==='full')return await full(context);
    if(options.scenario==='shopping')return await shopping(context);
    if(options.scenario==='search')return await search(context);
    if(options.scenario==='walk')return await walk(context);
    if(options.scenario==='tryon')return await tryon(context);
    throw new Error('unknown_device_operation');
  } finally {await connection.device.close();}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
  try {
    const options=JSON.parse(await readFile(process.argv[2],'utf8'));
    const result=await execute(options);
    process.stdout.write(JSON.stringify(result)+'\n');
    if(result.status!=='passed')process.exitCode=1;
  } catch(error){
    // Playwright errors may quote DOM, URLs or entered values. Never print them.
    process.stdout.write(JSON.stringify({status:'failed',errorType:error?.name||'Error',code:/^[a-z][a-z0-9_]+$/.test(error?.message||'')?error.message:'device_operation_failed'})+'\n');
    process.exitCode=1;
  }
}
