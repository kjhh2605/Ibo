import {deferred} from '../../deferred';
import {failure} from './images';

type Release = () => Promise<void>;
type Lease = {epoch: string; users: number; ready: Promise<Release>};
const leases = new Map<string, Lease>();

async function browserLease(name: string): Promise<Release> {
  const locks = globalThis.navigator?.locks;
  // Node-only repository tests have no browser tabs; browsers must not skip exclusion.
  if (!locks && typeof window === 'undefined') return async () => {};
  if (!locks) failure('unavailable');
  const acquired = deferred<void>(), held = deferred<void>();
  const finished = locks.request(`street-fitting:${name}`, {mode: 'exclusive', ifAvailable: true}, async lock => {
    if (!lock) failure('busy');
    acquired.resolve();
    await held.promise;
  });
  void finished.catch(acquired.reject);
  await acquired.promise;
  return async () => {held.resolve(); await finished;};
}

/** One live browser runtime owns recovery/GC; same-runtime repository instances share it. */
export async function acquireDatabaseLease(name: string, epoch: string): Promise<Release> {
  let lease = leases.get(name);
  if (lease && lease.epoch !== epoch) failure('busy');
  if (!lease) {
    lease = {epoch, users: 0, ready: browserLease(name)};
    leases.set(name, lease);
  }
  const current = lease;
  current.users++;
  let release: Release;
  try {release = await current.ready;} catch (error) {
    current.users--;
    if (!current.users && leases.get(name) === current) leases.delete(name);
    throw error;
  }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    if (--current.users === 0) {
      if (leases.get(name) === current) leases.delete(name);
      await release();
    }
  };
}
