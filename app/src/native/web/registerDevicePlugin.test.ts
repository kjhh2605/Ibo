import {afterEach, describe, expect, it, vi} from 'vitest';
import {Capacitor, registerPlugin} from '@capacitor/core';
import type * as CapacitorCore from '@capacitor/core';
import type {Capture} from '../contracts';
import {registerDevicePlugin} from '../registerDevicePlugin';
import {createBootstrapPlugin} from './bootstrap';
import {createMockContext, resetMockContext, setMockContext} from './context';

vi.mock('@capacitor/core', async importOriginal => ({
  ...await importOriginal<typeof CapacitorCore>(),
  registerPlugin: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  resetMockContext();
});

describe('registered device boundaries', () => {
  it.each([true, false])('normalizes nested native retryability (%s) and excludes bridge details', async retryable => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.stubEnv('VITE_SF_RUNTIME', 'web-mock');
    vi.mocked(registerPlugin).mockReturnValue({
      async takePhoto() {
        throw {code: 'camera_unavailable', message: 'private-file-path', data: {retryable, private: 'private-image-data'}};
      },
    });
    const web = vi.fn(async () => createBootstrapPlugin<Capture>('Capture'));
    const capture = registerDevicePlugin<Capture>('Capture', web);
    await expect(capture.takePhoto({kind: 'item'})).rejects.toEqual({
      code: 'camera_unavailable', message: 'The device operation could not be completed.', retryable,
    });
    expect(web).not.toHaveBeenCalled();
  });

  it.each([
    {code: 'unimplemented', data: {retryable: false}},
    {code: 'UNIMPLEMENTED'},
  ])('keeps native unimplemented failures explicit', async error => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.mocked(registerPlugin).mockReturnValue({async takePhoto() { throw error; }});
    const capture = registerDevicePlugin<Capture>('Capture', async () => createBootstrapPlugin<Capture>('Capture'));
    await expect(capture.takePhoto({kind: 'item'})).rejects.toMatchObject({code: 'unimplemented', retryable: false});
  });

  it('does not load a fixture when a non-mock browser plugin is unavailable', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    vi.stubEnv('VITE_SF_RUNTIME', 'web');
    vi.mocked(registerPlugin).mockReturnValue({async takePhoto() { throw {code: 'UNIMPLEMENTED'}; }});
    const web = vi.fn(async () => createBootstrapPlugin<Capture>('Capture'));
    const capture = registerDevicePlugin<Capture>('Capture', web);
    await expect(capture.takePhoto({kind: 'item'})).rejects.toMatchObject({code: 'unimplemented', retryable: false});
    expect(web).not.toHaveBeenCalled();
  });

  it('keeps cached mock plugins on the current default context while explicit contexts stay isolated', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    vi.stubEnv('VITE_SF_RUNTIME', 'web-mock');
    const a = createMockContext({failures: {'Capture.takePhoto': {code: 'camera_permission_denied', message: 'denied', retryable: false}}});
    const b = createMockContext({failures: {'Capture.takePhoto': {code: 'camera_unavailable', message: 'unavailable', retryable: true}}});
    setMockContext(a);
    const capture = registerDevicePlugin<Capture>('Capture', async () => createBootstrapPlugin<Capture>('Capture'));
    const isolated = createBootstrapPlugin<Capture>('Capture', a);
    const takePhoto = capture.takePhoto;
    await expect(takePhoto({kind: 'item'})).rejects.toMatchObject({code: 'camera_permission_denied', retryable: false});
    setMockContext(b);
    await expect(takePhoto({kind: 'item'})).rejects.toEqual({code: 'camera_unavailable', message: 'The device operation could not be completed.', retryable: true});
    await expect(isolated.takePhoto({kind: 'item'})).rejects.toMatchObject({code: 'camera_permission_denied', retryable: false});
    resetMockContext();
    await expect(takePhoto({kind: 'item'})).rejects.toMatchObject({code: 'unimplemented', retryable: false});
    await expect(isolated.takePhoto({kind: 'item'})).rejects.toMatchObject({code: 'camera_permission_denied', retryable: false});
  });

  it('turns an unexpected synchronous plugin failure into a safe nonretryable DTO', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    vi.mocked(registerPlugin).mockReturnValue({takePhoto() { throw new Error('private-file-path'); }});
    const capture = registerDevicePlugin<Capture>('Capture', async () => createBootstrapPlugin<Capture>('Capture'));
    await expect(capture.takePhoto({kind: 'item'})).rejects.toEqual({code: 'io_error', message: 'The device operation could not be completed.', retryable: false});
  });
});
