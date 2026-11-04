import {createRequire} from 'node:module';
import {fileURLToPath as __f} from 'node:url'; import {dirname as __d, resolve as __r} from 'node:path'; import {mkdirSync as __mk} from 'node:fs';
const VIDEO = __r(__d(__f(import.meta.url)), '..'), REPO = __r(VIDEO, '..');
const COMP_URL = process.env.COMP_URL ?? 'http://127.0.0.1:8811';
const require = createRequire(__r(REPO, 'app/package.json'));
const {chromium} = require('@playwright/test');
const [src, out, w, h] = process.argv.slice(2);
let b; try { b = await chromium.launch(); } catch { b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
const p = await b.newPage({viewport: {width: +w, height: +h}});
await p.goto('file://' + src); await p.screenshot({path: out}); await b.close();
