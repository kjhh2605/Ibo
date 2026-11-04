import {createRequire} from 'node:module';
import {fileURLToPath as __f} from 'node:url'; import {dirname as __d, resolve as __r} from 'node:path'; import {mkdirSync as __mk} from 'node:fs';
const VIDEO = __r(__d(__f(import.meta.url)), '..'), REPO = __r(VIDEO, '..');
const COMP_URL = process.env.COMP_URL ?? 'http://127.0.0.1:8811';
const require = createRequire(__r(REPO, 'app/package.json'));
const {chromium} = require('@playwright/test');
let b; try { b = await chromium.launch(); } catch { b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
const p = await b.newPage({viewport: {width: 2600, height: 1600}, deviceScaleFactor: 2});
await p.goto(COMP_URL + '/maprender.html'); await p.waitForFunction(() => window.done); await p.waitForTimeout(300);
await p.screenshot({path: __r(VIDEO, 'comp/assets/dongmyo-map.png')}); await b.close();
