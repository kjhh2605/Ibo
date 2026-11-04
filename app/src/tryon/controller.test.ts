import {describe, expect, it, vi} from 'vitest';
import type {Candidate, MaskFailure} from '../native/contracts';
import type {RelayResponse} from '../relay/client';
import {deferred, fixture, passedMetrics} from './fixtures.test-support';
import {TryOnError} from './errors';
import {createResultExporter} from './export';
import {decodeImage, encodeBase64, imageDimensions} from './images';

const candidate: Candidate = {id: 'candidate', photoId: 'trip-photo', source: 'edgetam', label: 'unused model label', score: 1, mask: 'candidate-mask', bbox: [0, 0, 1, 1]};
const asset = {id: 'self-asset', file: 'private/raw-capture', w: 8, h: 8};
const response = (bytes: Uint8Array) => ({image: {...imageDimensions(bytes), data: encodeBase64(bytes)}});

async function pendingRequest() {
  const context = fixture();
  const gate = deferred<RelayResponse<'/v1/tryon'>>();
  vi.mocked(context.deps.request).mockImplementation(() => gate.promise);
  await context.controller.wear('piece-0');
  const pending = context.controller.generate();
  await vi.waitFor(() => expect(context.controller.getSnapshot().phase).toBe('sending'));
  return {...context, gate, pending};
}

describe('composition', () => {
  it('rejects an empty mannequin, unsorted pieces and non-scalar ids without a request', async () => {
    const f = fixture();
    expect(await f.controller.generate()).toBeNull();
    expect(f.controller.getSnapshot().error?.code).toBe('invalid_composition');
    f.pieces.set('unsorted', {...f.pieces.get('piece-0')!, id: 'unsorted', category: 'unknown'});
    await expect(f.controller.wear('unsorted')).rejects.toMatchObject({code: 'category_required'});
    f.pieces.set('shoes', {...f.pieces.get('piece-0')!, id: 'shoes', category: 'other'});
    await expect(f.controller.wear('shoes')).rejects.toMatchObject({code: 'category_required'});
    await expect(f.controller.wear(['piece-0', 'piece-2'] as unknown as string)).rejects.toMatchObject({code: 'invalid_composition'});
    await expect(f.controller.setSlot('shoes' as never, 'piece-0')).rejects.toMatchObject({code: 'invalid_composition'});
    expect(f.controller.getSnapshot().draft.outfit).toEqual({});
    expect(f.deps.request).not.toHaveBeenCalled();
  });
  it.each([
    [['piece-0'], ['piece-0']],
    [['piece-2'], ['piece-2']],
    [['piece-2', 'piece-1', 'piece-0'], ['piece-0', 'piece-1', 'piece-2']],
    [['piece-1', 'piece-5'], ['piece-1', 'piece-5']],
  ])('wears %j as one look in slot order %j across subscriber remounts, any origin', async (worn, order) => {
    const f = fixture();
    const unsubscribe = f.controller.subscribe(() => {});
    for (const id of worn) await f.controller.wear(id);
    unsubscribe();
    const newSubscriber = f.controller.subscribe(() => {});
    const result = await f.controller.generate();
    expect([result?.targetPieceId, ...result?.companionPieceIds ?? []]).toEqual(order);
    expect(f.deps.request).toHaveBeenCalledTimes(1);
    newSubscriber();
  });
  it('replaces a slot instead of stacking two pieces in it, and clears slots', async () => {
    const f = fixture();
    expect(await f.controller.wear('piece-0')).toBe('outer');
    await f.controller.wear('piece-1');
    expect(await f.controller.wear('piece-3')).toBe('outer');
    expect(f.controller.getSnapshot().draft.outfit).toEqual({outer: 'piece-3', top: 'piece-1'});
    f.controller.clearSlot('outer');
    expect(f.controller.getSnapshot().draft.outfit).toEqual({top: 'piece-1'});
    await f.controller.setSlot('bottom', 'piece-1');
    expect(f.controller.getSnapshot().draft.outfit).toEqual({bottom: 'piece-1'});
    expect(f.pieces.get('piece-1')?.category).toBe('bottom');
    expect(Object.isFrozen(f.controller.getSnapshot().draft.outfit)).toBe(true);
  });
  it('sorts an unsorted or legacy free-text piece when the user puts it in a slot', async () => {
    const f = fixture();
    f.pieces.set('unsorted', {...f.pieces.get('piece-0')!, id: 'unsorted', label: 'Picked item', category: 'unknown'});
    f.pieces.set('legacy', {...f.pieces.get('piece-0')!, id: 'legacy', label: 'Denim', category: 'denim jacket'});
    await f.controller.setSlot('top', 'unsorted');
    expect(await f.controller.wear('legacy')).toBe('outer');
    expect(f.store.updatePiece).toHaveBeenCalledWith({id: 'unsorted', label: 'Picked item', category: 'top'});
    expect(f.store.updatePiece).toHaveBeenCalledWith({id: 'legacy', label: 'Denim', category: 'outer'});
    expect(f.controller.getSnapshot().draft.outfit).toEqual({top: 'unsorted', outer: 'legacy'});
    expect((await f.controller.generate())?.companionPieceIds).toEqual(['unsorted']);
    const body = vi.mocked(f.deps.request).mock.calls[0][0];
    expect(body.pieces.map(piece => piece.category)).toEqual(['outer', 'top']);
  });
  it('revalidates deleted and re-sorted pieces just before submission', async () => {
    const f = fixture(); await f.controller.wear('piece-0'); await f.controller.wear('piece-1');
    f.pieces.delete('piece-1');
    expect(await f.controller.generate()).toBeNull();
    expect(f.controller.getSnapshot().error?.code).toBe('invalid_reference');
    f.controller.clearSlot('top');
    f.pieces.set('piece-0', {...f.pieces.get('piece-0')!, category: 'top'});
    expect(await f.controller.generate()).toBeNull();
    expect(f.controller.getSnapshot().error?.code).toBe('invalid_composition');
    expect(f.deps.request).not.toHaveBeenCalled();
  });
  it('direct trip cutout waits for save, keeps the chosen slot and queues Spark naming', async () => {
    const f = fixture(); await f.controller.wear('piece-0'); vi.mocked(f.deps.online).mockResolvedValue(false);
    const gate = deferred<void>(); const save = f.store.saveCandidate.getMockImplementation()!;
    f.store.saveCandidate.mockImplementation(async input => { await gate.promise; return save(input); });
    const pending = f.controller.addTripCandidate(candidate, 'bottom');
    expect(f.controller.getSnapshot().draft.outfit).toEqual({outer: 'piece-0'});
    gate.resolve(); const value = await pending;
    expect(value).toMatchObject({label: 'Picked item', category: 'bottom'});
    expect(f.controller.getSnapshot().draft.outfit).toEqual({outer: 'piece-0', bottom: value.id});
    expect(f.labels).toEqual([{cutoutFile: value.cutoutFile, label: 'Picked item', category: 'bottom'}]);
    expect(f.store.saveCandidate).toHaveBeenCalledWith({candidate, origin: 'shop', labelMode: 'describe', category: 'bottom'});
    expect(f.store.updatePiece).not.toHaveBeenCalled();
    expect(f.deps.request).not.toHaveBeenCalled();
  });
  it.each(['failure', 'cancel'])('does not add direct cutout after %s', async mode => {
    const f = fixture(); await f.controller.wear('piece-0');
    const gate = deferred<void>(); const save = f.store.saveCandidate.getMockImplementation()!;
    f.store.saveCandidate.mockImplementation(async input => { await gate.promise; if (mode === 'failure') throw new TryOnError('io_error'); return save(input); });
    const pending = f.controller.addTripCandidate(candidate, 'top');
    if (mode === 'cancel') f.controller.cancel();
    gate.resolve(); await expect(pending).rejects.toBeDefined();
    expect(f.controller.getSnapshot().draft.outfit).toEqual({outer: 'piece-0'});
  });
});

describe('privacy', () => {
  it('uploads decoded masked pixels and copied cutouts only, never private identifiers or results', async () => {
    const f = fixture(); await f.controller.wear('piece-0'); await f.controller.wear('piece-1');
    await f.controller.generate();
    const body = vi.mocked(f.deps.request).mock.calls[0][0];
    expect(decodeImage(body.selfPhoto.image, 'upload')).toEqual(f.masked);
    expect(decodeImage(body.selfPhoto.image, 'upload')).not.toEqual(f.raw);
    expect(body.pieces.map(piece => decodeImage(piece.image, 'upload'))).toEqual([f.masked, f.masked]);
    expect(Object.keys(body)).toEqual(['selfPhoto', 'pieces']);
    expect(body.pieces.map(piece => Object.keys(piece))).toEqual([['pieceRef', 'image', 'label', 'category'], ['pieceRef', 'image', 'label', 'category']]);
    expect(body.pieces.map(piece => [piece.pieceRef, piece.category])).toEqual([['garment_0', 'outer'], ['garment_1', 'top']]);
    expect(JSON.stringify(body)).not.toMatch(/SENTINEL|private\/|photo-original|trip-original|snapshot shop|cutout\/|walkTo|lat|lng/);
    expect(vi.mocked(f.deps.readImage).mock.calls.map(call => call[0])).toEqual(['private/masked', 'draft/draft-1/piece-0', 'draft/draft-1/piece-1']);
    expect(f.deps.request).toHaveBeenCalledTimes(1);
  });
  it.each<MaskFailure>(['person_not_found', 'head_not_found', 'ambiguous_person', 'unsafe_boundary'])('blocks failed replacement %s and retains prior self', async reason => {
    const f = fixture(); await f.controller.wear('piece-0');
    f.faceMask.register.mockResolvedValue({ok: false, reason, metrics: {personAccepted: false, headAreaRatio: null, gtHeadPixels: null, exposedHeadPixels: null, privacyPassed: false}});
    expect(await f.controller.registerSelf(asset)).toBe(false);
    await f.controller.refresh();
    expect(f.controller.getSnapshot().selfPhoto).toEqual(f.self);
    expect(f.controller.getSnapshot().selfState).toBe('failed');
    expect(await f.controller.generate()).toBeNull();
    expect(f.deps.request).not.toHaveBeenCalled();
  });
  it.each(['missing', 'original', 'head', 'cancel'])('makes zero requests for %s masked source', async mode => {
    const f = fixture(); await f.controller.wear('piece-0');
    if (mode === 'missing') f.files.delete(f.self.maskedFile);
    if (mode === 'original') f.self.maskedFile = f.self.file;
    if (mode === 'head') f.self.maskedFile = f.self.headMask;
    const pending = f.controller.generate(); if (mode === 'cancel') f.controller.cancel();
    expect(await pending).toBeNull(); expect(f.deps.request).not.toHaveBeenCalled();
    expect(f.drafts.size).toBe(0);
  });
  it('cancels late relay completion and prevents duplicate submission', async () => {
    const f = await pendingRequest();
    expect(() => f.controller.generate()).toThrowError('Please wait');
    f.controller.cancel(); f.gate.resolve(response(f.masked));
    expect(await f.pending).toBeNull();
    expect(f.deps.writeProvider).not.toHaveBeenCalled(); expect(f.faceMask.compose).not.toHaveBeenCalled();
    expect(f.drafts.size).toBe(0); expect(f.controller.getSnapshot().phase).toBe('cancelled');
  });
  it('keeps cancellation busy until a non-interruptible native compose settles', async () => {
    const f = fixture(); await f.controller.wear('piece-0');
    const gate = deferred<void>(); const compose = f.faceMask.compose.getMockImplementation()!;
    f.faceMask.compose.mockImplementation(async input => { await gate.promise; return compose(input); });
    const pending = f.controller.generate();
    await vi.waitFor(() => expect(f.controller.getSnapshot().phase).toBe('compositing'));
    f.controller.cancel();
    expect(f.controller.getSnapshot().phase).toBe('cancelling');
    expect(() => f.controller.generate()).toThrowError('Please wait');
    await expect(f.controller.wear('piece-2')).rejects.toMatchObject({code: 'busy'});
    gate.resolve();
    expect(await pending).toBeNull();
    expect(f.controller.getSnapshot()).toMatchObject({phase: 'cancelled', result: null});
    expect(f.store.saveResult).not.toHaveBeenCalled();
    expect([...f.files.keys()].filter(file => /^(draft|cache)\//.test(file))).toEqual([]);
  });
  it('does not queue or automatically retry offline and policy failures', async () => {
    const f = fixture(); await f.controller.wear('piece-0'); vi.mocked(f.deps.online).mockResolvedValue(false);
    await f.controller.generate(); expect(f.deps.request).not.toHaveBeenCalled();
    vi.mocked(f.deps.online).mockResolvedValue(true); vi.mocked(f.deps.request).mockRejectedValue(new TryOnError('content_policy_violation'));
    await f.controller.generate(); expect(f.deps.request).toHaveBeenCalledTimes(1); expect(f.drafts.size).toBe(0);
    expect(f.controller.getSnapshot().error?.code).toBe('content_policy_violation');
  });
});

describe('snapshot', () => {
  it('keeps immutable files and walk destination after source rename and deletion in flight', async () => {
    const f = fixture(); await f.controller.wear('piece-0'); await f.controller.wear('piece-1');
    const gate = deferred<void>(); vi.mocked(f.deps.request).mockImplementation(async () => { await gate.promise; return response(f.masked); });
    const pending = f.controller.generate(); await vi.waitFor(() => expect(f.controller.getSnapshot().phase).toBe('sending'));
    f.pieces.get('piece-0')!.label = 'renamed';
    for (const piece of f.pieces.values()) f.files.delete(piece.cutoutFile);
    f.pieces.clear(); gate.resolve(); const result = (await pending)!;
    expect(result.targetSnapshot).toMatchObject({label: 'Label 0', walkTo: {lat: 37, lng: 127}, shop: {note: 'snapshot note'}});
    expect(result.companionSnapshots[0].label).toBe('Label 1');
    expect(f.files.get(result.targetSnapshot.cutoutFile)).toEqual(f.masked);
    expect(await f.controller.canChangePieces(result)).toBe(false);
    await expect(f.controller.restoreResult(result)).rejects.toMatchObject({code: 'invalid_reference'});
    expect(f.results.get(result.id)?.targetSnapshot.walkTo).toEqual({lat: 37, lng: 127});
  });
  it('restores surviving pieces to their slots and preserves result snapshot after completion deletion', async () => {
    const f = fixture(); await f.controller.wear('piece-0'); await f.controller.wear('piece-1'); await f.controller.wear('piece-2');
    const result = (await f.controller.generate())!; f.pieces.delete('piece-1');
    f.controller.clearSlot('outer'); f.controller.clearSlot('bottom');
    await f.controller.restoreResult(result);
    expect(f.controller.getSnapshot().draft.outfit).toEqual({outer: 'piece-0', bottom: 'piece-2'});
    expect(result.companionSnapshots.map(piece => piece.pieceId)).toEqual(['piece-1', 'piece-2']);
    f.pieces.delete('piece-0'); expect(await f.controller.canChangePieces(result)).toBe(true);
    f.pieces.delete('piece-2'); expect(await f.controller.canChangePieces(result)).toBe(false);
  });
  it('reclaims snapshot and temporary files after compose failure', async () => {
    const f = fixture(); await f.controller.wear('piece-0'); f.faceMask.compose.mockRejectedValue(new TryOnError('io_error'));
    expect(await f.controller.generate()).toBeNull(); expect(f.drafts.size).toBe(0);
    expect([...f.files.keys()].filter(file => /^(draft|cache)\//.test(file))).toEqual([]);
  });
  it('deletes only the just-created result if cancelled during atomic save', async () => {
    const f = fixture(); await f.controller.wear('piece-0');
    const gate = deferred<void>(); const save = f.store.saveResult.getMockImplementation()!;
    f.store.saveResult.mockImplementation(async args => { await gate.promise; return save(args); });
    const pending = f.controller.generate(); await vi.waitFor(() => expect(f.controller.getSnapshot().phase).toBe('saving'));
    f.controller.cancel(); gate.resolve(); expect(await pending).toBeNull(); expect(f.results.size).toBe(0);
    expect(f.store.deleteResult).toHaveBeenCalledWith({id: 'draft-1'});
  });
  it('does not expose a completed result before cleanup and removes it if cancelled during cleanup', async () => {
    const f = fixture(); await f.controller.wear('piece-0');
    const gate = deferred<void>(); const discard = f.store.discardTemp.getMockImplementation()!;
    f.store.discardTemp.mockImplementation(async input => { await gate.promise; return discard(input); });
    const pending = f.controller.generate();
    await vi.waitFor(() => expect(f.store.discardTemp).toHaveBeenCalled());
    expect(f.controller.getSnapshot()).toMatchObject({phase: 'saving', result: null});
    f.controller.cancel();
    expect(f.controller.getSnapshot().phase).toBe('cancelling');
    gate.resolve();
    expect(await pending).toBeNull();
    expect(f.results.size).toBe(0);
    expect(f.store.deleteResult).toHaveBeenCalledWith({id: 'draft-1'});
    expect(f.controller.getSnapshot()).toMatchObject({phase: 'cancelled', result: null});
  });
  it('releases the operation and reports an I/O failure if cancellation rollback fails', async () => {
    const f = fixture(); await f.controller.wear('piece-0');
    const gate = deferred<void>(); const save = f.store.saveResult.getMockImplementation()!;
    f.store.saveResult.mockImplementation(async input => { await gate.promise; return save(input); });
    f.store.deleteResult.mockRejectedValue(new TryOnError('io_error'));
    const pending = f.controller.generate();
    await vi.waitFor(() => expect(f.controller.getSnapshot().phase).toBe('saving'));
    f.controller.cancel(); gate.resolve();
    expect(await pending).toBeNull();
    expect(f.controller.getSnapshot()).toMatchObject({phase: 'cancelled', result: null, error: {code: 'io_error'}});
    await expect(f.controller.wear('piece-2')).resolves.toBe('bottom');
  });
});

describe('quality', () => {
  it.each([false, true])('persists native composition decision faceless=%s without changing provider bytes', async faceless => {
    const f = fixture(); await f.controller.wear('piece-0');
    f.faceMask.compose.mockImplementation(async ({providerFile}) => {
      f.files.set('cache/output', f.files.get(providerFile)!.slice());
      return {ok: true, file: 'cache/output', faceless, metrics: faceless ? {...passedMetrics, passed: false, decision: 'threshold_exceeded'} : passedMetrics};
    });
    const result = (await f.controller.generate())!;
    expect(result.faceless).toBe(faceless); expect(result.file).not.toBe(result.providerFile);
    expect(f.files.get(result.providerFile)).toEqual(f.masked);
  });
  it('persists only the safe native faceless derivative when thresholds are not calibrated', async () => {
    const f = fixture(); await f.controller.wear('piece-0');
    f.faceMask.compose.mockImplementation(async ({providerFile}) => {
      f.files.set('cache/faceless', f.files.get(providerFile)!.slice());
      return {ok: true, file: 'cache/faceless', faceless: true, metrics: {
        neckColorDeltaE95: null, shoulderColorDeltaE95: null, neckOffsetRatio95: null, shoulderOffsetRatio95: null,
        thresholdVersion: null, passed: false, decision: 'not_calibrated',
      }};
    });
    const result = await f.controller.generate();
    expect(result).toMatchObject({faceless: true});
    expect(result?.file).not.toBe(result?.providerFile);
    expect(f.controller.getSnapshot().phase).toBe('complete');
  });
  it.each(['unsafe_output', 'self_photo_changed'] as const)('never exposes/saves %s', async reason => {
    const f = fixture(); await f.controller.wear('piece-0');
    f.faceMask.compose.mockResolvedValue({ok: false, reason, metrics: passedMetrics});
    expect(await f.controller.generate()).toBeNull(); expect(f.store.saveResult).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().result).toBeNull(); expect(f.controller.getSnapshot().error?.code).toBe(reason);
  });
  it('passes captured self version rather than switching to a new face', async () => {
    const f = await pendingRequest(); f.self.updatedAt = 456; f.gate.resolve(response(f.masked));
    expect(await f.pending).toBeNull();
    expect(f.faceMask.compose).toHaveBeenCalledWith(expect.objectContaining({selfUpdatedAt: 123}));
    expect(f.controller.getSnapshot().error?.code).toBe('self_photo_changed');
  });
  it('never saves a provider file returned as a composed file', async () => {
    const f = fixture(); await f.controller.wear('piece-0');
    f.faceMask.compose.mockImplementation(async ({providerFile}) => ({ok: true, file: providerFile, faceless: false, metrics: passedMetrics}));
    expect(await f.controller.generate()).toBeNull(); expect(f.store.saveResult).not.toHaveBeenCalled();
  });
  it.each(['file', 'headMask', 'maskedFile'] as const)('never saves or discards self %s returned as a composed output', async key => {
    const f = fixture(); await f.controller.wear('piece-0');
    const source = f.self[key], before = f.files.get(source)!.slice();
    f.faceMask.compose.mockResolvedValue({ok: true, file: source, faceless: false, metrics: passedMetrics});
    expect(await f.controller.generate()).toBeNull();
    expect(f.store.saveResult).not.toHaveBeenCalled();
    expect(f.store.discardTemp).not.toHaveBeenCalledWith({file: source});
    expect(f.files.get(source)).toEqual(before);
    expect(f.controller.getSnapshot().error?.code).toBe('unsafe_output');
  });
});

describe('download', () => {
  it('blocks default OFF and unapproved enabled exports before Media, retaining provider hash', async () => {
    const f = fixture(); await f.controller.wear('piece-0'); const result = (await f.controller.generate())!;
    const before = await crypto.subtle.digest('SHA-256', new Uint8Array(f.files.get(result.providerFile)!).buffer);
    const media = {exportResult: vi.fn(async () => ({uri: 'gallery/output'}))};
    await expect(createResultExporter(media)(result.id)).rejects.toMatchObject({code: 'result_download_disabled'});
    await expect(createResultExporter(media, {enabled: true, exporterVersion: 'v1', approval: null})(result.id)).rejects.toMatchObject({code: 'provenance_unverified'});
    expect(media.exportResult).not.toHaveBeenCalled();
    const after = await crypto.subtle.digest('SHA-256', new Uint8Array(f.files.get(result.providerFile)!).buffer);
    expect(new Uint8Array(after)).toEqual(new Uint8Array(before));
  });
  it('requires matching exporter verification covering GPS, watermark, provenance', async () => {
    const media = {exportResult: vi.fn(async () => ({uri: 'gallery/output'}))};
    const approval = {exporterVersion: 'v1', evidencePath: 'fixture/approval-only', gpsRemoved: true, watermarkPreserved: true, provenancePreserved: true} as const;
    await expect(createResultExporter(media, {enabled: true, exporterVersion: 'v2', approval})('id')).rejects.toMatchObject({code: 'provenance_unverified'});
    expect(media.exportResult).not.toHaveBeenCalled();
    expect(await createResultExporter(media, {enabled: true, exporterVersion: 'v1', approval})('id')).toEqual({uri: 'gallery/output'});
  });
});
