import {beforeEach, expect, it, vi} from 'vitest';
// Reload the module per case because privateRoots caches the Android user's roots.
// A static import would retain the previous case's filesystem identity.

const state = vi.hoisted(() => ({root: '/data/user/0/com.streetfitting.app', reads: 0}));
vi.mock('@capacitor/core', () => ({Capacitor: {isNativePlatform: () => true}}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: {Data: 'DATA', Cache: 'CACHE'},
  Filesystem: {
    async getUri({directory}: {directory: string}) { return {uri: `file://${state.root}/${directory === 'DATA' ? 'files' : 'cache'}/`}; },
    async readFile() { state.reads++; return {data: 'AP9B'}; },
  },
}));
vi.mock('./store', () => ({Store: {}}));
vi.mock('../data/web/repository', () => ({getWebRepository: vi.fn()}));
vi.mock('./web/context', () => ({getMockContext: vi.fn()}));
vi.mock('../verification', () => ({observeFileRead: vi.fn()}));
beforeEach(() => { vi.resetModules(); state.root = '/data/user/0/com.streetfitting.app'; state.reads = 0; });

it('accepts Store canonical owner paths as the same private roots returned by Filesystem', async () => {
  const {readBytes} = await import('./files');
  expect(await readBytes('file:///data/data/com.streetfitting.app/files/store/photo/original')).toEqual(new Uint8Array([0, 255, 65]));
  expect(await readBytes('file:///data/user/0/com.streetfitting.app/cache/provider.png')).toEqual(new Uint8Array([0, 255, 65]));
});

it('never broadens aliases to other packages, users, storage or traversal', async () => {
  const {readBytes} = await import('./files');
  for (const file of [
    'file:///data/data/com.other.app/files/photo',
    'file:///data/user/10/com.streetfitting.app/files/photo',
    'file:///data/data/com.streetfitting.app/files-other/photo',
    'file:///data/data/com.streetfitting.app/files/../shared_prefs/auth.xml',
    'file:///data/data/com.streetfitting.app/files/%2e%2e/shared_prefs/auth.xml',
    'file:///sdcard/photo.png',
  ]) await expect(readBytes(file)).rejects.toMatchObject({code: 'file_not_owned'});
  expect(state.reads).toBe(0);
});

it('does not give secondary Android users access to owner-user aliases', async () => {
  state.root = '/data/user/10/com.streetfitting.app';
  const {readBytes} = await import('./files');
  await expect(readBytes('file:///data/data/com.streetfitting.app/files/photo')).rejects.toMatchObject({code: 'file_not_owned'});
  expect(state.reads).toBe(0);
});
