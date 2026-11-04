import {Capacitor} from '@capacitor/core';
import {Directory, Filesystem} from '@capacitor/filesystem';
import type {FileRef} from './contracts';
import {Store} from './store';
import {getWebRepository} from '../data/web/repository';
import {getMockContext} from './web/context';

function failure(code: string): never {
  throw {code, message: 'The device file operation could not be completed.', retryable: code === 'io_error'};
}
function webRepository() {
  if (import.meta.env.VITE_SF_RUNTIME !== 'web-mock') failure('unavailable');
  return getWebRepository();
}
let roots: Promise<string[]> | undefined;
function privateRoots() {
  return roots ??= Promise.all([Directory.Data, Directory.Cache].map(async directory => {
    const {uri} = await Filesystem.getUri({directory, path: ''});
    return decodeURIComponent(new URL(uri).pathname).replace(/\/$/, '') + '/';
  })).catch(error => { roots = undefined; throw error; });
}
async function requirePrivateFile(file: FileRef): Promise<void> {
  let path: string;
  try {
    // Reject traversal before URL normalizes it. Only app-generated file URIs are accepted.
    const decoded = decodeURIComponent(file);
    if (!decoded.startsWith('file:///') || decoded.includes('\\') || decoded.includes('\0') ||
        decoded.split('/').some(part => part === '.' || part === '..')) failure('file_not_owned');
    const url = new URL(file);
    if (url.protocol !== 'file:' || url.host || url.search || url.hash) failure('file_not_owned');
    path = decodeURIComponent(url.pathname);
  } catch { failure('file_not_owned'); }
  if (!(await privateRoots()).some(root => path.startsWith(root) && path.length > root.length)) failure('file_not_owned');
}
function encode(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
  return btoa(chunks.join(''));
}
function safeError(error: unknown): never {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  failure(['file_not_owned', 'not_found', 'invalid_argument', 'invalid_reference', 'unavailable'].includes(code) ? code : 'io_error');
}

export async function readBytes(file: FileRef): Promise<Uint8Array> {
  try {
    if (!Capacitor.isNativePlatform()) return new Uint8Array(await (await webRepository().readBlob(file)).arrayBuffer());
    await requirePrivateFile(file);
    const {data} = await Filesystem.readFile({path: file});
    if (typeof data !== 'string') failure('io_error');
    return Uint8Array.from(atob(data), value => value.charCodeAt(0));
  } catch (error) { return safeError(error); }
}

export async function writeTemp({bytes, mime, purpose, ownerId}: {
  bytes: Uint8Array; mime: string; purpose: 'candidate-mask' | 'provider'; ownerId?: string;
}): Promise<FileRef> {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength ||
      !['image/png', 'image/jpeg'].includes(mime) ||
      (purpose !== 'candidate-mask' && purpose !== 'provider') ||
      (purpose === 'candidate-mask' && (mime !== 'image/png' || typeof ownerId !== 'string' || !ownerId.length || ownerId.length > 128)) ||
      (purpose === 'provider' && ownerId !== undefined)) failure('invalid_argument');
  try {
    if (!Capacitor.isNativePlatform()) {
      // Blob storage and owner deletion are shared with Store; never keep production bytes in a second database.
      const repository = webRepository();
      const file = await repository.writeBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], {type: mime}), purpose, ownerId);
      try {
        if (purpose === 'provider') {
          const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
          const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
          const context = getMockContext();
          const fixture = context.fixture<unknown>(`Segmenter.provider:${hash}`);
          if (fixture !== undefined) context.setFixture(`Segmenter.asset:${file}`, fixture);
        }
        return file;
      } catch (error) {
        await repository.discardTemp({file});
        throw error;
      }
    }
    const path = `relay/${purpose}/${crypto.randomUUID()}.${mime === 'image/png' ? 'png' : 'jpg'}`;
    const {uri} = await Filesystem.getUri({directory: Directory.Cache, path});
    await requirePrivateFile(uri);
    try {
      await Filesystem.writeFile({directory: Directory.Cache, path, data: encode(bytes), recursive: true});
      if (purpose === 'candidate-mask') {
        // Private method on the existing Store plugin, not another public device plugin.
        const nativeStore = Store as typeof Store & {registerTemp(o: {file: FileRef; ownerId: string}): Promise<void>};
        await nativeStore.registerTemp({file: uri, ownerId: ownerId!});
      }
      return uri;
    } catch (error) {
      await Filesystem.deleteFile({directory: Directory.Cache, path}).catch(() => undefined);
      throw error;
    }
  } catch (error) { return safeError(error); }
}
