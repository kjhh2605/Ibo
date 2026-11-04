// Run with a VITE_SF_RUNTIME=web-mock Vite server. No provider/native/model success is implied.
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';

const origin = process.env.S07_APP_ORIGIN ?? 'http://127.0.0.1:5173';
const requests = [];
let selected = [];
let mask;
let turns = 0;
const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-SF-Fixture');
  response.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') { response.end(); return; }
  if (request.method === 'GET') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>S07 explicit mock controller smoke</title>'); return; }
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  requests.push({path: request.url, body});
  let result;
  if (request.url === '/v1/search/segment') {
    result = {queryToken: 'smoke-segment', photos: body.photos.map(photo => ({photoRef: photo.photoRef, candidates: [0.9, 0.8, 0.7, 0.1].map((score, i) => ({id: `provider-${i}`, label: body.concept, score, bbox: [1, 0, 1, 2], mask: {mimeType: 'image/png', data: mask, width: 2, height: 2}}))}))};
  } else {
    turns++;
    if (turns === 1) result = {queryToken: 'smoke-1', toolCalls: [{id: 'list', name: 'list_visits', arguments: {}}]};
    else if (turns === 2) result = {queryToken: 'smoke-2', toolCalls: [{id: 'find', name: 'find_photos', arguments: {phrase: 'jacket', shopRefs: [body.toolResults[0].result.visits[0].shopRef]}, phraseVector: [1, ...Array(511).fill(0)]}]};
    else if (turns === 3) { selected = body.toolResults[0].result.map(photo => photo.photoRef); result = {queryToken: 'smoke-3', toolCalls: [{id: 'extract', name: 'extract_items', arguments: {concept: 'jacket', photoRefs: selected}}]}; }
    else result = {queryToken: 'smoke-4', final: {photoRefs: selected, concept: 'jacket', summary: 'Four jacket candidates.'}};
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(result));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const browser = await chromium.launch({headless: true});
try {
  const page = await browser.newPage();
  // Actual loopback HTML preserves Chromium address-space classification and excludes
  // Vite's HMR client. Only the tested modules are loaded from the development server.
  const baseUrl = `http://127.0.0.1:${port}`;
  await page.goto(baseUrl);
  mask = await page.evaluate(async appOrigin => {
    const {binaryPNG} = await import(`${appOrigin}/src/agent/media.ts`);
    const {base64} = await import(`${appOrigin}/src/agent/wire.ts`);
    return base64(await binaryPNG(new Uint8Array([0, 255, 0, 255]), 2, 2));
  }, origin);
  const proof = await page.evaluate(async ({baseUrl, appOrigin}) => {
    const {createAgentController} = await import(`${appOrigin}/src/agent/controller.ts`);
    const {createAgentMedia} = await import(`${appOrigin}/src/agent/media.ts`);
    const {createRelayClient} = await import(`${appOrigin}/src/relay/client.ts`);
    const files = new Map();
    const canvas = new OffscreenCanvas(4, 4);
    canvas.getContext('2d').fillRect(0, 0, 4, 4);
    files.set('original-shop', new Uint8Array(await (await canvas.convertToBlob({type: 'image/png'})).arrayBuffer()));
    const t = Date.parse('2026-10-31T13:00:00+09:00');
    const trip = {id: 'local-trip', startedAt: t, endedAt: t + 3600000, status: 'ended'};
    const shop = {id: 'local-shop', tripId: trip.id, n: 2, startedAt: t, spot: {lat: 37.123456, lng: 127.123456, accuracy: 1, at: t}, storefrontPhotoId: null, descriptionState: 'done', description: 'Blue sign', note: 'jacket visit'};
    const photo = {id: 'local-photo', tripId: trip.id, shopId: shop.id, kind: 'item', takenAt: t + 1000, location: shop.spot, file: 'original-shop', w: 4, h: 4, indexState: 'done'};
    const records = {Trip: [trip], Shop: [shop], Photo: [photo]};
    let writes = 0;
    const media = createAgentMedia({readBytes: async file => files.get(file), writeTemp: async ({bytes, ownerId}) => { if (ownerId !== photo.id) throw new Error('Missing candidate owner'); const file = `cache/candidates/${++writes}.png`; files.set(file, bytes); return file; }, discard: async file => { files.delete(file); }});
    const controller = createAgentController({
      store: {get: async ({entity, id}) => records[entity].find(value => value.id === id) ?? null, list: async ({entity}) => ({items: records[entity], nextCursor: null}), addListener: async () => ({remove: async () => {}})},
      photoIndex: {search: async ({photoIds}) => photoIds.map(photoId => ({photoId, score: 0.2}))},
      voice: {start: async () => { throw new Error('Voice not exercised'); }, stop: async () => { throw new Error('Voice not exercised'); }, cancel: async () => {}, addListener: async () => ({remove: async () => {}})},
      relay: createRelayClient({baseUrl, mockTransport: fetch}), media, isOnline: async () => true,
    });
    const stages = [];
    controller.subscribe(() => { if (controller.getState().stage) stages.push(controller.getState().stage); });
    await controller.submit('jacket');
    const state = controller.getState();
    if (state.status !== 'results') throw new Error(`Unexpected controller status ${state.status}: ${state.error?.code}`);
    const first = state.candidates[0];
    const bytes = files.get(first.mask);
    const bitmap = await createImageBitmap(new Blob([bytes]));
    const maskCanvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    maskCanvas.getContext('2d').drawImage(bitmap, 0, 0);
    const rgba = [...maskCanvas.getContext('2d').getImageData(0, 0, 4, 4).data];
    bitmap.close();
    const result = {status: state.status, photos: state.photos.length, candidates: state.candidates.length, initiallyVisible: state.visibleCandidates.length, bbox: first.bbox, pngBitDepth: bytes[24], pngColorType: bytes[25], maskRGBA: rgba, candidateIdsStable: new Set(state.candidates.map(c => c.id)).size === 1, stages};
    controller.setShowAll(true);
    result.expandedVisible = controller.getState().visibleCandidates.length;
    await controller.dispose();
    result.remainingTempFiles = [...files.keys()].filter(file => file.startsWith('cache/')).length;
    return result;
  }, {baseUrl, appOrigin: origin});
  assert.equal(proof.candidates, 4); assert.equal(proof.initiallyVisible, 3); assert.equal(proof.expandedVisible, 4);
  assert.deepEqual(proof.bbox, [2, 0, 2, 4]); assert.equal(proof.pngBitDepth, 8); assert.equal(proof.pngColorType, 0);
  assert.equal(proof.remainingTempFiles, 0); assert.equal(proof.candidateIdsStable, true);
  assert.equal(turns, 4); assert.equal(requests.filter(r => r.path === '/v1/search/segment').length, 1);
  assert.equal(requests.at(-1).body.queryToken, 'smoke-segment');
  for (const request of requests.filter(r => r.path === '/v1/search/turn')) {
    const raw = JSON.stringify(request.body);
    for (const forbidden of ['local-trip', 'local-shop', 'local-photo', '37.123456', '127.123456', 'original-shop', 'phraseVector', 'bbox', 'mask']) assert.equal(raw.includes(forbidden), false);
  }
  for (const image of requests.find(r => r.path === '/v1/search/segment').body.photos.map(p => p.image)) {
    const bytes = Buffer.from(image.data, 'base64');
    assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
    assert.equal(bytes.includes(Buffer.from('Exif')), false);
  }
  const evidence = {...proof, transport: 'real fetch to explicit local HTTP mock', sparkTurns: turns, samBatches: 1, nativeModelsOrProvidersExercised: false};
  console.log(JSON.stringify(evidence, null, 2));
  if (process.env.S07_EVIDENCE) await writeFile(process.env.S07_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
