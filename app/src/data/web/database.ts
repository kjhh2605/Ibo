import {deferred} from '../../deferred';
import type {Asset, EntityMap, FileRef, ResultPieceSnapshot, SelfPhoto} from '../../native/contracts';
import {failure} from './images';

export const entities = ['Trip', 'TrailPoint', 'Shop', 'Photo', 'PhotoEmbedding', 'Piece', 'Result', 'QueueJob'] as const;
const stores = [...entities, 'files', 'assets', 'drafts', 'self', 'meta'];
export type FileRow = {file: FileRef; blob: Blob; purpose: string; owner: string; epoch: string; pins: number; discard: boolean; sourceId?: string};
export type AssetRow = {asset: Asset; purpose: string};
export type Draft = {draftId: string; targetSnapshot: ResultPieceSnapshot; companionSnapshots: ResultPieceSnapshot[]};
export type SelfVersion = {selfPhoto: SelfPhoto; refs: number; current: boolean};
type Rows = EntityMap & {files: FileRow; assets: AssetRow; drafts: Draft; self: SelfVersion; meta: {value: string}};

function request<T>(value: IDBRequest<T>): Promise<T> {
  const {promise, resolve, reject} = deferred<T>();
  value.onsuccess = () => resolve(value.result);
  value.onerror = () => reject(value.error);
  return promise;
}
export class Transaction {
  async get<K extends keyof Rows>(store: K, key: IDBValidKey): Promise<Rows[K] | undefined> { return request(this.transaction.objectStore(store).get(key)); }
  readonly transaction: IDBTransaction;
  constructor(transaction: IDBTransaction) { this.transaction = transaction; }
  async all<K extends keyof Rows>(store: K): Promise<Rows[K][]> { return request(this.transaction.objectStore(store).getAll()); }
  async put<K extends keyof Rows>(store: K, key: IDBValidKey, value: Rows[K]): Promise<void> { await request(this.transaction.objectStore(store).put(value, key)); }
  async delete(store: keyof Rows, key: IDBValidKey): Promise<void> { await request(this.transaction.objectStore(store).delete(key)); }
  async file(file: FileRef): Promise<FileRow> { return (await this.get('files', file)) ?? failure('file_not_owned'); }
  async copy(file: FileRef, owner: string, purpose: string, epoch: string): Promise<FileRef> {
    const source = await this.file(file);
    return this.blob(source.blob.slice(0, source.blob.size, source.blob.type), owner, purpose, epoch);
  }
  async blob(blob: Blob, owner: string, purpose: string, epoch: string): Promise<FileRef> {
    const file = `sf-blob:${crypto.randomUUID()}`;
    await this.put('files', file, {file, blob, owner, purpose, epoch, pins: 0, discard: false});
    return file;
  }
  async removeFile(file: FileRef): Promise<void> {
    const row = await this.get('files', file);
    if (!row) return;
    if (row.pins) await this.put('files', file, {...row, discard: true});
    else await this.delete('files', file);
  }
  async removeOwner(owner: string): Promise<void> {
    for (const file of await this.all('files')) if (file.owner === owner) await this.removeFile(file.file);
  }
}

export class Database {
  private connection: Promise<IDBDatabase> | undefined;
  readonly name: string;
  constructor(name: string) { this.name = name; }
  private open(): Promise<IDBDatabase> {
    if (this.connection) return this.connection;
    const {promise, resolve, reject} = deferred<IDBDatabase>();
    this.connection = promise;
    if (!globalThis.indexedDB) { reject({code: 'io_error', message: 'IndexedDB unavailable', retryable: false}); return promise; }
    const opening = indexedDB.open(this.name, 1);
    opening.onupgradeneeded = () => { for (const store of stores) if (!opening.result.objectStoreNames.contains(store)) opening.result.createObjectStore(store); };
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject({code: 'busy', message: 'Storage upgrade blocked', retryable: true});
    opening.onsuccess = () => { opening.result.onversionchange = () => opening.result.close(); resolve(opening.result); };
    return promise;
  }
  async run<T>(write: boolean, work: (tx: Transaction) => Promise<T>): Promise<T> {
    const db = await this.open();
    const transaction = db.transaction(stores, write ? 'readwrite' : 'readonly');
    const {promise: done, resolve, reject} = deferred<void>();
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('Aborted'));
    transaction.onerror = () => { /* The abort event owns rejection. */ };
    void done.catch(() => {});
    try {
      const value = await work(new Transaction(transaction));
      await done;
      return value;
    } catch (error) {
      try { transaction.abort(); } catch { /* Already completed/aborted. */ }
      await done.catch(() => {});
      if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') throw error;
      failure(error instanceof DOMException && error.name === 'QuotaExceededError' ? 'storage_full' : 'io_error');
    }
  }
  async close(): Promise<void> { if (this.connection) (await this.connection).close(); this.connection = undefined; }
}
