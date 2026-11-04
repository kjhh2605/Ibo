import {Capacitor} from '@capacitor/core';
import {config} from './config';
import {Store} from './native/store';

// Counters cover these named JS boundaries, not arbitrary native reads or provider retention.
const scope = 'relay-attempts/shared-file-reads/media-export-attempts' as const;
type Counters = {counts: Record<string, number>; rawSelfReads: number; headMaskReads: number; resultExports: number};
let counters: Counters | undefined;
let enabling: Promise<boolean> | undefined;
const originals = new Set<string>();
const masks = new Set<string>();

function rememberSelf(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  if ('value' in value) value = value.value;
  if (!value || typeof value !== 'object') return;
  if ('file' in value && typeof value.file === 'string') originals.add(value.file);
  if ('headMask' in value && typeof value.headMask === 'string') masks.add(value.headMask);
}

/** Opt-in only; native release and missing/failed native debug proof fail closed. */
export function enableVerification(): Promise<boolean> {
  return enabling ??= (async () => {
    if (import.meta.env.VITE_SF_VERIFICATION !== '1') return false;
    if (Capacitor.isNativePlatform()) {
      try {
        const bridge = Store as typeof Store & {getRuntimeInfo(): Promise<{debug: boolean}>};
        if ((await bridge.getRuntimeInfo()).debug !== true) return false;
      } catch { return false; }
    } else if (config.runtime !== 'web-mock' || !import.meta.env.DEV) return false;
    try {
      const self = await Store.getSelfPhoto();
      rememberSelf(self);
      counters = {counts: {}, rawSelfReads: 0, headMaskReads: 0, resultExports: 0};
      return true;
    } catch { return false; }
  })();
}

export function verificationSnapshot() {
  return counters ? {...counters, counts: {...counters.counts}, knownSelfVersions: originals.size, scope} : null;
}

export function observeRelayAttempt(path: string): void {
  if (counters) counters.counts[path] = (counters.counts[path] ?? 0) + 1;
}

export function observeFileRead(file: string): void {
  if (!counters) return;
  if (originals.has(file)) counters.rawSelfReads++;
  if (masks.has(file)) counters.headMaskReads++;
}

export function observePluginAttempt(name: string, method: PropertyKey): void {
  if (counters && name === 'Media' && method === 'exportResult') counters.resultExports++;
}

export function observePluginResult(name: string, method: PropertyKey, result: unknown): void {
  if (!counters) return;
  if (name === 'Store' && method === 'getSelfPhoto') rememberSelf(result);
  if (name === 'FaceMask' && method === 'register' && result && typeof result === 'object' && 'selfPhoto' in result) rememberSelf(result.selfPhoto);
}
