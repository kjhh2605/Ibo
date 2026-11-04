import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {fileURLToPath as __f} from 'node:url'; import {dirname as __d, resolve as __r} from 'node:path'; import {mkdirSync as __mk} from 'node:fs';
const VIDEO = __r(__d(__f(import.meta.url)), '..'), REPO = __r(VIDEO, '..');
const COMP_URL = process.env.COMP_URL ?? 'http://127.0.0.1:8811';
const require = createRequire(__r(REPO, 'app/package.json'));
const {chromium} = require('@playwright/test');
let b; try { b = await chromium.launch(); } catch { b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
const p = await b.newPage(); await p.goto(COMP_URL + '/index.html');
const d = await p.evaluate(() => ({cues: window.CUES, duration: window.DURATION}));
writeFileSync(__r(VIDEO, 'audio/cues.json'), JSON.stringify(d, null, 1)); console.log(d.cues.length, d.duration); await b.close();
