import {describe, expect, it, vi} from 'vitest';
import type {Capture, Store} from '../contracts';
import {createBootstrapPlugin} from './bootstrap';
import {createMockContext} from './context';

describe('device web bootstrap', () => {
  it('isolates injected fixtures, permissions, failures and time between contexts', async () => {
    const a = createMockContext({now: 10, fixtures: {image: {id: 'one'}}, permissions: {camera: 'denied'}, failures: {'Capture.takePhoto': {code: 'camera_permission_denied', message: 'denied', retryable: false}}});
    const b = createMockContext({now: 20});
    a.clock.advance(5);
    const image = a.fixture<{id: string}>('image');
    if (image) image.id = 'changed';
    expect(a.fixture('image')).toEqual({id: 'one'});
    expect(b.fixture('image')).toBeUndefined();
    expect([a.clock.now(), b.clock.now(), a.permission('camera'), b.permission('camera')]).toEqual([15, 20, 'denied', 'prompt']);
    const capture = createBootstrapPlugin<Capture>('Capture', a);
    await expect(capture.takePhoto({kind: 'item'})).rejects.toMatchObject({code: 'camera_permission_denied'});
    await expect(createBootstrapPlugin<Capture>('Capture', b).takePhoto({kind: 'item'})).rejects.toMatchObject({code: 'unimplemented'});
  });

  it('fails unimplemented reads and writes without networking or claiming persistence', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const store = createBootstrapPlugin<Store>('Store', createMockContext());
      await expect(store.getSelfPhoto()).rejects.toMatchObject({code: 'unimplemented', retryable: false});
      await expect(store.deleteTrip({id: 'trip'})).rejects.toMatchObject({code: 'unimplemented'});
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally { fetchSpy.mockRestore(); }
  });
});
