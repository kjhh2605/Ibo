import type {Listener, VoiceRecording} from '../native/contracts';
import {RelayError} from '../relay/client';
import type {AgentController, AgentDependencies, AgentEvent, AgentSnapshot, AgentStage, Schema, ToolResult} from './types';
import {SearchRun, SearchTools} from './tools';
import {AgentError, object, queryContext, refs, requireValue, serializeTurn, text, validateCall, voiceAudio} from './wire';

const empty = (): AgentSnapshot => ({status: 'idle', runId: null, query: '', stage: null, events: [], stepsExpanded: false, showAll: false, photos: [], candidates: [], visibleCandidates: [], concept: null, summary: null, error: null, notice: null});
const stages = {list_visits: 'reading_visits', find_photos: 'searching_photos', extract_items: 'outlining_items'} as const;
const notFound = "I couldn't find it within this search. Ask again or browse your trips.";

export function createAgentController(deps: AgentDependencies): AgentController {
  let state = empty();
  let active: SearchRun | null = null;
  let disposed = false;
  let tail: Promise<void> = Promise.resolve();
  let voiceSession: {run: SearchRun; listeners: Listener[]; completed: boolean} | null = null;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<AgentSnapshot>) => {
    state = {...state, ...patch};
    for (const listener of listeners) listener();
  };
  const check = (run: SearchRun) => {
    if (active !== run || run.abort.signal.aborted || disposed) throw new DOMException('Cancelled', 'AbortError');
  };
  const emit = (event: AgentEvent) => {
    if (active?.id !== event.runId) return;
    let stage: AgentStage | null = state.stage;
    if (event.type === 'tool_started') stage = stages[event.toolName!];
    if (event.type === 'scope_narrowed') stage = 'narrowing';
    if (event.type === 'tool_completed' || event.type === 'query_started') stage = 'thinking';
    if (event.type === 'voice_started') stage = 'listening';
    if (event.type === 'voice_stopped') stage = 'transcribing';
    publish({events: [...state.events, event], stage});
  };
  const tools = new SearchTools(deps, check, emit);
  const discard = async (run: SearchRun) => {
    run.token = undefined;
    for (const file of run.files) await deps.media.discard(file);
    run.files.clear();
    run.candidates.clear();
    run.found.clear();
    run.photos.clear();
    run.shops.clear();
    run.trips.clear();
    run.localRefs.clear();
  };
  const stopVoice = async () => {
    const session = voiceSession;
    voiceSession = null;
    if (!session) return;
    try { await deps.voice.cancel(); }
    finally { await Promise.all(session.listeners.map(listener => listener.remove())); }
  };
  const queue = (work: () => Promise<void>): Promise<void> => {
    const next = tail.then(work);
    tail = next.catch(() => {});
    return next;
  };
  const fail = async (run: SearchRun, error: unknown) => {
    if (active !== run || run.abort.signal.aborted || disposed) return;
    let code = 'upstream_error';
    let retryable = false;
    if (error instanceof AgentError || error instanceof RelayError) { code = error.code; retryable = error.retryable; }
    else if (error && typeof error === 'object' && 'code' in error) {
      // Only enumerated native errors; never reflect native exception messages into UI/logs.
      const native = String(error.code);
      if (['index_unavailable', 'data_changed', 'microphone_permission_denied', 'audio_unavailable', 'io_error'].includes(native)) code = native;
    }
    if (code === 'turn_limit_exceeded') {
      emit({type: 'query_not_found', runId: run.id});
      publish({status: 'not_found', stage: null, stepsExpanded: false, summary: notFound});
    } else {
      emit({type: 'query_failed', runId: run.id});
      publish({status: 'error', stage: null, error: {code, retryable}, photos: [], candidates: [], visibleCandidates: []});
    }
    run.abort.abort();
    await discard(run);
  };
  let subscriptionError: unknown;
  const changed = deps.store.addListener('changed', () => {
    const run = active;
    if (!run || run.abort.signal.aborted) return;
    // Listener can race an await in the tool: every async boundary also revalidates references.
    run.validation = run.validation.then(() => tools.validateReferences(run)).catch(async error => {
      await fail(run, error);
    });
  }).catch(error => { subscriptionError = error; return null; });
  const fresh = (query: string) => {
    const previous = active;
    previous?.abort.abort();
    const run = new SearchRun(query, queryContext());
    active = run;
    publish({...empty(), status: 'running', runId: run.id, query, stepsExpanded: true});
    return {run, previous};
  };
  const before = async (run: SearchRun, previous: SearchRun | null) => {
    await stopVoice();
    if (previous) await discard(previous);
    await changed;
    if (subscriptionError) throw subscriptionError;
    check(run);
    requireValue(await deps.isOnline(), 'offline');
    check(run);
  };
  const options = (run: SearchRun) => ({signal: run.abort.signal, ...(deps.fixture ? {fixture: deps.fixture} : {}), onQueryToken: (token: string) => {
    if (active === run && !run.abort.signal.aborted) run.token = token;
  }});
  const receiveToken = (run: SearchRun, token: unknown) => {
    requireValue(text(token, 12 * 1048576), 'upstream_error');
    run.token = token;
  };

  const extract = async (run: SearchRun, call: Extract<Schema['ToolCallsResponse']['toolCalls'][number], {name: 'extract_items'}>): Promise<ToolResult> => {
    const args = call.arguments;
    refs(args.photoRefs, 3);
    requireValue(args.photoRefs.every(key => run.found.has(key)));
    requireValue(run.samPhotos + args.photoRefs.length <= 3, 'photo_limit_exceeded');
    requireValue(run.token, 'query_token_invalid');
    const photos: Schema['SegmentPhoto'][] = [];
    for (const photoRef of args.photoRefs) {
      const photo = run.photos.get(photoRef)!;
      const image = await deps.media.preparePhoto(photo, run.abort.signal);
      check(run);
      requireValue(image.width > 0 && image.height > 0 && Math.max(image.width, image.height) <= 2048, 'invalid_image');
      photos.push({photoRef, image: {mimeType: image.mimeType, data: image.data, width: image.width, height: image.height}});
    }
    await tools.validateReferences(run);
    const body: Schema['SearchSegmentRequest'] = {queryToken: run.token, concept: args.concept, photos};
    requireValue(new TextEncoder().encode(JSON.stringify(body)).byteLength <= 20 * 1048576, 'payload_too_large');
    run.samPhotos += photos.length;
    const response = await deps.relay.request('/v1/search/segment', body, options(run));
    check(run);
    receiveToken(run, response.queryToken);
    await tools.validateReferences(run);
    requireValue(Array.isArray(response.photos) && response.photos.length === photos.length, 'invalid_tool_response');
    const summaries: Schema['ExtractSummary'][] = [];
    for (let i = 0; i < response.photos.length; i++) {
      const group = response.photos[i];
      requireValue(group.photoRef === photos[i].photoRef && Array.isArray(group.candidates));
      const photo = run.photos.get(group.photoRef)!;
      const cached = [];
      for (const candidate of group.candidates) {
        requireValue(Number.isFinite(candidate.score) && candidate.score >= 0 && candidate.score <= 1 && candidate.label === args.concept);
        const result = await deps.media.cacheCandidate(photo, candidate, run.abort.signal);
        // Register before checking cancellation so a late write is still reclaimed.
        run.files.add(result.mask);
        check(run);
        await tools.validateReferences(run);
        cached.push(result);
      }
      run.candidates.set(group.photoRef, cached);
      summaries.push({photoRef: group.photoRef, candidateCount: cached.length, topScore: cached.length ? Math.max(...cached.map(c => c.score)) : null});
    }
    run.concept = args.concept;
    return {name: call.name, toolCallId: call.id, result: summaries};
  };

  const search = async (run: SearchRun) => {
    emit({type: 'query_started', runId: run.id});
    let result: ToolResult | undefined;
    while (run.turns < 4) {
      check(run);
      await run.validation;
      check(run);
      await tools.validateReferences(run);
      requireValue(await deps.isOnline(), 'offline');
      check(run);
      const body = serializeTurn(run.query, run.context, run.token, result);
      run.turns++;
      const response = await deps.relay.request('/v1/search/turn', body, options(run));
      check(run);
      receiveToken(run, response.queryToken);
      await tools.validateReferences(run);
      const raw: unknown = response;
      object(raw, ['queryToken', 'toolCalls', 'final', 'not_found']);
      requireValue(['toolCalls', 'final', 'not_found'].filter(key => key in raw).length === 1, 'upstream_error');
      if ('final' in response) {
        const final = tools.final(run, response.final);
        await run.validation;
        check(run);
        emit({type: 'query_completed', runId: run.id});
        run.token = undefined;
        publish({...final, status: 'results', stage: null, visibleCandidates: final.candidates.slice(0, 3), stepsExpanded: false});
        return;
      }
      if ('not_found' in response) {
        object(response.not_found, ['reason']);
        requireValue(text(response.not_found.reason, 300), 'upstream_error');
        emit({type: 'query_not_found', runId: run.id});
        publish({status: 'not_found', stage: null, summary: response.not_found.reason, stepsExpanded: false});
        await discard(run);
        return;
      }
      requireValue(Array.isArray(response.toolCalls) && response.toolCalls.length === 1, 'upstream_error');
      const call = validateCall(response.toolCalls[0]);
      // A tool on turn four cannot be answered without a forbidden fifth turn.
      requireValue(run.turns < 4, 'upstream_error');
      if (call.name !== 'find_photos') emit({type: 'tool_started', runId: run.id, toolCallId: call.id, toolName: call.name});
      result = call.name === 'extract_items' ? await extract(run, call) : await tools.execute(run, call);
      check(run);
      await tools.validateReferences(run);
      emit({type: 'tool_completed', runId: run.id, toolCallId: call.id, toolName: call.name});
    }
    throw new AgentError('turn_limit_exceeded');
  };
  const submit = async (query: string) => {
    if (disposed) return;
    const {run, previous} = fresh(query);
    await queue(async () => {
      try { await before(run, previous); requireValue(text(query, 2000), 'invalid_query'); await search(run); }
      catch (error) { await fail(run, error); }
      finally { if (active !== run || run.abort.signal.aborted) await discard(run); }
    });
  };

  const completeVoice = async (session: NonNullable<typeof voiceSession>, recording: VoiceRecording) => {
    const run = session.run;
    if (session.completed || active !== run || run.abort.signal.aborted) {
      if (!run.files.has(recording.file)) await deps.media.discard(recording.file);
      return;
    }
    session.completed = true;
    run.files.add(recording.file);
    emit({type: 'voice_stopped', runId: run.id});
    await queue(async () => {
      let transcript: string | undefined;
      try {
        check(run);
        requireValue(await deps.isOnline(), 'offline');
        const bytes = await deps.media.readVoice(recording.file, run.abort.signal);
        check(run);
        const response = await deps.relay.request('/v1/transcribe', {audio: voiceAudio(bytes)}, options(run));
        check(run);
        requireValue(response.language === 'en' && typeof response.text === 'string', 'upstream_error');
        if (response.text.trim()) transcript = response.text;
        else publish({status: 'idle', stage: null, stepsExpanded: false, notice: "I didn't catch that. Try again."});
      } catch (error) { await fail(run, error); }
      finally { await stopVoice(); await discard(run); }
      if (transcript !== undefined && active === run && !run.abort.signal.aborted) {
        // A new context is captured at the actual search start, not recording start.
        const next = new SearchRun(transcript, queryContext());
        active = next;
        publish({...empty(), status: 'running', runId: next.id, query: transcript, stepsExpanded: true});
        try { await search(next); } catch (error) { await fail(next, error); }
        finally { if (active !== next || next.abort.signal.aborted) await discard(next); }
      }
    });
  };
  const startVoice = async () => {
    if (disposed) return;
    const {run, previous} = fresh('');
    await queue(async () => {
      try {
        await before(run, previous);
        const session = {run, listeners: [] as Listener[], completed: false};
        voiceSession = session;
        session.listeners.push(await deps.voice.addListener('completed', recording => { void completeVoice(session, recording); }));
        session.listeners.push(await deps.voice.addListener('error', error => {
          if (active !== run || run.abort.signal.aborted) return;
          if (error.code === 'no_speech') {
            run.abort.abort();
            publish({status: 'idle', stage: null, stepsExpanded: false, notice: "I didn't catch that. Try again."});
            void queue(async () => { await stopVoice(); await discard(run); });
          } else void queue(async () => { await stopVoice(); await fail(run, error); });
        }));
        check(run);
        await deps.voice.start();
        check(run);
        emit({type: 'voice_started', runId: run.id});
      } catch (error) { await stopVoice(); await fail(run, error); }
    });
  };
  const cancel = async () => {
    const run = active;
    if (run) { emit({type: 'query_cancelled', runId: run.id}); run.abort.abort(); }
    active = null;
    publish(empty());
    await queue(async () => { await stopVoice(); if (run) await discard(run); });
  };
  return {
    getState: () => state,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    submit, startVoice,
    stopVoice: async () => {
      const run = voiceSession?.run;
      if (!run || voiceSession?.completed) return;
      try { await deps.voice.stop(); } // Only completed event is authoritative, never the returned recording.
      catch (error) { await fail(run, error); }
    },
    cancel,
    setStepsExpanded: stepsExpanded => publish({stepsExpanded}),
    setShowAll: showAll => publish({showAll, visibleCandidates: showAll ? state.candidates : state.candidates.slice(0, 3)}),
    dispose: async () => { await cancel(); disposed = true; await (await changed)?.remove(); listeners.clear(); },
  };
}
