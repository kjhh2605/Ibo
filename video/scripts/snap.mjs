import {createRequire} from 'node:module';
const require = createRequire('/home/user/Meta-Hackathon/app/package.json');
const {chromium} = require('@playwright/test');
const times = process.argv.slice(2).map(Number);
let browser; try { browser = await chromium.launch(); } catch { browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium'}); }
const page = await browser.newPage({viewport: {width: 1920, height: 1080}});
page.on('pageerror', e => console.log('PAGEERROR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:8811/index.html');
await page.evaluate(() => window.ready);
for (const t of times) { await page.evaluate(t => window.seek(t), t); await page.waitForTimeout(60); await page.screenshot({path: `/home/user/sfvideo/preview/t${String(t).padStart(6, '0')}.jpg`, type: 'jpeg', quality: 80}); }
console.log('cues', await page.evaluate(() => window.CUES.length));
await browser.close();
