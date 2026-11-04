import {afterEach, describe, expect, it, vi} from 'vitest';
import {createRelayClient} from './client';
import {prepareMaskedSelfPhoto} from './selfPhoto';

const route = {origin: {lat: 37, lng: 127}, destination: {lat: 37.1, lng: 127.1}};

afterEach(() => vi.restoreAllMocks());

describe('relay boundaries', () => {
  it('authHeadersAttached: requires both credentials before sending', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const client = createRelayClient({auth: async () => ({idToken: 'id-sentinel', appCheckToken: 'app-sentinel'})});
    await client.request('/v1/route', route);
    const headers = fetch.mock.calls[0][1]?.headers;
    expect(headers).toMatchObject({Authorization: 'Bearer id-sentinel', 'X-Firebase-AppCheck': 'app-sentinel'});
    const denied = createRelayClient({auth: async () => ({idToken: 'id-sentinel', appCheckToken: ''})});
    fetch.mockClear();
    await expect(denied.request('/v1/route', route)).rejects.toMatchObject({code: 'unauthenticated'});
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the advanced query token on errors without exposing server text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({error: {code: 'upstream_error', message: 'private-provider-body', retryable: true}}), {status: 502, headers: {'X-Query-Token': 'closed-token'}}));
    const token = vi.fn();
    const client = createRelayClient({auth: async () => ({idToken: 'id', appCheckToken: 'app'})});
    await expect(client.request('/v1/route', route, {onQueryToken: token})).rejects.toMatchObject({code: 'upstream_error', queryToken: 'closed-token', message: 'The request could not be completed.'});
    expect(token).toHaveBeenCalledWith('closed-token');
  });

  it('noSecretsInLogs: discards authentication errors and never prints payloads', async () => {
    const log = vi.spyOn(console, 'log');
    const error = vi.spyOn(console, 'error');
    const warn = vi.spyOn(console, 'warn');
    const client = createRelayClient({auth: async () => { throw new Error('secret-auth-body'); }});
    await expect(client.request('/v1/route', route)).rejects.toMatchObject({message: 'The request could not be completed.'});
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not transmit after cancellation during authentication', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    const controller = new AbortController();
    const client = createRelayClient({auth: async () => { controller.abort(); return {idToken: 'id', appCheckToken: 'app'}; }});
    await expect(client.request('/v1/route', route, {signal: controller.signal})).rejects.toMatchObject({name: 'AbortError'});
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['error', 'complete'] as const)('preserves cancellation when the body stream will %s after headers arrive', async finish => {
    const controller = new AbortController();
    let stream!: ReadableStreamDefaultController<Uint8Array>;
    const response = new Response(new ReadableStream<Uint8Array>({
      start(value) { stream = value; },
    }), {headers: {'X-Query-Token': 'advanced-token'}});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const received = vi.fn();
    const client = createRelayClient({auth: async () => ({idToken: 'id', appCheckToken: 'app'})});
    const result = client.request('/v1/route', route, {signal: controller.signal, onQueryToken: received});
    const rejected = expect(result).rejects.toMatchObject({name: 'AbortError'});
    await vi.waitFor(() => expect(received).toHaveBeenCalledWith('advanced-token'));
    controller.abort();
    if (finish === 'error') {
      stream.error(controller.signal.reason);
    } else {
      stream.enqueue(new TextEncoder().encode('{}'));
      stream.close();
    }
    await rejected;
  });

  it('preserves a body reader AbortError even without a caller signal', async () => {
    const abort = new DOMException('Body read cancelled', 'AbortError');
    const response = new Response(new ReadableStream({
      start(stream) { stream.error(abort); },
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const client = createRelayClient({auth: async () => ({idToken: 'id', appCheckToken: 'app'})});
    await expect(client.request('/v1/route', route)).rejects.toBe(abort);
  });

  it('still translates malformed JSON while retaining the early query token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('not json', {headers: {'X-Query-Token': 'advanced-token'}}));
    const onQueryToken = vi.fn();
    const client = createRelayClient({auth: async () => ({idToken: 'id', appCheckToken: 'app'})});
    await expect(client.request('/v1/route', route, {onQueryToken})).rejects.toMatchObject({code: 'invalid_response', queryToken: 'advanced-token'});
    expect(onQueryToken).toHaveBeenCalledWith('advanced-token');
  });

  it('noRawSelfPhotoUpload: reads only maskedFile and blocks missing, alias and cancelled inputs', async () => {
    const image = {data: 'opaque-image', width: 1, height: 1, mimeType: 'image/png' as const};
    const read = vi.fn().mockResolvedValue(image);
    const self = {file: 'raw-sentinel', headMask: 'mask-sentinel', maskedFile: 'masked-derivative', updatedAt: 1};
    expect(await prepareMaskedSelfPhoto(self, read)).toEqual({image, headMasked: true});
    expect(read).toHaveBeenCalledWith('masked-derivative', undefined);
    read.mockClear();
    await expect(prepareMaskedSelfPhoto(null, read)).rejects.toThrow();
    await expect(prepareMaskedSelfPhoto({...self, maskedFile: self.file}, read)).rejects.toThrow();
    await expect(prepareMaskedSelfPhoto({...self, maskedFile: self.headMask}, read)).rejects.toThrow();
    await expect(prepareMaskedSelfPhoto(self, read, AbortSignal.abort())).rejects.toMatchObject({name: 'AbortError'});
    expect(read).not.toHaveBeenCalled();
  });
});
