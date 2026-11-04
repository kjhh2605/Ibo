// Drives the Ibo web-mock build (PR #8 UI) and captures stills/bursts + tap points for the video.
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath as __f} from 'node:url'; import {dirname as __d, resolve as __r} from 'node:path'; import {mkdirSync as __mk} from 'node:fs';
const VIDEO = __r(__d(__f(import.meta.url)), '..'), REPO = __r(VIDEO, '..');
const COMP_URL = process.env.COMP_URL ?? 'http://127.0.0.1:8811';
const require = createRequire(__r(REPO, 'app/package.json'));
const {chromium, expect} = require('@playwright/test');

const url = process.argv[2];
const out = process.env.SHOTS_DIR ?? __r(VIDEO, 'comp/assets/shots');
await mkdir(out, {recursive: true});
const W = 412, H = 915;
let browser;
try { browser = await chromium.launch({headless: true}); }
catch { browser = await chromium.launch({headless: true, executablePath: '/opt/pw-browsers/chromium'}); }
const loc = {latitude: 37.5454, longitude: 127.0555, accuracy: 5};
const context = await browser.newContext({viewport: {width: W, height: H}, deviceScaleFactor: 2, permissions: ['geolocation'], geolocation: loc, reducedMotion: 'no-preference'});
const page = await context.newPage();
const meta = {stills: {}, bursts: {}, taps: {}};
const inspect = () => page.evaluate(async () => window.__sfVerification ? window.__sfVerification.inspect() : {route: null, ids: {photos: [], pieces: []}, agent: {}, fitting: {}, walk: null});
const button = (name) => page.getByRole('button', {name, exact: typeof name === 'string'}).first();

async function still(name, wait = 450) {
  await page.waitForTimeout(wait);
  await page.screenshot({path: resolve(out, `${name}.png`)});
  meta.stills[name] = `${name}.png`;
  console.log('still', name);
}
async function burst(name, ms, until) {
  const dir = resolve(out, name); await mkdir(dir, {recursive: true});
  const t0 = Date.now(); const frames = [];
  let i = 0;
  while (Date.now() - t0 < ms) {
    const t = Date.now() - t0;
    const f = `${String(i).padStart(4, '0')}.jpg`;
    await page.screenshot({path: resolve(dir, f), type: 'jpeg', quality: 88});
    frames.push({f, t}); i++;
    if (until && t > 600 && await until()) { break; }
  }
  meta.bursts[name] = {dir: name, frames};
  console.log('burst', name, frames.length);
}
async function tap(name, locator, label) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box) meta.taps[label ?? (typeof name === 'string' ? name : String(name))] = {x: (box.x + box.width / 2) / W, y: (box.y + box.height / 2) / H};
  await locator.click();
}
const click = (name, label) => tap(name, button(name), label);
const confirm = async (name) => { await page.locator('dialog[open]').getByRole('button', {name, exact: true}).click(); };
const routeIs = (n) => expect.poll(async () => (await inspect()).route, {timeout: 20000}).toBe(n);


async function rename(name, cat) {
  await click('Rename'); await page.waitForTimeout(500);
  const d = page.locator('dialog[open]');
  await d.getByRole('textbox', {name: 'Name'}).fill(name); await d.getByRole('textbox', {name: 'Category'}).fill(cat);
  await d.getByRole('button', {name: 'Save', exact: true}).click(); await page.waitForTimeout(700);
}
try {
  await page.goto(url); await routeIs('home'); await page.waitForTimeout(1200);
  await click('Start shopping'); await routeIs('capture'); await page.waitForTimeout(900);
  await click('Storefront photo'); await click('Capture storefront'); await page.waitForTimeout(500); await click('Take photo');
  await expect.poll(async () => (await inspect()).ids.photos.length).toBe(9);
  await page.goto(url); await routeIs('home'); await page.waitForTimeout(1200);
  await tap('End shopping', button('End shopping')); await page.waitForTimeout(500); await confirm('End shopping'); await routeIs('home');
  await click('Find it'); await routeIs('ask'); await still('d05-ask', 600);
  await tap('Speak', button('Speak'), 'Speak');
  await burst('d05-voice-search', 14000, async () => (await inspect()).agent.status === 'results');
  await still('d05b-results', 900); await page.mouse.wheel(0, 380); await still('d05c-results-scrolled', 700); await page.mouse.wheel(0, -2000); await page.waitForTimeout(400);
  await click('Best match'); await routeIs('pick'); await page.waitForTimeout(1200);
  const retry = page.getByRole('button', {name: 'Try again', exact: true}).first();
  if (await retry.count()) { await retry.click(); await page.waitForTimeout(1500); }
  await still('c06-pick', 500);
  await page.mouse.wheel(0, 450); await still('c06b-pick-scrolled', 600);
  await click('Use this item'); await routeIs('item'); await page.waitForTimeout(800);
  await rename('Blue work jacket', 'jacket');
  await page.waitForTimeout(4500);
  await page.mouse.wheel(0, -2000); await still('d07-item', 700);
  await page.mouse.wheel(0, 450); await still('d07b-item-scrolled', 600);
  await page.goto(url); await routeIs('home'); await page.waitForTimeout(1500);
  await page.mouse.wheel(0, 900); await still('d10-home-saved', 900);
} catch (e) {
  console.error('FAILED', e.message);
  await page.screenshot({path: resolve(out, 'zz-failure2.png')});
} finally {
  await writeFile(resolve(out, 'meta3.json'), JSON.stringify(meta, null, 2));
  await context.close(); await browser.close();
}
