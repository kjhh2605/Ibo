import {Capacitor} from '@capacitor/core';
import type {paths} from '../generated/relay-api';
import {config, validateRelayOrigin} from '../config';
import {getAuthTokens} from './auth';
import type {AuthTokens} from './auth';
import {observeRelayAttempt} from '../verification';

type Endpoint = keyof paths;
type JsonBody<T> = T extends {content: {'application/json': infer B}} ? B : never;
export type RelayRequest<P extends Endpoint> = paths[P] extends {post: {requestBody: infer B}} ? JsonBody<B> : never;
export type RelayResponse<P extends Endpoint> = paths[P] extends {post: {responses: {200: infer R}}} ? JsonBody<R> : never;
export interface RequestOptions {
  signal?: AbortSignal;
  onQueryToken?: (token: string) => void;
  fixture?: string;
  beforeSend?: () => Promise<void>;
  forceRefreshAuth?: boolean;
}

export class RelayError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;
  readonly queryToken: string | null;
  readonly retryAfterMs: number | null;

  constructor(code: string, status: number, retryable: boolean, queryToken: string | null = null, retryAfterMs: number | null = null) {
    super('The request could not be completed.');
    this.name = 'RelayError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.queryToken = queryToken;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface RelayClientOptions {
  baseUrl?: string;
  auth?: (forceRefresh?: boolean) => Promise<AuthTokens>;
  mockTransport?: typeof fetch;
}

let webMockTransport: typeof fetch | undefined;
/** Explicit browser-fixture bootstrap only; this cannot bypass Android authentication. */
export function installWebMockTransport(transport: typeof fetch): () => void {
  if (config.runtime !== 'web-mock' || Capacitor.isNativePlatform()) throw new Error('Mock transport is restricted to browser fixtures.');
  webMockTransport = transport;
  return () => { if (webMockTransport === transport) webMockTransport = undefined; };
}

function retryAfterMs(value: string | null): number | null {
  if (value === null) return null;
  if (/^\d+$/.test(value)) {
    const milliseconds = Number(value) * 1000;
    return Number.isSafeInteger(milliseconds) ? milliseconds : null;
  }
  if (!/^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toUTCString() !== value) return null;
  return Math.max(0, timestamp - Date.now());
}

export function createRelayClient(options: RelayClientOptions = {}) {
  if (options.mockTransport && (config.runtime !== 'web-mock' || Capacitor.isNativePlatform())) {
    throw new Error('Mock transport requires the explicit web-mock runtime.');
  }
  const baseUrl = validateRelayOrigin(options.baseUrl ?? config.relayBaseUrl);
  const auth = options.auth ?? getAuthTokens;
  return {
    async request<P extends Endpoint>(path: P, body: RelayRequest<P>, request: RequestOptions = {}): Promise<RelayResponse<P>> {
      request.signal?.throwIfAborted();
      const mockTransport = config.runtime === 'web-mock' && !Capacitor.isNativePlatform() ? options.mockTransport ?? webMockTransport : undefined;
      const transport = mockTransport ?? globalThis.fetch.bind(globalThis);
      const headers: Record<string, string> = {'Content-Type': 'application/json; charset=utf-8'};
      if (!mockTransport) {
        let tokens: AuthTokens;
        try {
          tokens = await auth(request.forceRefreshAuth === true);
        } catch {
          request.signal?.throwIfAborted();
          throw new RelayError('unauthenticated', 401, false);
        }
        if (!tokens.idToken || !tokens.appCheckToken) throw new RelayError('unauthenticated', 401, false);
        headers.Authorization = `Bearer ${tokens.idToken}`;
        headers['X-Firebase-AppCheck'] = tokens.appCheckToken;
      }
      const fixture = request.fixture ?? config.relayFixture;
      if (fixture) headers['X-SF-Fixture'] = fixture;
      request.signal?.throwIfAborted();
      const encodedBody = JSON.stringify(body);
      await request.beforeSend?.();
      request.signal?.throwIfAborted();
      let response: Response;
      try {
        observeRelayAttempt(path);
        response = await transport(`${baseUrl}${path}`, {
          method: 'POST', headers, body: encodedBody, signal: request.signal, cache: 'no-store',
        });
      } catch {
        request.signal?.throwIfAborted();
        throw new RelayError('network_error', 0, true);
      }
      const token = response.headers.get('X-Query-Token');
      if (token) request.onQueryToken?.(token);
      let value: unknown;
      try {
        value = await response.json();
      } catch (error) {
        request.signal?.throwIfAborted();
        if (error instanceof Error && error.name === 'AbortError') throw error;
        throw new RelayError('invalid_response', response.status, false, token);
      }
      request.signal?.throwIfAborted();
      if (!response.ok) {
        const error = typeof value === 'object' && value !== null && 'error' in value ? value.error : null;
        const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && /^[a-z_]{1,64}$/.test(error.code) ? error.code : 'invalid_response';
        const retryable = typeof error === 'object' && error !== null && 'retryable' in error && error.retryable === true;
        throw new RelayError(code, response.status, retryable, token, retryAfterMs(response.headers.get('Retry-After')));
      }
      return value as RelayResponse<P>;
    },
  };
}

export const relay = createRelayClient();
