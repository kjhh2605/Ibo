import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {fileURLToPath as __f} from 'node:url'; import {dirname as __d, resolve as __r} from 'node:path'; import {mkdirSync as __mk} from 'node:fs';
const VIDEO = __r(__d(__f(import.meta.url)), '..'), REPO = __r(VIDEO, '..');
const COMP_URL = process.env.COMP_URL ?? 'http://127.0.0.1:8811';
const require = createRequire(__r(REPO, 'app/package.json'));
const {chromium} = require('@playwright/test');
const [start, end, out] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const FPS = 30;
let b; try { b = await chromium.launch(); } catch { b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
const page = await b.newPage({viewport: {width: 1920, height: 1080}});
await page.goto(COMP_URL + '/index.html');
await page.evaluate(() => window.ready);
const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], {stdio: ['pipe', 'inherit', 'inherit']});
await page.evaluate(t => window.seek(t), Math.max(0, start / FPS - 0.5));
const t0 = Date.now();
for (let f = start; f < end; f++) {
  await page.evaluate(t => window.seek(t), f / FPS);
  const buf = await page.screenshot({type: 'jpeg', quality: 95});
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if ((f - start) % 300 === 0) console.log(out, f, ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await b.close();
console.log('done', out, ((Date.now() - t0) / 1000).toFixed(1));
