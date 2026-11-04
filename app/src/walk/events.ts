import type {Events, Listener} from '../native/contracts';

export class EventSource<E> implements Events<E> {
  #listeners = new Map<keyof E, Set<(event: never) => void>>();

  async addListener<K extends keyof E & string>(name: K, fn: (event: E[K]) => void): Promise<Listener> {
    let group = this.#listeners.get(name);
    if (!group) {
      group = new Set();
      this.#listeners.set(name, group);
    }
    group.add(fn as (event: never) => void);
    return {remove: async () => { group.delete(fn as (event: never) => void); }};
  }

  protected emit<K extends keyof E>(name: K, event: E[K]): void {
    for (const fn of this.#listeners.get(name) ?? []) fn(structuredClone(event) as never);
  }
}
