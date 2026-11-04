import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {browserScenario} from './browser-scenarios.ts';

const args=process.argv.slice(2);
const scenario=args[args.indexOf('--scenario')+1];
if(!['full','states','serve'].includes(scenario)||args[args.indexOf('--mode')+1]!=='mock')throw new Error('Expected --scenario full|states|serve --mode mock');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const fixtureRoot=resolve(process.env.SF_UI_FIXTURE_ROOT??resolve(root,'verification/fixtures'));
const output=resolve(root,'verification/results/2026-11-04-s08-ui',scenario);
await stat(resolve(fixtureRoot,'store/e2e.json'));
await mkdir(output,{recursive:true});
const fixtures=createServer(async(request,response)=>{
  response.setHeader('Access-Control-Allow-Origin','*');
  try {
    const path=resolve(fixtureRoot,decodeURIComponent(new URL(request.url??'/', 'http://localhost').pathname).slice(1));
    if(!path.startsWith(fixtureRoot+sep))throw new Error('Outside fixture root');
    const bytes=await readFile(path);
    response.setHeader('Content-Type',extname(path)==='.png'?'image/png':extname(path)==='.json'?'application/json':'application/octet-stream');response.end(bytes);
  }catch {response.writeHead(404);response.end('Fixture unavailable');}
});
fixtures.listen(0,'127.0.0.1');await once(fixtures,'listening');
const fixtureAddress=fixtures.address();
if(!fixtureAddress||typeof fixtureAddress==='string')throw new Error('No fixture server address');
const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');
const address=reserve.address();if(!address||typeof address==='string')throw new Error('No browser server address');const port=address.port;
const reservedClosed=once(reserve,'close');reserve.close();await reservedClosed;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:resolve(root,'app'),env:{...process.env,VITE_SF_RUNTIME:'web-mock',VITE_SF_RELAY_MODE:'mock',VITE_SF_WEB_FIXTURES:`http://127.0.0.1:${fixtureAddress.port}`},stdio:['ignore','pipe','pipe']});
let serverLog='';server.stdout.on('data',bytes=>{serverLog+=String(bytes);});server.stderr.on('data',bytes=>{serverLog+=String(bytes);});
const url=`http://127.0.0.1:${port}`;
try {
  let ready=false;
  for(let attempt=0;attempt<100;attempt++){
    if(server.exitCode!==null)throw new Error('Vite exited before readiness');
    try {if((await fetch(url)).ok){ready=true;break;}}catch { /* Readiness only, never product success timing. */ }
    await delay(100);
  }
  if(!ready)throw new Error('Vite readiness deadline exceeded');
  console.log(`WEB_MOCK_URL=${url}`);
  if(scenario==='serve')await new Promise<void>(()=>{});
  const code=browserScenario(scenario as 'full'|'states',url);
  const run=spawn('aside',['repl',code],{cwd:root,stdio:['ignore','pipe','pipe']});let stdout='';let stderr='';
  run.stdout.on('data',bytes=>{stdout+=String(bytes);});run.stderr.on('data',bytes=>{stderr+=String(bytes);});
  const [status]=await once(run,'close');
  await writeFile(resolve(output,'browser.log'),stdout.replace(/SF_SCREENSHOT:[^\n]+/g,'[Screenshot captured separately]')+stderr);
  for(const line of stdout.split('\n'))if(line.startsWith('SF_SCREENSHOT:')){const shot: {name:string;data:string}=JSON.parse(line.slice('SF_SCREENSHOT:'.length));await writeFile(resolve(output,`${shot.name}.png`),Buffer.from(shot.data,'base64'));}
  const evidenceLine=stdout.split('\n').find(line=>line.startsWith('SF_EVIDENCE:'));
  if(status!==0||!evidenceLine)throw new Error(`Aside scenario failed (exit ${status}); see ${output}/browser.log`);
  const evidence=JSON.parse(evidenceLine.slice('SF_EVIDENCE:'.length));
  if(!Array.isArray(evidence.routes)||evidence.routes.length===0||evidence.passed!==true)throw new Error('No successful route assertions');
  await writeFile(resolve(output,'matrix.json'),JSON.stringify({...evidence,engine:'Aside browser',fixtureRoot,approval:'Prototype layout/copy session not performed; visual approval pending',nativeIntegration:'Not claimed by browser-only contract adapter'},null,2)+'\n');
  console.log(`${scenario}: PASS; ${evidence.routes.length} routes; evidence ${output}`);
}finally {
  server.kill('SIGTERM');fixtures.close();
  await writeFile(resolve(output,'server.log'),serverLog);
}
