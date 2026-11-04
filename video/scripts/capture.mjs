// Drives the Ibo web-mock build (PR #8 UI) and captures stills/bursts + tap points for the video.
import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require = createRequire('/home/user/Meta-Hackathon/app/package.json');
const {chromium, expect} = require('@playwright/test');

const url = process.argv[2];
const out = '/home/user/sfvideo/shots';
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
async function rename(name, cat) {
  await click('Rename'); await page.waitForTimeout(500);
  const d = page.locator('dialog[open]');
  await d.getByRole('textbox', {name: 'Name'}).fill(name); await d.getByRole('textbox', {name: 'Category'}).fill(cat);
  await d.getByRole('button', {name: 'Save', exact: true}).click(); await page.waitForTimeout(4500);
}
const confirm = async (name) => { await page.locator('dialog[open]').getByRole('button', {name, exact: true}).click(); };
const routeIs = (n) => expect.poll(async () => (await inspect()).route, {timeout: 20000}).toBe(n);

try {
  await page.goto(url); await routeIs('home');
  await still('01-home', 1500);
  await burst('b01-home-enter', 1200);
  await click('Start shopping'); await routeIs('capture');
  await still('02-capture', 1200);
  await click('Storefront photo'); await still('02b-storefront-mode', 600);
  await click('Capture storefront'); await still('02c-after-storefront', 800);
  await click('Take photo'); await still('02d-after-photo', 900);
  await expect.poll(async () => (await inspect()).ids.photos.length).toBe(9);
  await click('Back'); await routeIs('home').catch(() => {});
  await still('03-home-shopping', 900);
  await page.goto(url); await routeIs('home');
  await still('03b-home-shopping-reload', 1500);
  // End shopping from home or capture
  const end = button('End shopping');
  if (await end.count()) { await tap('End shopping', end); await still('03c-end-sheet', 600); await confirm('End shopping'); }
  await routeIs('home'); await still('04-home-ended', 900);

  await click('Find it'); await routeIs('ask'); await still('05-ask', 700);
  await tap('Speak', button('Speak'), 'Speak');
  await burst('b05-voice-search', 14000, async () => (await inspect()).agent.status === 'results');
  await still('05b-results-top', 800);
  await page.mouse.wheel(0, 380); await still('05c-results-scrolled', 700);
  await click('Best match'); await routeIs('pick');
  await burst('b06-pick-enter', 1500);
  await still('06-pick', 300);
  await page.mouse.wheel(0, 600); await still('06b-pick-scrolled', 600);
  const showAll = page.getByRole('button', {name: /^Show all/}).first();
  if (await showAll.count()) { await tap('Show all', showAll); await still('06c-pick-all', 700); }
  await click('Use this item'); await routeIs('item'); await page.waitForTimeout(800);
  await rename('Blue work jacket', 'jacket'); await page.mouse.wheel(0, -2000);
  await still('07-item', 900);
  await page.mouse.wheel(0, 500); await still('07b-item-scrolled', 600);
  await page.mouse.wheel(0, -2000);

  await click('Walk back'); await routeIs('walk');
  await expect.poll(async () => (await inspect()).walk?.mode, {timeout: 20000}).toBe('route');
  await still('08-walk-route', 1200);
  await page.mouse.wheel(0, 500); await still('08b-walk-route-scrolled', 600); await page.mouse.wheel(0, -2000);
  const pin = (await inspect()).walk.destination;
  await context.setGeolocation({latitude: pin.lat + 0.00005, longitude: pin.lng, accuracy: 5});
  await page.waitForTimeout(800);
  if ((await inspect()).walk?.mode === 'error') await click('Try again');
  await expect.poll(async () => (await inspect()).walk?.mode, {timeout: 20000}).toBe('direction');
  await still('08c-walk-direction', 900);
  await page.waitForTimeout(5200);
  await context.setGeolocation({latitude: pin.lat + 0.00004, longitude: pin.lng, accuracy: 5});
  await page.waitForTimeout(800);
  if ((await inspect()).walk?.mode === 'error') await click('Try again');
  await expect.poll(async () => (await inspect()).walk?.mode, {timeout: 20000}).toBe('nearby');
  await still('08d-walk-nearby', 900);
  await page.mouse.wheel(0, 600); await still('08e-walk-nearby-scrolled', 600);
  await click('I found this shop');
  await expect.poll(async () => (await inspect()).walk?.mode).toBe('arrived');
  await still('08f-walk-arrived', 900);
  await click('Done'); await routeIs('item');

  // Wardrobe piece first
  await page.goto(url); await routeIs('home');
  await click('Wardrobe'); await routeIs('wardrobe'); await still('09-wardrobe-empty', 700);
  await click('Add a piece'); await still('09b-add-sheet', 700);
  await click('Choose from gallery'); await routeIs('pick'); await still('09c-wardrobe-pick', 1000);
  const tapItem = page.getByRole('button', {name: /^Tap the item in the photo/});
  await tapItem.click({trial: true});
  const tb = await tapItem.boundingBox(); if (tb) meta.taps['wardrobe-tap'] = {x: (tb.x + tb.width / 2) / W, y: (tb.y + tb.height / 2) / H};
  await tapItem.press('Enter');
  await burst('b09-wardrobe-tap', 1500);
  await still('09d-wardrobe-areas', 300);
  await page.mouse.wheel(0, 600); await still('09e-wardrobe-areas-scrolled', 500);
  await click('Add to wardrobe'); await routeIs('wardrobe');
  await burst('b09-wardrobe-naming', 3000);
  await still('09f-wardrobe-saved', 800);

  // Try-on: target + trip companion + wardrobe companion + self
  await page.goto(url); await routeIs('home');
  await page.mouse.wheel(0, 900); await still('10-home-saved', 700);
  await click('a blue jacket'); await routeIs('item');
  await click('Try it on'); await routeIs('outfit'); await still('11-outfit-empty', 900);
  await click('Add a companion'); await still('11b-companion-sheet', 700);
  await click('From a trip photo'); await routeIs('trips'); await still('11c-trips', 700);
  await button(/Oct 31/).click(); await routeIs('trip'); await still('11d-trip', 900);
  await button(/Open photo/).first().click(); await routeIs('pick'); await still('11e-trip-pick', 900);
  const tapItem2 = page.getByRole('button', {name: /^Tap the item in the photo/});
  await tapItem2.click({trial: true});
  const tb2 = await tapItem2.boundingBox(); if (tb2) meta.taps['trip-tap'] = {x: (tb2.x + tb2.width / 2) / W, y: (tb2.y + tb2.height / 2) / H};
  await tapItem2.press('Enter'); await still('11f-trip-areas', 900);
  await click('Add to outfit'); await routeIs('outfit'); await still('11g-outfit-one', 900);
  await click('Add a companion'); await still('11h-companion-sheet2', 700);
  const wardrobeBtn = page.getByRole('button', {name: /Blue jacket|Jeans|wardrobe/i});
  console.log('sheet buttons', await page.locator('dialog[open] button').allInnerTexts().catch(() => []));
  await click('Add your photo').catch(async () => { await page.keyboard.press('Escape'); await click('Add your photo'); });
  await still('12-self-sheet', 600);
  await click('Choose from gallery');
  await burst('b12-self-mask', 8000, async () => (await inspect()).fitting.selfState === 'ready');
  await expect.poll(async () => (await inspect()).fitting.selfState, {timeout: 30000}).toBe('ready');
  await still('12b-outfit-ready', 900);
  await page.mouse.wheel(0, 500); await still('12c-outfit-ready-scrolled', 600);
  await page.mouse.wheel(0, 1500); await still('12d-outfit-ready-bottom', 600);
  await click('Generate');
  await burst('b13-generate', 12000, async () => (await inspect()).route === 'result');
  await routeIs('result'); await still('13-result', 1200);
  await page.mouse.wheel(0, 600); await still('13b-result-scrolled', 600);
  await page.mouse.wheel(0, 900); await still('13c-result-bottom', 600);

  await page.goto(url); await routeIs('home');
  await click('Privacy'); await routeIs('privacy'); await still('14-privacy', 900);
  await page.mouse.wheel(0, 700); await still('14b-privacy-scrolled', 600);
} catch (e) {
  console.error('FAILED', e.message);
  await page.screenshot({path: resolve(out, 'zz-failure.png')});
} finally {
  await writeFile(resolve(out, 'meta.json'), JSON.stringify(meta, null, 2));
  await context.close(); await browser.close();
}
