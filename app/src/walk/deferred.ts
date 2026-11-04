/** ES2022 is the app's runtime/type baseline; Promise.withResolvers requires ES2024. */
export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return {promise, resolve, reject};
}
