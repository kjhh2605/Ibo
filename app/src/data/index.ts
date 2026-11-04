import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {Network} from '@capacitor/network';
import type {EntityMap, Listener} from '../native/contracts';
import {readBytes} from '../native/files';
import {Store} from '../native/store';
import {relay} from '../relay/client';
import {describeImage} from './images';
import {DescribeQueue} from './queue';

export {Store};
export {DescribeQueue} from './queue';
export type {DescribeTransport, QueueEnvironment} from './queue';

export interface ListOptions<K extends keyof EntityMap> {
  entity: K;
  tripId?: string;
  shopId?: string;
  origin?: 'shop' | 'wardrobe';
}
export async function listAll<K extends keyof EntityMap>(options: ListOptions<K>): Promise<EntityMap[K][]> {
  const items: EntityMap[K][] = [];
  let cursor: string | undefined;
  do {
    const page = await Store.list({...options, limit: 200, ...(cursor ? {cursor} : {})});
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

/** Stable candidate identity uses decoded directional binary pixels, never PNG compression bytes. */
export async function candidateId(photoId: string, source: 'sam' | 'edgetam', binaryPixels: Uint8Array): Promise<string> {
  if (!photoId || photoId.length > 128 || !binaryPixels.length || (source !== 'sam' && source !== 'edgetam')) throw {code: 'invalid_input', retryable: false};
  for (const value of binaryPixels) if (value !== 0 && value !== 255) throw {code: 'invalid_input', retryable: false};
  const prefix = new TextEncoder().encode(photoId + source);
  const bytes = new Uint8Array(prefix.length + binaryPixels.length);
  bytes.set(prefix);
  bytes.set(binaryPixels, prefix.length);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, value => value.toString(16).padStart(2, '0')).join('');
}

let worker: DescribeQueue | undefined;
let startup: Promise<void> | undefined;
let listeners: Listener[] = [];
let visible = true;
let connected = false;
let visibilityListener: (() => void) | undefined;

/** App-shell lifetime only; search/try-on calls never pass through this retry worker. */
export function startDataWorker(): Promise<void> {
  if (startup) return startup;
  startup = (async () => {
    connected = (await Network.getStatus()).connected;
    visible = Capacitor.isNativePlatform() ? (await App.getState()).isActive : document.visibilityState !== 'hidden';
    const queue = new DescribeQueue(Store, relay, {
      now: () => Date.now(),
      foreground: () => visible,
      online: () => connected,
      schedule: (callback, delay) => setTimeout(callback, delay),
      cancel: handle => clearTimeout(handle as number),
      image: async file => describeImage(await readBytes(file)),
    });
    worker = queue;
    listeners.push(await Network.addListener('networkStatusChange', state => { connected = state.connected; queue.wake(); }));
    if (Capacitor.isNativePlatform()) {
      listeners.push(await App.addListener('appStateChange', state => { visible = state.isActive; queue.wake(); }));
    } else {
      visibilityListener = () => { visible = document.visibilityState !== 'hidden'; queue.wake(); };
      document.addEventListener('visibilitychange', visibilityListener);
    }
    await queue.start();
  })().catch(async error => {
    await cleanupWorker();
    startup = undefined;
    throw error;
  });
  return startup;
}
async function cleanupWorker() {
  await worker?.stop();
  worker = undefined;
  await Promise.all(listeners.map(listener => listener.remove()));
  listeners = [];
  if (visibilityListener) document.removeEventListener('visibilitychange', visibilityListener);
  visibilityListener = undefined;
}
export async function stopDataWorker() {
  try { await startup; } catch { /* Failed startup already released its listeners. */ }
  await cleanupWorker();
  startup = undefined;
}
