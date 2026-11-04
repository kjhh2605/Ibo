import {describe, expect, it, vi} from 'vitest';
import {SearchRun, SearchTools} from './tools';
import {fixture, photos, vector} from './fixtures';
import {inInterval, interval, serializeTool, validateCall} from './wire';
import {binaryPNG, originalMask} from './media';

const context = {now: '2026-11-04T14:00:00+09:00', timeZone: 'Asia/Seoul'};
function setup() { const f = fixture(); const run = new SearchRun('coat', context); return {...f, run, tools: new SearchTools(f.deps, () => {}, () => {})}; }
describe('tool boundaries', () => {
  it('list_visits pages all trips, sorts visits, counts only item photos and explicitly truncates', async () => {
    const {run, tools} = setup();
    const result = await tools.execute(run, {id: 'list', name: 'list_visits', arguments: {limit: 1}});
    expect(result.name).toBe('list_visits'); if (result.name !== 'list_visits') return;
    expect(result.result).toMatchObject({matchingCount: 2, truncated: true});
    expect(result.result.visits[0]).toMatchObject({photoCount: 3, firstPhotoAt: '2026-11-04T04:35:00.000Z', lastPhotoAt: '2026-11-04T04:45:00.000Z'});
  });
  it('time boundaries include 13:35 and exclude 13:45, prefilter before index and retain index ordering', async () => {
    const {run, tools, deps} = setup();
    vi.mocked(deps.photoIndex.search).mockResolvedValue([{photoId: photos[1].id, score: 0.5}, {photoId: photos[0].id, score: 0.5}]);
    const result = await tools.execute(run, {id: 'find', name: 'find_photos', arguments: {phrase: 'coat', timeFrom: '2026-11-04T13:35:00+09:00', timeTo: '2026-11-04T13:45:00+09:00'}, phraseVector: vector});
    expect(deps.photoIndex.search).toHaveBeenCalledWith({phraseVector: vector, photoIds: [photos[0].id, photos[1].id], k: 3});
    if (result.name !== 'find_photos') throw new Error('wrong tool');
    expect(result.result.map(p => run.photos.get(p.photoRef)?.id)).toEqual([photos[1].id, photos[0].id]);
  });
  it('future photos and storefronts are excluded; explicit empty scope never expands to all photos', async () => {
    const {run, tools, deps} = setup();
    await tools.execute(run, {id: 'find', name: 'find_photos', arguments: {phrase: 'coat', timeFrom: '2026-11-05T00:00:00+09:00'}, phraseVector: vector});
    expect(deps.photoIndex.search).toHaveBeenCalledWith({phraseVector: vector, photoIds: [], k: 3});
  });
  it('refs are per-run opaque and stable inside a run', () => {
    const a = new SearchRun('coat', context); const b = new SearchRun('coat', context);
    expect(a.reference('photo', 'device-id')).toBe(a.reference('photo', 'device-id'));
    expect(a.reference('photo', 'device-id')).not.toBe(b.reference('photo', 'device-id'));
    expect(a.reference('photo', 'device-id')).not.toContain('device-id');
  });
  it.each([
    {id: 'x', name: 'find_photos', arguments: {phrase: 'coat', k: 4}, phraseVector: vector},
    {id: 'x', name: 'find_photos', arguments: {phrase: 'coat', shopRefs: ['same', 'same']}, phraseVector: vector},
    {id: 'x', name: 'find_photos', arguments: {phrase: 'coat'}, phraseVector: [1, 2]},
    {id: 'x', name: 'find_photos', arguments: {phrase: 'coat'}, phraseVector: Array(512).fill(0)},
    {id: 'x', name: 'list_visits', arguments: {limit: 0}},
    {id: 'x', name: 'list_visits', arguments: {from: '2026-11-04T12:00:00Z', to: '2026-11-04T11:00:00Z'}},
    {id: 'x', name: 'extract_items', arguments: {concept: 'coat', photoRefs: []}},
    {id: 'x', name: 'other', arguments: {}},
  ])('invalid tool arguments are rejected without execution %j', value => { expect(() => validateCall(value)).toThrow(); });
  it('unknown shop refs fail before index, fabricated final refs and mismatched concept cannot publish', async () => {
    const {run, tools, deps} = setup();
    await expect(tools.execute(run, {id: 'find', name: 'find_photos', arguments: {phrase: 'coat', shopRefs: ['unknown']}, phraseVector: vector})).rejects.toThrow();
    expect(deps.photoIndex.search).not.toHaveBeenCalled();
    expect(() => tools.final(run, {photoRefs: ['unknown'], concept: 'coat', summary: 'Found'})).toThrow();
    run.concept = 'coat'; expect(() => tools.final(run, {photoRefs: ['unknown'], concept: 'pants', summary: 'Found'})).toThrow();
  });
  it('pure absolute ranges respect midnight and DST offsets without changing interpretation', () => {
    const midnight = interval('2026-11-04T23:55:00+09:00', '2026-11-05T00:05:00+09:00');
    expect(inInterval(Date.parse('2026-11-05T00:00:00+09:00'), midnight, Infinity)).toBe(true);
    const dst = interval('2026-11-01T01:30:00-04:00', '2026-11-01T01:30:00-05:00');
    expect(dst[1] - dst[0]).toBe(3600000);
    expect(inInterval(dst[1], dst, Infinity)).toBe(false);
  });
  it('wire serializer removes nested injected local keys rather than spreading results', () => {
    const dirty = {name: 'find_photos' as const, toolCallId: 'call', result: [{photoRef: 'p', shopRef: 's', takenAt: context.now, score: 1, lat: 1, file: 'raw-self.jpg', embedding: vector}]};
    expect(serializeTool(dirty)).toEqual({name: 'find_photos', toolCallId: 'call', result: [{photoRef: 'p', shopRef: 's', takenAt: context.now, score: 1}]});
  });
});

describe('mask bytes', () => {
  it('nearest-neighbor upscale preserves binary mask and original-space tight bbox', async () => {
    const normalized = originalMask(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), 2, 1, 4, 2);
    expect([...normalized.pixels]).toEqual([0, 0, 255, 255, 0, 0, 255, 255]);
    expect(normalized.bbox).toEqual([2, 0, 2, 2]);
    const png = await binaryPNG(normalized.pixels, 4, 2);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png[24]).toBe(8); expect(png[25]).toBe(0);
    const compressedSize = new DataView(png.buffer).getUint32(33);
    const compressed = png.slice(41, 41 + compressedSize);
    const decoded = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    expect([...decoded]).toEqual([0, 0, 0, 255, 255, 0, 0, 0, 255, 255]);
  });
  it('nonbinary, transparent, or empty masks fail closed', () => {
    for (const rgba of [[128, 128, 128, 255], [255, 255, 255, 0], [0, 0, 0, 255]]) expect(() => originalMask(new Uint8ClampedArray(rgba), 1, 1, 2, 2)).toThrow();
  });
});
