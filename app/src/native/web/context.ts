import type {Asset, DeviceError, Permission} from '../contracts';

export type MockClock = {now(): number; advance(ms: number): void};
export type MockOptions = {
  now?: number;
  fixtures?: Record<string, unknown>;
  permissions?: Record<string, Permission>;
  failures?: Record<string, DeviceError>;
  offline?: boolean;
};

/** Per-test injectable state. No storage, hardware, or network is initialized here. */
export function createMockContext(options: MockOptions = {}) {
  let time = options.now ?? 0;
  const fixtures = structuredClone(options.fixtures ?? {});
  const permissions = {...options.permissions};
  const failures = structuredClone(options.failures ?? {});
  let offline = options.offline ?? false;
  const clock: MockClock = {
    now: () => time,
    advance(ms) {
      if (!Number.isFinite(ms) || ms < 0) throw new RangeError('Clock advance must be non-negative');
      time += ms;
    },
  };
  return {
    clock,
    fixture<T>(name: string): T | undefined { return structuredClone(fixtures[name]) as T | undefined; },
    setFixture(name: string, value: unknown) { fixtures[name] = structuredClone(value); },
    permission(name: string): Permission { return permissions[name] ?? 'prompt'; },
    setPermission(name: string, value: Permission) { permissions[name] = value; },
    failure(operation: string): DeviceError | undefined { const error = failures[operation]; return error && {...error}; },
    setFailure(operation: string, error: DeviceError | undefined) {
      if (error) failures[operation] = {...error}; else delete failures[operation];
    },
    isOffline: () => offline,
    setOffline(value: boolean) { offline = value; },
  };
}
export type MockContext = ReturnType<typeof createMockContext>;

/** Keep explicit fixture inference attached when capture/import assigns durable asset identity. */
export function copyAssetFixtures(context: MockContext, source: Asset, asset: Asset): void {
  for (const prefix of ['Segmenter.asset', 'PhotoIndex.vector']) {
    const fixture = context.fixture<unknown>(`${prefix}:${source.id}`) ?? context.fixture<unknown>(`${prefix}:${source.file}`);
    if (fixture !== undefined) context.setFixture(`${prefix}:${asset.id}`, fixture);
  }
}
let defaultContext: MockContext | undefined;
export function getMockContext(): MockContext { return defaultContext ??= createMockContext(); }
export function setMockContext(context: MockContext): void { defaultContext = context; }
export function resetMockContext(): void { defaultContext = undefined; }
