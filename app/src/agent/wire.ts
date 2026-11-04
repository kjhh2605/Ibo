import type {Schema, ToolCall, ToolResult} from './types';

export class AgentError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  constructor(code: string, retryable = false) {
    super('Search could not be completed.');
    this.code = code;
    this.retryable = retryable;
  }
}
export function requireValue(condition: unknown, code = 'invalid_tool_response'): asserts condition {
  if (!condition) throw new AgentError(code);
}
export function text(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}
export function ref(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}
export function object(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  requireValue(value !== null && typeof value === 'object' && !Array.isArray(value));
  requireValue(Object.keys(value).every(key => keys.includes(key)));
}
export function refs(value: unknown, max = Infinity): asserts value is string[] {
  requireValue(Array.isArray(value) && value.length > 0 && value.length <= max && value.every(ref) && new Set(value).size === value.length);
}
export function interval(from?: string, to?: string): [number, number] {
  const parse = (value: string) => {
    requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(value));
    const n = Date.parse(value);
    requireValue(Number.isFinite(n));
    return n;
  };
  const a = from === undefined ? -Infinity : parse(from);
  const b = to === undefined ? Infinity : parse(to);
  requireValue(a < b);
  return [a, b];
}
export function inInterval(time: number, range: [number, number], now: number): boolean {
  return time >= range[0] && time < range[1] && time <= now;
}
export function queryContext(): Schema['QueryContext'] {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const local = new Date(now.getTime() + offset * 60000).toISOString().slice(0, -1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {now: `${local}${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone};
}
export function validateCall(value: unknown): ToolCall {
  object(value, ['id', 'name', 'arguments', 'phraseVector']);
  requireValue(ref(value.id));
  const a = value.arguments;
  if (value.name === 'list_visits') {
    object(a, ['from', 'to', 'limit']);
    interval(a.from as string | undefined, a.to as string | undefined);
    requireValue(a.limit === undefined || Number.isInteger(a.limit) && Number(a.limit) >= 1 && Number(a.limit) <= 10000);
    requireValue(value.phraseVector === undefined);
  } else if (value.name === 'find_photos') {
    object(a, ['phrase', 'shopRefs', 'timeFrom', 'timeTo', 'k']);
    requireValue(text(a.phrase, 160));
    if (a.shopRefs !== undefined) refs(a.shopRefs);
    interval(a.timeFrom as string | undefined, a.timeTo as string | undefined);
    requireValue(a.k === undefined || Number.isInteger(a.k) && Number(a.k) >= 1 && Number(a.k) <= 3);
    const v = value.phraseVector;
    requireValue(Array.isArray(v) && v.length === 512 && v.every(n => typeof n === 'number' && Number.isFinite(n)), 'index_unavailable');
    requireValue(Math.abs(Math.hypot(...v) - 1) <= 1e-5, 'index_unavailable');
  } else if (value.name === 'extract_items') {
    object(a, ['photoRefs', 'concept']);
    refs(a.photoRefs);
    requireValue(a.photoRefs.length <= 3, 'photo_limit_exceeded');
    requireValue(text(a.concept, 160) && value.phraseVector === undefined);
  } else throw new AgentError('invalid_tool_response');
  return value as ToolCall;
}

// Construct every outgoing search object explicitly. Never spread local DTOs or tool calls.
export function serializeTool(result: ToolResult): ToolResult {
  if (result.name === 'list_visits') return {
    toolCallId: result.toolCallId, name: result.name,
    result: {matchingCount: result.result.matchingCount, truncated: result.result.truncated, visits: result.result.visits.map(v => ({
      tripRef: v.tripRef, tripStartedAt: v.tripStartedAt, tripStatus: v.tripStatus,
      ...(v.tripEndedAt === undefined ? {} : {tripEndedAt: v.tripEndedAt}),
      shopRef: v.shopRef, n: v.n, startedAt: v.startedAt, descriptionState: v.descriptionState,
      ...(v.descriptionState === 'done' && v.description ? {description: v.description} : {}),
      ...(v.note ? {note: v.note} : {}), photoCount: v.photoCount,
      ...(v.firstPhotoAt ? {firstPhotoAt: v.firstPhotoAt} : {}), ...(v.lastPhotoAt ? {lastPhotoAt: v.lastPhotoAt} : {}),
    }))},
  };
  if (result.name === 'find_photos') return {toolCallId: result.toolCallId, name: result.name, result: result.result.map(p => ({photoRef: p.photoRef, shopRef: p.shopRef, takenAt: p.takenAt, score: p.score}))};
  return {toolCallId: result.toolCallId, name: result.name, result: result.result.map(p => ({photoRef: p.photoRef, candidateCount: p.candidateCount, topScore: p.topScore}))};
}
export function serializeTurn(query: string, context: Schema['QueryContext'], token?: string, result?: ToolResult): Schema['SearchTurnRequest'] {
  const request: Schema['SearchTurnRequest'] = {query};
  if (token) request.queryToken = token;
  else request.context = {now: context.now, timeZone: context.timeZone};
  if (result) request.toolResults = [serializeTool(result)];
  requireValue(new TextEncoder().encode(JSON.stringify(request)).byteLength <= 16 * 1048576, 'payload_too_large');
  return request;
}
export function voiceAudio(bytes: Uint8Array): Schema['Audio'] {
  requireValue(bytes.length >= 46 && bytes.length <= 512 * 1024, 'invalid_audio');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  requireValue(tag(0) === 'RIFF' && tag(8) === 'WAVE' && tag(12) === 'fmt ' && tag(36) === 'data', 'invalid_audio');
  requireValue(view.getUint32(4, true) === bytes.length - 8 && view.getUint32(16, true) === 16 && view.getUint16(20, true) === 1 && view.getUint16(22, true) === 1 && view.getUint32(24, true) === 16000 && view.getUint32(28, true) === 32000 && view.getUint16(32, true) === 2 && view.getUint16(34, true) === 16, 'invalid_audio');
  const size = view.getUint32(40, true);
  requireValue(size === bytes.length - 44 && size % 2 === 0 && size >= 2 && size <= 480000, 'invalid_audio');
  return {mimeType: 'audio/wav', data: base64(bytes)};
}
export function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
