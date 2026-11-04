import {_android} from 'playwright-core';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile, writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const exec = promisify(execFile);
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const fixture = path.join(root, 'verification/fixtures');
export const pkg = 'com.streetfitting.app';
export function check(value, code) { if (!value) throw new Error(code); }
export async function json(file) { return JSON.parse(await readFile(file, 'utf8')); }
export async function adb(...args) {
  check(process.env.ANDROID_SERIAL, 'ANDROID_SERIAL_required');
  const {stdout} = await exec('adb', ['-s', process.env.ANDROID_SERIAL, ...args], {encoding:'buffer', maxBuffer:64*1024*1024, timeout:120000});
  return stdout;
}
export async function until(read, predicate, code, timeout = 90000) {
  const deadline = performance.now() + timeout;
  do {
    const value = await read();
    if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 150));
  } while (performance.now() < deadline);
  throw new Error(code);
}
export function xmlNodes(xml) {
  const decode = value => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return [...xml.matchAll(/<node\b([^>]+)>/g)].map(match => Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(v => [v[1], decode(v[2])])));
}
export async function nodes() {
  const file='/data/local/tmp/sf-e2e-window-'+randomUUID()+'.xml';
  await adb('shell', 'uiautomator', 'dump', file);
  try { return xmlNodes((await adb('exec-out', 'cat', file)).toString()); }
  finally { await adb('shell', 'rm', '-f', file); }
}
export function bounds(node) {
  const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(node.bounds || '');
  check(match, 'system_node_has_no_bounds');
  return match.slice(1).map(Number);
}
export async function systemTap(predicate, code) {
  const node = await until(nodes, items => items.some(predicate), code).then(items => items.find(predicate));
  const [x1,y1,x2,y2] = bounds(node);
  await adb('shell', 'input', 'tap', String(Math.round((x1+x2)/2)), String(Math.round((y1+y2)/2)));
}
export async function permissions(allow = true) {
  const ids = allow ? ['permission_allow_foreground_only_button','permission_allow_button','permission_allow_one_time_button'] : ['permission_deny_button'];
  await systemTap(node => ids.some(id => (node['resource-id'] || '').endsWith('/'+id)), 'permission_dialog_missing');
}
export async function notification(action) {
  await adb('shell', 'cmd', 'statusbar', 'expand-notifications');
  await systemTap(node => node.text === action || node['content-desc'] === action, 'notification_action_missing');
}
export async function swipeTask() {
  await adb('shell', 'input', 'keyevent', 'KEYCODE_APP_SWITCH');
  const node = await until(nodes, items => items.some(n => /Street Fitting/.test(n['content-desc'] || n.text || '')), 'recent_task_missing').then(items => items.find(n => /Street Fitting/.test(n['content-desc'] || n.text || '')));
  const [x1,y1,x2,y2] = bounds(node);
  await adb('shell','input','swipe',String(Math.round((x1+x2)/2)),String(Math.round((y1+y2)/2)),String(Math.round((x1+x2)/2)),String(Math.max(0,y1- Math.round(y2-y1))), '400');
  await until(nodes, items => !items.some(n => /Street Fitting/.test(n['content-desc'] || n.text || '')), 'task_not_removed');
}
let captureDirectory='capture-fixtures';
let voiceDirectory='voice-fixtures';
function fixtureExtras() {
  return ['--es','sf_capture_source','fixture','--es','sf_capture_fixture_dir',`/data/user/0/${pkg}/files/${captureDirectory}/`,'--es','sf_voice_source','fixture','--es','sf_voice_fixture_dir',`/data/user/0/${pkg}/files/${voiceDirectory}/`];
}
export async function deepLink(url) { await adb('shell','am','start','-W','-a','android.intent.action.VIEW','-d',url,...fixtureExtras(),pkg); }
export async function launch(captureDir = captureDirectory, voiceDir = voiceDirectory) {
  check(/^(capture-fixtures|capture-cases\/[a-z0-9-]+)$/.test(captureDir)&&voiceDir==='voice-fixtures','invalid_private_fixture_directory');
  captureDirectory=captureDir;voiceDirectory=voiceDir;
  await adb('shell','am','start','-W','-n',pkg+'/.MainActivity',...fixtureExtras());
}
export async function stage(relative, category = 'ml-proof') {
  check(!relative.includes('..') && !path.isAbsolute(relative), 'fixture_path_escape');
  check(/^[a-z][a-z0-9-]+$/.test(category), 'invalid_fixture_category');
  const bytes = await readFile(path.join(fixture, relative));
  const name = createHash('sha256').update(bytes).digest('hex') + path.extname(relative);
  await adb('shell','run-as',pkg,'mkdir','-p','cache/'+category);
  // run-as cannot read external app files on all Android versions. stdin keeps
  // bytes off shared /data/local/tmp and preserves exact provider encoding.
  await new Promise((resolve,reject) => {
    const child = execFile('adb',['-s',process.env.ANDROID_SERIAL,'shell','run-as',pkg,'sh','-c',`'cat > cache/${category}/${name}'`],{timeout:120000},error => error ? reject(new Error('private_fixture_staging_failed')) : resolve());
    child.stdin.end(bytes);
  });
  return `/data/user/0/${pkg}/cache/${category}/${name}`;
}
export async function removeStaged(file) {
  const prefix=`/data/user/0/${pkg}/cache/`;
  check(file.startsWith(prefix) && /^(ml-proof|poc-provider)\/[a-f0-9]{64}\.[a-zA-Z0-9]+$/.test(file.slice(prefix.length)), 'fixture_cleanup_outside_staging');
  await adb('shell','run-as',pkg,'rm','-f','cache/'+file.slice(prefix.length));
}
export async function readPrivate(file) {
  const local = file.replace(/^file:\/\//,'');
  const prefixes = [`/data/user/0/${pkg}/`, `/data/data/${pkg}/`];
  const prefix = prefixes.find(value => local.startsWith(value));
  check(prefix && !local.includes('/../') && /\/(files|cache)\//.test(local), 'private_file_outside_app');
  return adb('exec-out','run-as',pkg,'cat',local.slice(prefix.length));
}
export async function connect() {
  const devices = await _android.devices();
  const device = devices.find(value => value.serial() === process.env.ANDROID_SERIAL);
  check(device, 'selected_android_device_not_found');
  const webview = await device.webView({pkg, timeout:90000});
  const page = await webview.page();
  page.setDefaultTimeout(90000);
  await page.waitForFunction(()=>window.Capacitor?.getPlatform()==='android');
  return {device,page};
}
export async function native(page, plugin, method, options={}) {
  const reply=await page.evaluate(async({plugin,method,options})=>{
    try {
      let value=await window.Capacitor.nativePromise(plugin,method,options);
      if(plugin==='Store'&&['get','getSelfPhoto','nextJob'].includes(method)){
        if(!value||typeof value!=='object'||!('value' in value))return {ok:false,code:'native_nullable_envelope_missing'};
        value=value.value;
      }
      return {ok:true,value};
    }catch(error){return {ok:false,code:/^[a-z][a-z0-9_]{0,63}$/.test(error?.code||'')?error.code:'native_operation_failed'};}
  },{plugin,method,options});
  if(!reply.ok)throw Object.assign(new Error(reply.code),{code:reply.code});
  return reply.value;
}
export async function list(page, entity, filters={}) {
  let cursor; const items=[];
  do {
    const result=await native(page,'Store','list',{entity,...filters,limit:200,...(cursor?{cursor}:{})});
    items.push(...result.items);cursor=result.nextCursor;
  } while(cursor);
  return items;
}
export async function screenshot(directory, name) {
  await writeFile(path.join(directory,name+'.png'),await adb('exec-out','screencap','-p'));
}
export async function gpx(name) {
  const text=await readFile(path.join(fixture,'gpx',name+'.gpx'),'utf8');
  const side=await json(path.join(fixture,'gpx',name+'.expected.json'));
  const points=[...text.matchAll(/<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>\s*<time>([^<]+)<\/time>/g)].map(m=>({lat:Number(m[1]),lng:Number(m[2]),time:Date.parse(m[3])}));
  check(points.length===side.checkpoints.length && points.length>1,'gpx_checkpoint_count');
  return points.map((p,i)=>({...p,...side.checkpoints[i]}));
}
export async function fix(point) { await adb('emu','geo','fix',String(point.lng),String(point.lat)); }
export async function replay(name,onPoint=async()=>{},beforePoint=async()=>{}) {
  const points=await gpx(name);const start=performance.now();
  for(const point of points){
    const delay=point.time-points[0].time-(performance.now()-start);
    if(delay>0)await new Promise(resolve=>setTimeout(resolve,delay));
    await beforePoint(point);
    await fix(point);await onPoint(point);
  }
}
