#!/usr/bin/env node
/**
 * Private Android demo installation, NOT a web-mock or acceptance fixture.
 * Dry run: node scripts/e2e/seed-demo.mjs
 * Install: ANDROID_SERIAL=emulator-5554 bash scripts/emulator-lock.sh node scripts/e2e/seed-demo.mjs --apply
 * Optional real native self registration, only if empty: add --self-if-empty
 * Owned-data rollback: same command with --rollback instead of --apply.
 * Requires rebuilt debug APK, native PE/EdgeTAM model assets, running idle app.
 * Do not operate the app concurrently. Existing self/results are never removed.
 * Build with VITE_SF_RELAY_MODE=live and the actual VITE_SF_RELAY_URL to search
 * these real persisted photos through the live relay. This tool changes neither.
 */
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = path.join(root, 'verification/fixtures');
const prefix = 'demo_street_fitting_v1_';
const args = process.argv.slice(2);
const flags = new Set(args);
const allowed = new Set(['--apply', '--rollback', '--dry-run', '--self-if-empty', '--help']);
function check(ok, code) { if (!ok) throw new Error(code); }
check(args.every(arg => allowed.has(arg)), 'unknown_seed_option');
check(!(flags.has('--apply') && flags.has('--rollback')), 'conflicting_seed_operations');
check(!(flags.has('--dry-run') && (flags.has('--apply') || flags.has('--rollback'))), 'conflicting_seed_operations');
check(!flags.has('--rollback') || !flags.has('--self-if-empty'), 'rollback_never_changes_self');
const id = name => prefix + name;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const provenance = {
  dataset: 'Street Fitting private synthetic exploration demo v1',
  imageSources: ['verification/fixtures/source/generation.json', 'verification/fixtures/source/derivations.json'],
  humanApprovalClaimed: false, publicUseApprovalClaimed: false,
  locationsAndVisitTimes: 'Invented Seoul shopping visits, not observed GPS or real shop endorsements',
  labels: 'Human-readable demo names authored by tooling, not claimed as live AI descriptions',
  masks: 'Actual native EdgeTAM tap outputs; jeans reuses hash-verified exported actual native output',
  embeddings: 'Computed and committed by the real native PhotoIndex PE-Core plugin; no supplied vectors',
  results: 'No generated results inserted; no provider success fabricated',
};
const labels = [
  [['Blue denim jacket', 'outerwear'], ['Sand wide-leg trousers', 'bottom'], ['White bow blouse', 'top'], ['Black long skirt', 'bottom']],
  [['Blue striped shirt', 'top'], ['Tan utility jacket', 'outerwear'], ['Navy tailored trousers', 'bottom'], ['Cream crewneck sweater', 'top']],
  [['Grey double-breasted coat', 'outerwear'], ['Burgundy knit sweater', 'top'], ['White button-down shirt', 'top'], ['Black straight trousers', 'bottom']],
];
const visits = [
  {day: '2026-10-31', time: '04:00:00Z', area: 'Seongsu Saturday', lat: 37.5448, lng: 127.0555},
  {day: '2026-11-02', time: '06:00:00Z', area: 'Seongsu Monday', lat: 37.5460, lng: 127.0532},
  {day: '2026-11-04', time: '05:00:00Z', area: 'Seongsu Wednesday', lat: 37.5427, lng: 127.0570},
];
const trips = [], shops = [], photos = [], pieces = [], wardrobe = [];
for (let t = 0; t < visits.length; t++) {
  const visit = visits[t], start = Date.parse(`${visit.day}T${visit.time}`), tripId = id(`trip_${t + 1}`);
  trips.push({id: tripId, startedAt: start, endedAt: start + 95 * 60000});
  for (let s = 0; s < 3; s++) {
    const shopId = id(`trip_${t + 1}_shop_${s + 1}`), at = start + s * 30 * 60000;
    const spot = {lat: visit.lat + s * 0.00035, lng: visit.lng + s * 0.0004, accuracyM: 5};
    shops.push({id: shopId, tripId, n: s + 1, startedAt: at, spot,
      note: `[Synthetic demo] ${visit.area} / ${['Blue awning studio: denim and soft neutrals', 'Brick vintage corner: stripes and utility layers', 'Quiet tailoring room: wool and burgundy'][s]}. Invented visit; images unreviewed.`});
    const location = {...spot, lat: spot.lat + 0.00008, lng: spot.lng - 0.00005};
    const sources = [
      ['storefront', `images/storefronts/shop-${s + 1}.png`, 'storefront'],
      ['rail', `images/shops/shop-${s + 1}-items.png`, 'item'],
      ['detail_1', `images/derived/shop-${s + 1}-candidate-${(t % 4) + 1}.png`, 'item'],
      ['detail_2', `images/derived/shop-${s + 1}-candidate-${((t + 1) % 4) + 1}.png`, 'item'],
    ];
    for (let p = 0; p < sources.length; p++) {
      const [suffix, image, kind] = sources[p];
      photos.push({id: id(`trip_${t + 1}_shop_${s + 1}_${suffix}`), tripId, shopId, kind, takenAt: at + (p + 1) * 60000, location, image});
    }
    // Twelve saved pieces across nine shops, not 36 near-duplicate saves.
    const indices = t === 0 ? [0, 1] : [t + 1];
    for (const index of indices) pieces.push({slot: id(`saved_${t + 1}_${s + 1}_${index + 1}`), photoId: id(`trip_${t + 1}_shop_${s + 1}_rail`), image: `images/shops/shop-${s + 1}-items.png`, tap: [(39 + index * 77) / 310, 178 / 310], label: `[Demo] ${labels[s][index][0]}`, category: labels[s][index][1], origin: 'shop'});
  }
}
for (const [key, image, label, category] of [
  ['jeans', 'images/wardrobe/jeans-original.png', 'Blue everyday jeans', 'bottom'],
  ['shoes', 'images/wardrobe/shoes-original.png', 'White low-top sneakers', 'shoes'],
  ['jacket', 'images/derived/shop-1-candidate-1.png', 'Blue denim layer', 'outerwear'],
  ['blouse', 'images/derived/shop-1-candidate-3.png', 'White bow blouse', 'top'],
  ['knit', 'images/derived/shop-2-candidate-4.png', 'Cream knit', 'top'],
  ['coat', 'images/derived/shop-3-candidate-1.png', 'Grey wool coat', 'outerwear'],
]) wardrobe.push({slot: id(`wardrobe_${key}`), assetId: id(`asset_${key}`), image, label: `[Demo] ${label}`, category, tap: [0.5, 0.5], origin: 'wardrobe'});

async function assets() {
  const manifest = JSON.parse(await readFile(path.join(fixture, 'manifest.json'), 'utf8'));
  const images = new Set([...photos, ...wardrobe].map(item => item.image));
  if (flags.has('--self-if-empty')) images.add('images/self/positive/calibration-hat.png');
  const result = new Map();
  for (const image of images) {
    const bytes = await readFile(path.join(fixture, image)), digest = hash(bytes);
    check(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'seed_requires_png');
    const metadata = manifest.assets.find(item => item.path === image);
    check(metadata && metadata.sha256 === digest, 'seed_asset_manifest_mismatch');
    result.set(image, {image, sha256: digest, w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20), sourceType: metadata.sourceType});
  }
  return result;
}
async function run() {
  if (flags.has('--help')) return {usage: 'node scripts/e2e/seed-demo.mjs [--dry-run | --apply [--self-if-empty] | --rollback]', prerequisites: 'Rebuild/update-install debug APK without uninstalling; live relay config; models; idle Android WebView; ANDROID_SERIAL; emulator-lock.sh. Default is device-free dry run.'};
  const inventory = flags.has('--rollback') ? new Map() : await assets();
  const plan = {namespace: prefix, counts: {trips: trips.length, shops: shops.length, photos: photos.length, itemPhotos: photos.filter(p => p.kind === 'item').length, savedPieces: pieces.length, wardrobePieces: wardrobe.length, uniqueImages: inventory.size, generatedResults: 0}, ids: {trips: trips.map(x => x.id), shops: shops.map(x => x.id), photos: photos.map(x => x.id), savedSlots: pieces.map(x => x.slot), wardrobeSlots: wardrobe.map(x => x.slot)}, provenance, assets: [...inventory.values()]};
  if (!flags.has('--apply') && !flags.has('--rollback')) return {status: 'dry-run', deviceTouched: false, ...plan};
  check(process.env.ANDROID_SERIAL, 'ANDROID_SERIAL_required');
  const {adb, connect, native, list, stage} = await import('./android.mjs');
  // A backgrounded WebView may expose a socket but not answer CDP. Use a
  // normal launcher intent, never the camera/voice fixture launch helpers.
  await adb('shell', 'am', 'start', '-W', '-n', 'com.streetfitting.app/.MainActivity');
  const {device, page} = await connect();
  const staged = new Set();
  const call = options => native(page, 'Store', 'debugDemoFixture', options);
  const lookup = async (entity, slot) => (await call({action: 'lookup', entity, slot})).item;
  async function file(image) {
    const local = await stage(image, 'demo-fixtures'); staged.add(local);
    return `file://${local}`;
  }
  async function importRecord(entity, slot, payload) {
    const old = await lookup(entity, slot);
    if (old) return old;
    return (await call({action: 'import', entity, slot, ...payload})).item;
  }
  async function savePiece(spec, asset) {
    if (await lookup('Piece', spec.slot)) return;
    let mask, prepared;
    try {
      if (spec.assetId === id('asset_jeans')) {
        const base = path.join(root, 'verification/native-proof');
        const report = JSON.parse(await readFile(path.join(base, 'person-mask-export-after.json'), 'utf8'));
        const source = report.cases.find(row => row.id === 'wardrobe-jeans');
        check(source?.sourceSha256 === inventory.get(spec.image).sha256 && source.w === asset.w && source.h === asset.h, 'real_jeans_mask_source_mismatch');
        const recorded = source.masks[0];
        const bytes = await readFile(path.join(base, recorded.png));
        check(hash(bytes) === recorded.pngSha256, 'real_jeans_mask_hash_mismatch');
        // Existing fixture staging only accepts fixture-relative paths, so
        // this exact exported PNG is written through the Android Filesystem
        // plugin into private cache; it never reaches shared device storage.
        const written = await native(page, 'Filesystem', 'writeFile', {path: `demo-fixtures/${recorded.pngSha256}.png`, directory: 'CACHE', data: bytes.toString('base64'), recursive: true});
        const raw = written.uri.replace(/^file:\/\//, ''); staged.add(raw);
        mask = {mask: written.uri, score: recorded.score, bbox: recorded.bboxPixels};
      } else {
        prepared = await native(page, 'Segmenter', 'prepare', {asset});
        const output = await native(page, 'Segmenter', 'tap', {handle: prepared.handle, x: spec.tap[0], y: spec.tap[1]});
        check(output.masks?.length === 3, 'native_three_masks_required');
        const choice = output.masks[0];
        mask = {...choice, bbox: choice.bbox.map((v, index) => Math.round(v * (index % 2 === 0 ? asset.w : asset.h)))};
      }
      await importRecord('Piece', spec.slot, {candidate: {...mask, photoId: asset.id, source: 'edgetam', label: spec.label}, origin: spec.origin, labelMode: spec.origin === 'wardrobe' ? 'describe' : 'concept', label: spec.label, category: spec.category});
    } finally {
      if (prepared) await native(page, 'Segmenter', 'release', {handle: prepared.handle});
    }
  }
  try {
    check((await native(page, 'Store', 'getRuntimeInfo')).debug === true, 'debug_apk_required');
    const selfBefore = await native(page, 'Store', 'getSelfPhoto');
    const resultIdsBefore = (await list(page, 'Result')).map(row => row.id).sort();
    let selfRegistration = {status: selfBefore ? 'existing-self-preserved' : 'not-requested'};
    if (flags.has('--rollback')) {
      const removed = await call({action: 'rollback'});
      check(JSON.stringify(await native(page, 'Store', 'getSelfPhoto')) === JSON.stringify(selfBefore), 'rollback_changed_self');
      check(JSON.stringify((await list(page, 'Result')).map(row => row.id).sort()) === JSON.stringify(resultIdsBefore), 'rollback_changed_results');
      return {status: 'rolled-back', namespace: prefix, removed: removed.entries, selfPreserved: true, resultsPreserved: true, note: 'Optional demo self is deliberately retained; rollback never removes any self or user results.'};
    }
    for (const trip of trips) await importRecord('Trip', trip.id, {record: trip});
    for (const shop of shops) await importRecord('Shop', shop.id, {record: shop});
    for (const photo of photos) {
      let stored = await lookup('Photo', photo.id);
      if (!stored) {
        const {w, h} = inventory.get(photo.image);
        const {image, ...record} = photo;
        stored = await importRecord('Photo', photo.id, {photo: {...record, w, h, file: await file(image)}});
      }
      // Plugin computes/persists genuine PE-Core output, including on rerun
      // after an interrupted install. Existing successful vectors are reused.
      await native(page, 'PhotoIndex', 'index', {photoId: stored.id});
    }
    for (const spec of pieces) {
      if (await lookup('Piece', spec.slot)) continue;
      const stored = await native(page, 'Store', 'get', {entity: 'Photo', id: spec.photoId});
      await savePiece(spec, {id: stored.id, file: stored.file, w: stored.w, h: stored.h});
    }
    for (const spec of wardrobe) {
      if (await lookup('Piece', spec.slot)) continue;
      let asset = await lookup('Asset', spec.assetId);
      if (!asset) {
        const {w, h} = inventory.get(spec.image);
        asset = await importRecord('Asset', spec.assetId, {asset: {id: spec.assetId, file: await file(spec.image), w, h}, purpose: 'wardrobe'});
      }
      await savePiece(spec, {id: asset.id, file: asset.file, w: asset.w, h: asset.h});
    }
    if (flags.has('--self-if-empty') && !selfBefore) {
      const image = 'images/self/positive/calibration-hat.png', {w, h} = inventory.get(image);
      const source = await file(image);
      check(!(await native(page, 'Store', 'getSelfPhoto')), 'self_appeared_during_seed');
      const registration = await native(page, 'FaceMask', 'register', {asset: {id: id('optional_self'), file: source, w, h}});
      check(registration.ok === true, 'demo_self_native_registration_rejected');
      selfRegistration = {status: 'registered-synthetic-self-with-native-masking', humanApprovalClaimed: false, privacyQualityApprovalClaimed: false, updatedAt: registration.selfPhoto.updatedAt};
    } else {
      check(JSON.stringify(await native(page, 'Store', 'getSelfPhoto')) === JSON.stringify(selfBefore), 'seed_changed_existing_self');
    }
    check(JSON.stringify((await list(page, 'Result')).map(row => row.id).sort()) === JSON.stringify(resultIdsBefore), 'seed_changed_results');
    const owned = await call({action: 'status'});
    const saved = (await list(page, 'Piece')).filter(row => owned.entries.some(entry => entry.entity === 'Piece' && entry.id === row.id));
    const seededPhotos = (await list(page, 'Photo')).filter(row => row.id.startsWith(prefix));
    check(seededPhotos.length === photos.length && seededPhotos.every(row => row.indexState === 'done'), 'demo_index_incomplete');
    check(saved.length === pieces.length + wardrobe.length, 'demo_pieces_incomplete');
    check(saved.filter(row => row.origin === 'shop').every(row => row.walkTo && row.photoId?.startsWith(prefix)), 'demo_walk_destinations_missing');
    return {status: 'seeded', ...plan, installed: owned.entries, savedPieceIds: saved.map(row => ({id: row.id, label: row.label, origin: row.origin})), nativeIndexedPhotos: seededPhotos.length, existingResultsPreserved: true, selfRegistration, relayConfigurationChanged: false, searchScope: 'Native Store item photos with real PE-Core vectors; live search still requires authenticated running live relay. No search API success is asserted by seeding.'};
  } finally {
    for (const local of staged) {
      const marker = '/cache/demo-fixtures/', at = local.indexOf(marker);
      if (at < 0) continue;
      const name = local.slice(at + marker.length);
      if (/^[a-f0-9]{64}\.png$/.test(name)) await adb('shell', 'run-as', 'com.streetfitting.app', 'rm', '-f', `cache/demo-fixtures/${name}`);
    }
    await device.close();
  }
}
try {
  const report = await run();
  if (process.env.SF_DEMO_REPORT) await writeFile(process.env.SF_DEMO_REPORT, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} catch (error) {
  // Never echo Playwright DOM, private paths, tokens or provider payloads.
  const message = error?.code || error?.message || '';
  process.stdout.write(JSON.stringify({status: 'failed', code: /^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(message) ? message : 'demo_seed_failed', retry: 'Rerun the same --apply command to resume; --rollback removes only tracked demo entities and never any self/results.'}) + '\n');
  process.exitCode = 1;
}
