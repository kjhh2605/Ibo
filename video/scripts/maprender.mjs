import {createRequire} from 'node:module';
const require = createRequire('/home/user/Meta-Hackathon/app/package.json');
const {chromium} = require('@playwright/test');
let b; try { b = await chromium.launch(); } catch { b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
const p = await b.newPage({viewport: {width: 2600, height: 1600}, deviceScaleFactor: 2});
await p.goto('http://127.0.0.1:8811/maprender.html'); await p.waitForFunction(() => window.done); await p.waitForTimeout(300);
await p.screenshot({path: '/home/user/sfvideo/comp/assets/dongmyo-map.png'}); await b.close();
