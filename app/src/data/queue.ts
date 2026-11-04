import type {Listener, QueueJob, Store as StoreContract} from '../native/contracts';
import type {RelayRequest, RelayResponse} from '../relay/client';

export type DescribePath = '/v1/describe/storefront' | '/v1/describe/piece';
export type DescribeImage = RelayRequest<'/v1/describe/piece'>['image'];
export interface DescribeTransport {
  request<P extends DescribePath>(path: P, body: RelayRequest<P>, options: {beforeSend: () => Promise<void>; forceRefreshAuth?: boolean; signal: AbortSignal}): Promise<RelayResponse<P>>;
}
export interface QueueEnvironment {
  now(): number;
  foreground(): boolean;
  online(): boolean;
  schedule(callback: () => void, delay: number): unknown;
  cancel(handle: unknown): void;
  image(file: string): Promise<DescribeImage>;
}
function failure(error: unknown) {
  const value = error && typeof error === 'object' ? error : {};
  return {
    code: 'code' in value ? String(value.code) : 'network_error',
    retryable: !('retryable' in value) || value.retryable === true,
    retryAfterMs: 'retryAfterMs' in value && typeof value.retryAfterMs === 'number' && Number.isFinite(value.retryAfterMs) && value.retryAfterMs >= 0 ? value.retryAfterMs : undefined,
  };
}

/** One foreground dispatcher; durable attempts/nextAt/claims belong to Store, not this object. */
export class DescribeQueue {
  private running = false;
  private pumping = false;
  private wakePending = false;
  private timer: unknown;
  private listener: Listener | undefined;
  private controller: AbortController | undefined;
  private refreshAuth = false;
  private preflightRetryAt = 0;
  private readonly store: StoreContract;
  private readonly transport: DescribeTransport;
  private readonly environment: QueueEnvironment;
  constructor(store: StoreContract, transport: DescribeTransport, environment: QueueEnvironment) {
    this.store = store;
    this.transport = transport;
    this.environment = environment;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.listener = await this.store.addListener('changed', event => {
      if (event.entities.includes('QueueJob')) this.wake();
    });
    if (!this.running) { await this.listener.remove(); this.listener = undefined; return; }
    this.wake();
  }
  async stop() {
    this.running = false;
    this.clearTimer();
    this.controller?.abort();
    await this.listener?.remove();
    this.listener = undefined;
  }
  wake() {
    this.clearTimer();
    if (!this.ready()) return;
    if (this.pumping) { this.wakePending = true; return; }
    if (this.preflightRetryAt > this.environment.now()) { this.arm(this.preflightRetryAt - this.environment.now()); return; }
    void this.pump();
  }
  private clearTimer() {
    if (this.timer !== undefined) this.environment.cancel(this.timer);
    this.timer = undefined;
  }
  private arm(delay: number) {
    this.clearTimer();
    if (this.running && this.environment.foreground() && this.environment.online()) this.timer = this.environment.schedule(() => { this.timer = undefined; this.wake(); }, Math.max(1, Math.min(delay, 2_147_483_647)));
  }
  private ready() { return this.running && this.environment.foreground() && this.environment.online(); }
  private async source(job: QueueJob) {
    if (job.kind === 'label_piece') {
      const piece = await this.store.get({entity: 'Piece', id: job.refId});
      return piece?.cutoutFile ?? null;
    }
    const photo = await this.store.get({entity: 'Photo', id: job.refId});
    if (!photo || photo.kind !== 'storefront') return null;
    const shop = await this.store.get({entity: 'Shop', id: photo.shopId});
    return shop?.storefrontPhotoId === photo.id ? photo.file : null;
  }
  private async dispatch(job: QueueJob) {
    let claimed = false;
    let imageFailure = false;
    this.controller = new AbortController();
    try {
      const file = await this.source(job);
      if (!file) return;
      let image: DescribeImage;
      try { image = await this.environment.image(file); }
      catch (error) { imageFailure = true; throw error; }
      const beforeSend = async () => {
        if (!this.ready()) throw {code: 'offline', retryable: true};
        await this.store.beginJob({id: job.id, now: this.environment.now()});
        claimed = true;
      };
      const options = {beforeSend, forceRefreshAuth: this.refreshAuth, signal: this.controller.signal};
      if (job.kind === 'describe_storefront') {
        const response = await this.transport.request('/v1/describe/storefront', {image}, options);
        await this.store.completeJob({id: job.id, description: response.description});
      } else {
        const response = await this.transport.request('/v1/describe/piece', {image}, options);
        await this.store.completeJob({id: job.id, label: response.label, category: response.category});
      }
      this.refreshAuth = false;
      this.preflightRetryAt = 0;
    } catch (error) {
      const problem = failure(error);
      if (problem.code === 'unauthenticated' || problem.code === 'unauthorized' || problem.code === 'invalid_auth' || problem.code === 'invalid_app_check' || problem.code === 'auth_unavailable' || problem.code === 'forbidden') this.refreshAuth = true;
      if (claimed) {
        await this.store.failJob({id: job.id, retryable: problem.retryable, ...(problem.retryAfterMs === undefined ? {} : {retryAfterMs: problem.retryAfterMs})});
      } else if (imageFailure && !problem.retryable) {
        await this.store.failJob({id: job.id, retryable: false, preflight: true});
        this.preflightRetryAt = 0;
      } else if (problem.code !== 'invalid_reference' && problem.code !== 'job_not_claimed') {
        // Authentication/image preparation does not count as an HTTP attempt.
        this.preflightRetryAt = this.environment.now() + Math.max(5000, problem.retryAfterMs ?? 0);
      }
    } finally { this.controller = undefined; }
  }
  private async pump() {
    this.pumping = true;
    this.wakePending = false;
    try {
      while (this.ready() && this.preflightRetryAt <= this.environment.now()) {
        const job = await this.store.nextJob({now: this.environment.now()});
        if (!job) break;
        await this.dispatch(job);
        // Source deletion normally removed its job atomically. Avoid spinning on a competing claim.
        const current = await this.store.get({entity: 'QueueJob', id: job.id});
        if (current && current.attempts === job.attempts && this.preflightRetryAt === 0) this.preflightRetryAt = this.environment.now() + 5000;
      }
      if (this.ready()) {
        const page = await this.store.list({entity: 'QueueJob', limit: 1});
        const next = page.items[0];
        if (next) this.arm(Math.max(next.nextAt, this.preflightRetryAt) - this.environment.now());
      }
    } catch {
      // Persistence failures must not become an unhandled promise or a tight foreground loop.
      this.preflightRetryAt = this.environment.now() + 5000;
      this.arm(5000);
    } finally {
      this.pumping = false;
      if (this.wakePending) { this.wakePending = false; this.wake(); }
    }
  }
}
