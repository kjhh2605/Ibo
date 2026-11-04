import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {AgentController, AgentDependencies, Schema} from './types';
import {createAgentController} from './controller';
import {deferred, fixture, photos, pipeline, recording, vector, wav} from './fixtures';
import {RelayError} from '../relay/client';
import {AgentError, voiceAudio} from './wire';

const controllers: AgentController[] = [];
function controller(deps: AgentDependencies) { const value = createAgentController(deps); controllers.push(value); return value; }
beforeEach(() => { vi.useFakeTimers({toFake: ['Date']}); vi.setSystemTime(new Date('2026-11-04T14:00:00+09:00')); });
afterEach(async () => { for (const value of controllers.splice(0)) await value.dispose(); vi.useRealTimers(); });
async function settled(agent: AgentController) { await vi.waitFor(() => expect(agent.getState().status).not.toBe('running')); }

describe('scenario', () => {
  it.each(['normal', 'shop-specific', 'time-specific', 'note-specific', 'past-trip'])('%s has four real turns, all-trip visits and no PE candidate filter', async name => {
    const {deps} = fixture();
    const route = pipeline(deps, {shop: name === 'past-trip' ? 'past' : name === 'shop-specific' ? 'today' : undefined, time: name === 'time-specific'});
    const agent = controller(deps);
    await agent.submit(name === 'note-specific' ? 'jacket in the red curtain shop' : 'blue jacket');
    expect(agent.getState().status).toBe('results');
    expect(route.calls.map(c => c.path)).toEqual(['/v1/search/turn', '/v1/search/turn', '/v1/search/turn', '/v1/search/segment', '/v1/search/turn']);
    const visits = ((route.calls[1].body as Schema['SearchTurnRequest']).toolResults![0] as Schema['ListVisitsToolResult']).result;
    expect(visits.matchingCount).toBe(2);
    expect(visits.visits.map(v => v.n)).toEqual([2, 2]);
    expect(visits.visits[0].note).toContain('red curtains');
    if (name === 'time-specific') expect(agent.getState().photos.map(p => p.id)).toEqual([photos[0].id, photos[1].id]);
    if (name === 'past-trip') expect(agent.getState().photos.map(p => p.id)).toEqual(['private-photo-past']);
    expect(agent.getState().candidates.length).toBe(agent.getState().photos.length * 2);
    expect((route.calls[4].body as Schema['SearchTurnRequest']).queryToken).toBe('token-segment');
  });
  it('not-found respects provider reason and never invents a photo', async () => {
    const {deps} = fixture();
    vi.mocked(deps.relay.request).mockResolvedValue({queryToken: 'opaque', not_found: {reason: 'No matches in your trips.'}});
    const agent = controller(deps); await agent.submit('coat');
    expect(agent.getState()).toMatchObject({status: 'not_found', summary: 'No matches in your trips.', photos: [], candidates: [], stepsExpanded: false});
  });
  it('turn-limit 409 normalizes without retry or token fork', async () => {
    const {deps} = fixture();
    vi.mocked(deps.relay.request).mockRejectedValue(new RelayError('turn_limit_exceeded', 409, false));
    const agent = controller(deps); await agent.submit('coat');
    expect(agent.getState().status).toBe('not_found'); expect(deps.relay.request).toHaveBeenCalledTimes(1);
  });
  it('turn-limit tool on fourth turn is an error; no fifth request', async () => {
    const {deps} = fixture();
    vi.mocked(deps.relay.request).mockResolvedValue({queryToken: 'opaque', toolCalls: [{id: 'list', name: 'list_visits', arguments: {}}]});
    const agent = controller(deps); await agent.submit('coat');
    expect(agent.getState().error?.code).toBe('upstream_error'); expect(deps.relay.request).toHaveBeenCalledTimes(4);
  });
  it('photo-limit rejects four requested refs before SAM', async () => {
    const {deps} = fixture();
    const route = pipeline(deps);
    const original = deps.relay.request;
    deps.relay.request = (async (path, body, options) => {
      const response = await original(path, body, options) as Schema['ToolCallsResponse'];
      if ('toolCalls' in response && response.toolCalls[0].name === 'extract_items') response.toolCalls[0].arguments.photoRefs.push('unseen-fourth');
      return response;
    }) as AgentDependencies['relay']['request'];
    const agent = controller(deps); await agent.submit('coat');
    expect(agent.getState().error?.code).toBe('photo_limit_exceeded'); expect(route.calls.every(c => c.path !== '/v1/search/segment')).toBe(true);
  });
  it('upstream-timeout is surfaced once without retries', async () => {
    const {deps} = fixture();
    vi.mocked(deps.relay.request).mockRejectedValue(new RelayError('upstream_timeout', 504, true));
    const agent = controller(deps); await agent.submit('coat');
    expect(agent.getState().error).toEqual({code: 'upstream_timeout', retryable: true}); expect(deps.relay.request).toHaveBeenCalledTimes(1);
  });
  it.each(['query_token_expired', 'query_token_invalid', 'policy_blocked', 'network_error'])('%s never forks a new run or retries', async code => {
    const {deps} = fixture(); vi.mocked(deps.relay.request).mockRejectedValue(new RelayError(code, 400, false));
    const agent = controller(deps); await agent.submit('coat');
    expect(agent.getState().error?.code).toBe(code); expect(deps.relay.request).toHaveBeenCalledTimes(1);
  });
  it('photo-limit counts cumulative repeated photos and refuses the second batch without truncating', async () => {
    const {deps} = fixture();
    let turn = 0; let selected: string[] = []; let batches = 0;
    deps.relay.request = (async (path: string, body: Schema['SearchTurnRequest'] | Schema['SearchSegmentRequest']) => {
      if (path === '/v1/search/segment') { batches++; return {queryToken: 'segment-token', photos: (body as Schema['SearchSegmentRequest']).photos.map(p => ({photoRef: p.photoRef, candidates: []}))}; }
      turn++;
      if (turn === 1) return {queryToken: 'one', toolCalls: [{id: 'find', name: 'find_photos', arguments: {phrase: 'coat', k: 2}, phraseVector: vector}]};
      if (turn === 2) selected = ((body as Schema['SearchTurnRequest']).toolResults![0] as Schema['FindPhotosToolResult']).result.map(p => p.photoRef);
      return {queryToken: `turn-${turn}`, toolCalls: [{id: `extract-${turn}`, name: 'extract_items', arguments: {concept: 'coat', photoRefs: selected}}]};
    }) as unknown as AgentDependencies['relay']['request'];
    const agent = controller(deps); await agent.submit('coat');
    expect(agent.getState().error?.code).toBe('photo_limit_exceeded'); expect(batches).toBe(1); expect(turn).toBe(3);
  });
});

describe('state', () => {
  it('pending results stay hidden; final collapses history and Show all is local', async () => {
    const {deps} = fixture(); const gate = deferred<void>();
    const route = pipeline(deps, {beforeFinal: () => gate.promise}); const agent = controller(deps);
    const events: string[] = []; agent.subscribe(() => { const event = agent.getState().events.at(-1); if (event) events.push(event.type); });
    const running = agent.submit('blue jacket');
    await vi.waitFor(() => expect(route.calls).toHaveLength(5));
    expect(agent.getState()).toMatchObject({status: 'running', photos: [], candidates: [], visibleCandidates: [], stepsExpanded: true});
    gate.resolve(); await running;
    expect(agent.getState().visibleCandidates).toHaveLength(3); expect(agent.getState().candidates).toHaveLength(6);
    expect(agent.getState().candidates.map(c => c.id)).toEqual([0, 1].flatMap(provider => photos.slice(0, 3).map(photo => `stable-${photo.id}-provider-${provider}`)));
    expect(agent.getState().stepsExpanded).toBe(false); agent.setStepsExpanded(true); expect(agent.getState().stepsExpanded).toBe(true);
    agent.setShowAll(true); expect(agent.getState().visibleCandidates).toHaveLength(6); expect(route.calls).toHaveLength(5);
    expect(events).toContain('query_completed');
    expect(agent.getState().events.map(e => e.type)).toEqual(['query_started', 'tool_started', 'tool_completed', 'tool_started', 'tool_completed', 'tool_started', 'tool_completed', 'query_completed']);
  });
  it('zero SAM candidates retains photos for manual tap', async () => {
    const {deps} = fixture(); pipeline(deps, {candidates: 0}); const agent = controller(deps); await agent.submit('coat');
    expect(agent.getState()).toMatchObject({status: 'results', candidates: [], visibleCandidates: []}); expect(agent.getState().photos.map(p => p.id)).toEqual(photos.slice(0, 3).map(p => p.id));
  });
  it('new query fences late response and serializes even abort-ignoring transport', async () => {
    const {deps} = fixture(); const gate = deferred<Schema['NotFoundResponse']>();
    const request = vi.mocked(deps.relay.request);
    request.mockImplementationOnce(() => gate.promise).mockResolvedValue({queryToken: 'new-token', not_found: {reason: 'New result'}});
    const agent = controller(deps); const old = agent.submit('old'); await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    const fresh = agent.submit('new'); expect(agent.getState().query).toBe('new'); expect(request).toHaveBeenCalledTimes(1);
    gate.resolve({queryToken: 'old-token', not_found: {reason: 'Stale result'}}); await Promise.all([old, fresh]);
    expect(agent.getState().summary).toBe('New result'); expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1][1]).not.toHaveProperty('queryToken');
  });
  it('cancel ignores late completion and clears refs/results', async () => {
    const {deps} = fixture(); const gate = deferred<Schema['NotFoundResponse']>(); vi.mocked(deps.relay.request).mockReturnValue(gate.promise);
    const agent = controller(deps); const search = agent.submit('coat'); await vi.waitFor(() => expect(deps.relay.request).toHaveBeenCalledTimes(1));
    const cancelled = agent.cancel(); expect(agent.getState().status).toBe('idle');
    gate.resolve({queryToken: 'late', not_found: {reason: 'Late'}}); await Promise.all([search, cancelled]);
    expect(agent.getState()).toMatchObject({status: 'idle', photos: [], candidates: [], summary: null});
  });
  it('deletion during final invalidates pending candidates and late reply', async () => {
    const f = fixture(); const gate = deferred<void>(); const route = pipeline(f.deps, {beforeFinal: () => gate.promise}); const agent = controller(f.deps);
    const search = agent.submit('coat'); await vi.waitFor(() => expect(route.calls).toHaveLength(5));
    f.records.Photo.splice(0, 1); f.changed(); await vi.waitFor(() => expect(agent.getState().error?.code).toBe('data_changed'));
    gate.resolve(); await search; expect(agent.getState()).toMatchObject({status: 'error', photos: [], candidates: []});
    expect(f.deps.media.discard).toHaveBeenCalled();
  });
  it('failed or pending index failure cannot become an empty result', async () => {
    const {deps} = fixture(); pipeline(deps); vi.mocked(deps.photoIndex.search).mockRejectedValue(new AgentError('index_unavailable'));
    const agent = controller(deps); await agent.submit('coat'); expect(agent.getState().error?.code).toBe('index_unavailable');
    expect(agent.getState().events.filter(e => e.type === 'tool_completed').map(e => e.toolName)).toEqual(['list_visits']);
  });
  it('single-shop narrowing uses trip identity, not duplicated shop number', async () => {
    const {deps} = fixture(); pipeline(deps, {shop: 'past'}); const agent = controller(deps); await agent.submit('last Saturday Shop 2');
    expect(agent.getState().events.filter(e => e.type === 'scope_narrowed')).toMatchObject([{scope: {tripId: 'private-trip-past', shopId: 'private-shop-1', n: 2}}]);
  });
  it('unrelated Store changes do not invalidate final results', async () => {
    const f = fixture(); pipeline(f.deps); const agent = controller(f.deps); await agent.submit('coat');
    f.records.Photo = f.records.Photo.filter(p => p.kind !== 'storefront'); f.changed();
    await Promise.resolve();
    expect(agent.getState().status).toBe('results');
  });
  it('cancel during candidate write reclaims the late file without publishing results', async () => {
    const {deps} = fixture(); pipeline(deps); const gate = deferred<void>();
    const original = deps.media.cacheCandidate;
    vi.mocked(deps.media.cacheCandidate).mockImplementationOnce(async (...args) => { await gate.promise; return original(...args); });
    const agent = controller(deps); const search = agent.submit('coat');
    await vi.waitFor(() => expect(deps.media.cacheCandidate).toHaveBeenCalledTimes(1));
    const cancelled = agent.cancel(); gate.resolve(); await Promise.all([search, cancelled]);
    expect(agent.getState().status).toBe('idle'); expect(deps.media.discard).toHaveBeenCalledWith('cache/candidates/private-photo-0-provider-0.png');
  });
});

describe('privacy', () => {
  it('HTTP turn allowlists strip all local IDs, coordinates, media and vectors while preserving note text', async () => {
    const {deps} = fixture(); const route = pipeline(deps); const agent = controller(deps); await agent.submit('blue jacket');
    const turns = route.calls.filter(c => c.path === '/v1/search/turn');
    const raw = JSON.stringify(turns);
    for (const marker of ['private-trip', 'private-shop', 'private-photo', 'private-device', '37.123456', '127.123456', 'phraseVector', 'SHOP_BYTES', 'MASK']) expect(raw).not.toContain(marker);
    const forbidden: Record<string, true> = {id: true, tripId: true, shopId: true, photoId: true, lat: true, lng: true, accuracyM: true, file: true, mask: true, bbox: true, location: true, walkTo: true, vector: true, embedding: true};
    const walk = (value: unknown) => { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { expect(forbidden[key]).toBeUndefined(); walk(child); } };
    turns.forEach(c => walk(c.body));
    expect(raw).toContain('lat=notes');
    expect(vi.mocked(deps.media.preparePhoto).mock.calls.map(([photo]) => photo.id)).toEqual(photos.slice(0, 3).map(p => p.id));
    expect(vi.mocked(deps.store.get).mock.calls.every(([args]) => args.entity !== ('SelfPhoto' as never))).toBe(true);
  });
});

describe('scenario voice', () => {
  it('voice-empty is idle with prompt, deletes WAV and never searches', async () => {
    const f = fixture(); vi.mocked(f.deps.relay.request).mockResolvedValue({language: 'en', text: '  '});
    const agent = controller(f.deps); await agent.startVoice(); await agent.stopVoice(); await settled(agent);
    expect(agent.getState()).toMatchObject({status: 'idle', notice: "I didn't catch that. Try again."});
    await vi.waitFor(() => expect(f.deps.media.discard).toHaveBeenCalledWith(recording.file));
    expect(f.deps.relay.request).toHaveBeenCalledTimes(1);
  });
  it('15-second WAV accepted; unchanged transcript starts exactly once despite stop plus duplicate completed', async () => {
    const f = fixture(); const route = pipeline(f.deps); const original = f.deps.relay.request; let transcriptions = 0;
    f.deps.relay.request = (async (path, body, options) => { if (path === '/v1/transcribe') { transcriptions++; return {language: 'en', text: '  Find My COAT  '}; } return original(path, body, options); }) as AgentDependencies['relay']['request'];
    const agent = controller(f.deps); await agent.startVoice(); await agent.stopVoice(); f.emitVoice('completed', recording); await settled(agent);
    expect(transcriptions).toBe(1); expect(agent.getState().query).toBe('  Find My COAT  ');
    expect((route.calls[0].body as Schema['SearchTurnRequest']).query).toBe('  Find My COAT  ');
    expect(agent.getState().status).toBe('results'); expect(f.deps.media.discard).toHaveBeenCalledWith(recording.file);
  });
  it('offline start never records or queues a request', async () => {
    const f = fixture(); vi.mocked(f.deps.isOnline).mockResolvedValue(false); const agent = controller(f.deps); await agent.startVoice();
    expect(agent.getState().error?.code).toBe('offline'); expect(f.deps.voice.start).not.toHaveBeenCalled(); expect(f.deps.relay.request).not.toHaveBeenCalled();
  });
  it('cancel and late voice event never transcribe', async () => {
    const f = fixture(); const agent = controller(f.deps); await agent.startVoice(); await agent.cancel(); f.emitVoice('completed', recording);
    expect(agent.getState().status).toBe('idle'); expect(f.deps.voice.cancel).toHaveBeenCalledTimes(1); expect(f.deps.relay.request).not.toHaveBeenCalled();
  });
  it('no_speech remains idle without API errors', async () => {
    const f = fixture(); const agent = controller(f.deps); await agent.startVoice(); f.emitVoice('error', {code: 'no_speech', retryable: true});
    expect(agent.getState()).toMatchObject({status: 'idle', error: null, notice: "I didn't catch that. Try again."}); expect(f.deps.relay.request).not.toHaveBeenCalled();
  });
  it('offline after recording and transcription failure both reclaim WAV without a search', async () => {
    const f = fixture(); const agent = controller(f.deps); await agent.startVoice();
    vi.mocked(f.deps.isOnline).mockResolvedValue(false); f.emitVoice('completed', recording); await settled(agent);
    expect(agent.getState().error?.code).toBe('offline'); expect(f.deps.relay.request).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(f.deps.media.discard).toHaveBeenCalledWith(recording.file));
    vi.mocked(f.deps.isOnline).mockResolvedValue(true); vi.mocked(f.deps.relay.request).mockRejectedValue(new RelayError('upstream_timeout', 504, true));
    await agent.startVoice(); f.emitVoice('completed', recording); await settled(agent);
    expect(agent.getState().error?.code).toBe('upstream_timeout'); expect(f.deps.relay.request).toHaveBeenCalledTimes(1);
  });
  it('malformed, oversize and metadata-bearing WAV rejected from bytes, not duration claim', () => {
    expect(voiceAudio(wav()).mimeType).toBe('audio/wav');
    expect(() => voiceAudio(wav(240001))).toThrow();
    const stereo = wav(1); new DataView(stereo.buffer).setUint16(22, 2, true); expect(() => voiceAudio(stereo)).toThrow();
    const metadata = wav(1); metadata.set(new TextEncoder().encode('LIST'), 36); expect(() => voiceAudio(metadata)).toThrow();
  });
});
