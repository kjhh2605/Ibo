// Explicit test-only dependencies. Production index.ts never imports this module.
import {vi} from 'vitest';
import type {Candidate, EntityMap, Photo, Shop, Trip, Voice, VoiceRecording} from '../native/contracts';
import type {AgentDependencies, Schema} from './types';

const time = (value: string) => Date.parse(value);
const location = {lat: 37.123456, lng: 127.123456, accuracyM: 4};
export const trips: Trip[] = [
  {id: 'private-trip-today', startedAt: time('2026-11-04T13:00:00+09:00'), endedAt: time('2026-11-04T14:00:00+09:00'), status: 'ended'},
  {id: 'private-trip-past', startedAt: time('2026-10-31T13:00:00+09:00'), endedAt: time('2026-10-31T14:00:00+09:00'), status: 'ended'},
];
export const shops: Shop[] = trips.map((trip, i) => ({id: `private-shop-${i}`, tripId: trip.id, n: 2, startedAt: trip.startedAt, spot: location, storefrontPhotoId: null, description: 'Blue sign', descriptionState: 'done', note: i === 0 ? 'red curtains and lat=notes, not a coordinate payload' : 'old denim shop'}));
export const photos: Photo[] = [
  ...['13:35:00', '13:44:59', '13:45:00'].map((at, i) => ({id: `private-photo-${i}`, tripId: trips[0].id, shopId: shops[0].id, kind: 'item' as const, takenAt: time(`2026-11-04T${at}+09:00`), location, file: `private-device-original-${i}.jpg`, w: 100, h: 200, indexState: 'done' as const})),
  {id: 'private-photo-past', tripId: trips[1].id, shopId: shops[1].id, kind: 'item', takenAt: time('2026-10-31T13:35:00+09:00'), location, file: 'private-device-past.jpg', w: 100, h: 200, indexState: 'done'},
  {id: 'private-storefront', tripId: trips[0].id, shopId: shops[0].id, kind: 'storefront', takenAt: time('2026-11-04T13:35:00+09:00'), location, file: 'private-storefront.jpg', w: 100, h: 200, indexState: 'done'},
];
export const vector = [1, ...Array<number>(511).fill(0)];
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
}
export function wav(samples = 240000): Uint8Array {
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  for (const [offset, tag] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as const) bytes.set(new TextEncoder().encode(tag), offset);
  view.setUint32(4, bytes.length - 8, true); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, 16000, true);
  view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, samples * 2, true);
  return bytes;
}
export const recording: VoiceRecording = {file: 'private-voice.wav', durationMs: 15000, sampleRate: 16000, channels: 1, bitsPerSample: 16};
export function fixture() {
  const records = {Trip: structuredClone(trips), Shop: structuredClone(shops), Photo: structuredClone(photos)};
  const changes = new Set<() => void>();
  const voiceListeners = new Map<string, Set<(value: never) => void>>();
  const voice = {
    addListener: vi.fn(async (name: string, listener: (value: never) => void) => {
      if (!voiceListeners.has(name)) voiceListeners.set(name, new Set());
      voiceListeners.get(name)!.add(listener);
      return {remove: async () => { voiceListeners.get(name)!.delete(listener); }};
    }),
    start: vi.fn(async () => {}), cancel: vi.fn(async () => {}),
    stop: vi.fn(async () => { emitVoice('completed', recording); return recording; }),
  } as unknown as Voice;
  function emitVoice(name: string, value: unknown) { for (const listener of voiceListeners.get(name) ?? []) listener(value as never); }
  const deps: AgentDependencies = {
    fixture: 's07-explicit-mock',
    store: {
      get: vi.fn(async ({entity, id}) => records[entity as keyof typeof records]?.find(row => row.id === id) ?? null) as AgentDependencies['store']['get'],
      list: vi.fn(async ({entity, cursor}) => {
        const rows = records[entity as keyof typeof records] ?? [];
        const offset = Number(cursor ?? 0);
        return {items: rows.slice(offset, offset + 1), nextCursor: offset + 1 < rows.length ? String(offset + 1) : null};
      }) as AgentDependencies['store']['list'],
      addListener: vi.fn(async (_name, listener) => { const wrapped = () => listener({entities: ['Trip', 'Shop', 'Photo'], ids: []}); changes.add(wrapped); return {remove: async () => { changes.delete(wrapped); }}; }),
    },
    photoIndex: {search: vi.fn(async ({photoIds, k}: {photoIds?: string[]; k: number}) => (photoIds ?? []).slice(0, k).map((photoId, i) => ({photoId, score: 0.9 - i * 0.1})))},
    voice,
    relay: {request: vi.fn()} as AgentDependencies['relay'],
    media: {
      preparePhoto: vi.fn(async (photo: Photo): Promise<Schema['Image']> => ({mimeType: 'image/png', data: 'SHOP_BYTES', width: photo.w, height: photo.h})),
      cacheCandidate: vi.fn(async (photo: Photo, candidate: Schema['SegmentCandidate']): Promise<Candidate> => ({id: `stable-${photo.id}-${candidate.id}`, photoId: photo.id, source: 'sam', label: candidate.label, score: candidate.score, mask: `cache/candidates/${photo.id}-${candidate.id}.png`, bbox: [0, 0, photo.w, photo.h]})),
      readVoice: vi.fn(async () => wav()), discard: vi.fn(async () => {}),
    },
    isOnline: vi.fn(async () => true),
  };
  return {deps, records, emitVoice, changed: () => { for (const listener of changes) listener(); }};
}
export function pipeline(deps: AgentDependencies, options: {shop?: 'today' | 'past'; time?: boolean; candidates?: number; beforeFinal?: () => Promise<void>} = {}) {
  let turn = 0;
  const calls: {path: string; body: unknown}[] = [];
  let refs: string[] = [];
  let chosenShop: string | undefined;
  const request = vi.fn(async (path: string, body: Schema['SearchTurnRequest'] | Schema['SearchSegmentRequest']) => {
    calls.push({path, body: structuredClone(body)});
    if (path === '/v1/search/segment') {
      const segment = body as Schema['SearchSegmentRequest'];
      return {queryToken: 'token-segment', photos: segment.photos.map(photo => ({photoRef: photo.photoRef, candidates: Array.from({length: options.candidates ?? 2}, (_, i) => ({id: `provider-${i}`, label: segment.concept, score: 0.8 - i * 0.1, bbox: [0, 0, 100, 200], mask: {mimeType: 'image/png', data: 'MASK', width: 100, height: 200}}))}))};
    }
    const req = body as Schema['SearchTurnRequest'];
    turn++;
    if (turn === 1) return {queryToken: 'token-1', toolCalls: [{id: 'list', name: 'list_visits', arguments: {}}]};
    if (turn === 2) {
      const visits = (req.toolResults![0] as Schema['ListVisitsToolResult']).result.visits;
      if (options.shop) chosenShop = visits[options.shop === 'today' ? 0 : 1].shopRef;
      return {queryToken: 'token-2', toolCalls: [{id: 'find', name: 'find_photos', arguments: {phrase: 'blue jacket', ...(chosenShop ? {shopRefs: [chosenShop]} : {}), ...(options.time ? {timeFrom: '2026-11-04T13:35:00+09:00', timeTo: '2026-11-04T13:45:00+09:00'} : {})}, phraseVector: vector}]};
    }
    if (turn === 3) {
      refs = (req.toolResults![0] as Schema['FindPhotosToolResult']).result.map(row => row.photoRef);
      return {queryToken: 'token-3', toolCalls: [{id: 'extract', name: 'extract_items', arguments: {concept: 'blue jacket', photoRefs: refs}}]};
    }
    await options.beforeFinal?.();
    return {queryToken: 'token-4', final: {photoRefs: refs, ...(chosenShop ? {shopRef: chosenShop} : {}), concept: 'blue jacket', summary: 'Found these blue jackets.'}};
  });
  deps.relay.request = request as unknown as AgentDependencies['relay']['request'];
  return {calls, request};
}
export type FixtureEntity = keyof Pick<EntityMap, 'Trip' | 'Shop' | 'Photo'>;
