import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
import {adb,check,connect,fix,gpx,list,native,nodes,permissions,pkg,root,screenshot,until} from './android.mjs';

const {values}=parseArgs({options:{output:{type:'string'}}});
const output=path.resolve(values.output||path.join(root,'verification/results/permission-variants'));
const names=['ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION','POST_NOTIFICATIONS','CAMERA','RECORD_AUDIO'];
const permission=name=>'android.permission.'+name;
const cache='shared_prefs/PluginPermStates.xml';
const emptyCache=Buffer.from('<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<map />\n');
let connection,original,originalCache,baseline,ownTrip,mutating=false,gpsTimer,gpsPending=Promise.resolve(),gpsError;
const report={scope:'actual Android permission dialogs, native state/SQLite and app UI; no mock or live model acceptance',cases:[],passed:false};

async function permissionState() {
  const dump=(await adb('shell','dumpsys','package',pkg)).toString();
  return names.map(name=>{
    const line=dump.split('\n').find(value=>value.trim().startsWith(permission(name)+': granted='));
    check(line,'runtime_permission_not_found');
    return {name,granted:/granted=true/.test(line),userSet:/\bUSER_SET\b/.test(line),userFixed:/\bUSER_FIXED\b/.test(line)};
  });
}
async function close() {
  if(connection){const previous=connection;connection=null;await previous.device.close();}
}
async function open() {
  await close();
  // No debug media extras: these cases exercise the real CameraX/microphone paths.
  await adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d','streetfitting://home','-n',pkg+'/.MainActivity');
  connection=await connect();
  await connection.page.getByRole('button',{name:'All trips',exact:true}).waitFor({state:'visible'});
  return connection.page;
}
async function readCache() {
  return adb('exec-out','run-as',pkg,'sh','-c',`'if [ -f ${cache}.bak ]; then cat ${cache}.bak; elif [ -f ${cache} ]; then cat ${cache}; fi'`);
}
async function writeCache(bytes) {
  // Only Capacitor's permission history is reset/restored. Auth, Store and media are untouched.
  await adb('shell','run-as',pkg,'rm','-f',cache+'.bak');
  if(!bytes.length){await adb('shell','run-as',pkg,'rm','-f',cache);return;}
  await new Promise((resolve,reject)=>{
    const child=spawn('adb',['-s',process.env.ANDROID_SERIAL,'shell','run-as',pkg,'sh','-c',`'mkdir -p shared_prefs && cat > ${cache}'`],{stdio:['pipe','ignore','ignore']});
    child.on('error',()=>reject(new Error('permission_cache_write_failed')));
    child.on('exit',code=>code===0?resolve():reject(new Error('permission_cache_write_failed')));
    child.stdin.on('error',()=>reject(new Error('permission_cache_write_failed')));
    child.stdin.end(bytes);
  });
}
async function configure(denied) {
  await close();await adb('shell','am','force-stop',pkg);
  for(const name of names){
    await adb('shell','pm',denied.includes(name)?'revoke':'grant',pkg,permission(name));
    await adb('shell','pm','clear-permission-flags',pkg,permission(name),'user-set','user-fixed');
  }
  await writeCache(emptyCache);
  return open();
}
async function snapshot(page) {
  const result={};
  for(const entity of ['Trip','Shop','Photo','Piece'])result[entity]=(await list(page,entity)).map(value=>value.id).sort();
  result.trailCount=(await list(page,'TrailPoint')).length;
  return result;
}
function unchanged(before,after) {
  for(const entity of ['Trip','Shop','Photo','Piece'])check(JSON.stringify(before[entity])===JSON.stringify(after[entity]),'denial_changed_'+entity);
  check(before.trailCount===after.trailCount,'denial_changed_trail');
}
async function servicePresent() {
  const text=(await adb('shell','dumpsys','activity','services',pkg)).toString();
  return {running:/ServiceRecord\{[^\n]*\.plugins\.shopping\.ShoppingService/.test(text),foreground:/isForeground=true/.test(text)};
}
async function probe(page,plugin,eventName) {
  await page.evaluate(({plugin,eventName})=>{
    window.__sfPermissionProbe={events:[],errors:[]};
    window.Capacitor.nativeCallback(plugin,'addListener',{eventName},(value,error)=>{
      if(error)window.__sfPermissionProbe.errors.push('listener_failed');
      else window.__sfPermissionProbe.events.push({code:value?.code??null});
    });
  },{plugin,eventName});
}
async function probeState(page) {return page.evaluate(()=>window.__sfPermissionProbe);}
async function audioFiles() {
  return (await adb('shell','run-as',pkg,'sh','-c',"'if [ -d cache/voice ]; then find cache/voice -type f; fi'")).toString().trim().split('\n').filter(Boolean).sort();
}
async function shot(name) {await screenshot(output,name);}

check(process.env.SF_EMULATOR_LOCK_OWNER,'emulator_lock_required');
await mkdir(output,{recursive:true});
try {
  let page=await open();
  check((await native(page,'ShoppingSession','getState')).phase==='idle','existing_shopping_session_must_end');
  original=await permissionState();baseline=await snapshot(page);
  await close();await adb('shell','am','force-stop',pkg);
  originalCache=await readCache();mutating=true;
  report.api=Number((await adb('shell','getprop','ro.build.version.sdk')).toString().trim());
  report.pageSize=Number((await adb('shell','getconf','PAGE_SIZE')).toString().trim());
  check(report.api===37&&report.pageSize===16384,'wrong_emulator_baseline');
  const point=(await gpx('shopping-three-shops'))[0];
  await fix(point);
  gpsTimer=setInterval(()=>{gpsPending=gpsPending.then(()=>fix(point)).catch(()=>{gpsError='gps_injection_failed';});},1000);

  page=await configure(['ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION']);
  const beforeLocation=await snapshot(page);
  await page.getByRole('button',{name:'Start shopping',exact:true}).click();
  await permissions(false);
  await page.getByRole('heading',{name:'Shopping mode needs your location',exact:true}).waitFor({state:'visible'});
  check((await native(page,'ShoppingSession','getState')).phase==='idle','location_denial_not_idle');
  unchanged(beforeLocation,await snapshot(page));
  check(!(await servicePresent()).running,'location_denial_started_service');
  await shot('location-denied');
  await page.getByRole('button',{name:'Open settings',exact:true}).click();
  await until(nodes,items=>items.some(item=>item.package==='com.android.settings'&&item.text==='Street Fitting'),'app_settings_not_opened');
  await shot('location-settings');
  report.cases.push({name:'locationDenied',passed:true,tripShopPhotoPieceDelta:0,trailDelta:0,serviceCreated:false,appSettingsOpened:true});

  page=await configure(['POST_NOTIFICATIONS']);
  await probe(page,'ShoppingSession','notice');
  await page.getByRole('button',{name:'Start shopping',exact:true}).click();
  await permissions(false);
  const recording=await until(()=>native(page,'ShoppingSession','getState'),state=>state.phase==='recording','notification_denial_stopped_shopping');
  ownTrip=recording.trip.id;
  await until(()=>probeState(page),state=>state.events.length===1,'notification_notice_missing');
  await page.getByText('Shopping mode on · no notification card',{exact:true}).waitFor({state:'visible'});
  await shot('notification-denied-recording');
  check((await servicePresent()).foreground,'notification_denial_has_no_foreground_service');
  for(let i=0;i<2;i++)check((await native(page,'ShoppingSession','start')).trip.id===ownTrip,'idempotent_start_created_trip');
  await until(()=>native(page,'ShoppingSession','getState'),state=>state.latestFix?.t>recording.latestFix.t,'recording_fix_not_advancing');
  const notices=await probeState(page);
  check(!notices.errors.length&&notices.events.length===1&&notices.events[0].code==='notification_unavailable','notification_notice_not_exactly_once');
  await adb('shell','cmd','statusbar','expand-notifications');
  const shade=await nodes();
  check(!shade.some(item=>item.package==='com.android.systemui'&&['Shopping mode','Take photo','New shop'].includes(item.text)),'denied_notification_card_visible');
  await shot('notification-denied-shade');await adb('shell','input','keyevent','KEYCODE_BACK');
  check((await list(page,'TrailPoint',{tripId:ownTrip})).length>0,'recording_trail_missing');
  report.cases.push({name:'notificationDenied',passed:true,foreground:true,noticeCount:1,notificationCard:false,repeatedStartSameTrip:true});

  await close();
  await adb('shell','pm','revoke',pkg,permission('ACCESS_FINE_LOCATION'));
  await adb('shell','pm','revoke',pkg,permission('ACCESS_COARSE_LOCATION'));
  await until(servicePresent,value=>!value.running,'revoked_location_service_survived');
  page=await open();
  check((await native(page,'ShoppingSession','getState')).phase==='idle','revoked_location_not_idle');
  const ended=await native(page,'Store','get',{entity:'Trip',id:ownTrip});
  check(ended?.status==='ended'&&Number.isFinite(ended.endedAt),'revoked_trip_not_ended_on_reopen');
  check((await list(page,'TrailPoint',{tripId:ownTrip})).length===0,'revoked_trip_retained_trail');
  check((await list(page,'Shop',{tripId:ownTrip})).length===1,'revoked_trip_lost_shop');
  await shot('location-revoked-reopened');
  report.cases.push({name:'locationRevoked',passed:true,scope:'OS stops the process/service; real app reopening commits orphan-session end and trail deletion',trailAfterReopen:0,shopPreserved:true});

  page=await configure(['CAMERA']);
  const beforeCamera=await snapshot(page);
  await page.getByRole('button',{name:'Wardrobe',exact:true}).click();
  await page.getByRole('button',{name:'Add a piece',exact:true}).click();
  await page.getByRole('button',{name:'Take a photo',exact:true}).click();
  await permissions(false);
  await page.getByText('Camera access is off. Allow access in device settings, then try again.',{exact:true}).waitFor({state:'visible'});
  const shutter=page.getByRole('button',{name:'Take photo',exact:true});await shutter.scrollIntoViewIfNeeded();
  check(!await shutter.isEnabled(),'denied_camera_shutter_enabled');
  unchanged(beforeCamera,await snapshot(page));await shot('camera-denied');
  report.cases.push({name:'cameraDenied',passed:true,source:'CameraX, no fixture extras',shutterEnabled:false,tripShopPhotoPieceDelta:0});

  page=await configure(['RECORD_AUDIO']);
  const beforeAudio=await audioFiles();let transcriptionRequests=0;
  page.on('request',request=>{if(new URL(request.url()).pathname==='/v1/transcribe')transcriptionRequests++;});
  await probe(page,'Voice','completed');
  await page.getByRole('button',{name:'Find it',exact:true}).click();
  await page.getByRole('button',{name:'Speak',exact:true}).click();
  await permissions(false);
  await page.getByText('Microphone access is off. Allow access in device settings, or type your question.',{exact:true}).waitFor({state:'visible'});
  const voice=await probeState(page);
  check(!voice.errors.length&&voice.events.length===0,'denied_microphone_completed');
  check(transcriptionRequests===0,'denied_microphone_uploaded');
  check(JSON.stringify(beforeAudio)===JSON.stringify(await audioFiles()),'denied_microphone_created_audio');
  await shot('microphone-denied');
  report.cases.push({name:'microphoneDenied',passed:true,source:'real microphone permission path, not hardware-recording proof',completed:0,transcriptionRequests:0,audioFileDelta:0});
  const after=await snapshot(page);
  for(const entity of ['Trip','Shop','Photo','Piece'])check(baseline[entity].every(id=>after[entity].includes(id)),'existing_'+entity+'_removed');
  check(!gpsError,gpsError);
  report.existingRecordsPreserved=true;report.ownEndedTrip=ownTrip;report.passed=true;
} catch(error) {
  report.error=/^[a-z][a-zA-Z0-9_]{0,100}$/.test(error?.code||error?.message||'')?(error.code||error.message):'permission_ui_or_device_failure';
} finally {
  clearInterval(gpsTimer);await gpsPending;
  if(mutating){
    try {
      if(connection&&ownTrip){
        const state=await native(connection.page,'ShoppingSession','getState');
        if(state.phase==='recording'&&state.trip.id===ownTrip)await native(connection.page,'ShoppingSession','stop');
      }
      await close();await adb('shell','am','force-stop',pkg);
      for(const state of original){
        await adb('shell','pm',state.granted?'grant':'revoke',pkg,permission(state.name));
        await adb('shell','pm','clear-permission-flags',pkg,permission(state.name),'user-set','user-fixed');
        const flags=[...(state.userSet?['user-set']:[]),...(state.userFixed?['user-fixed']:[])];
        if(flags.length)await adb('shell','pm','set-permission-flags',pkg,permission(state.name),...flags);
      }
      await writeCache(originalCache);
      check((await readCache()).equals(originalCache),'permission_cache_not_restored');
      check(JSON.stringify(await permissionState())===JSON.stringify(original),'permissions_not_restored');
      report.originalPermissionsAndHistoryRestored=true;
      await open();
    } catch {report.passed=false;report.restorationError='permission_restoration_failed';}
  }
  await close();
  await writeFile(path.join(output,'permissions.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report));
if(!report.passed)process.exitCode=1;
