import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require = createRequire('/home/user/Meta-Hackathon/app/package.json');
const {chromium} = require('@playwright/test');
let b; try { b = await chromium.launch(); } catch { b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
const p = await b.newPage(); await p.goto('http://127.0.0.1:8811/index.html');
const d = await p.evaluate(() => ({cues: window.CUES, duration: window.DURATION}));
writeFileSync('/home/user/sfvideo/audio/cues.json', JSON.stringify(d, null, 1)); console.log(d.cues.length, d.duration); await b.close();
