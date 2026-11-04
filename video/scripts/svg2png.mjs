import {createRequire} from 'node:module';
const require = createRequire('/home/user/Meta-Hackathon/app/package.json');
const {chromium} = require('@playwright/test');
const [src, out, w, h] = process.argv.slice(2);
let b; try { b = await chromium.launch(); } catch { b = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
const p = await b.newPage({viewport: {width: +w, height: +h}});
await p.goto('file://' + src); await p.screenshot({path: out}); await b.close();
