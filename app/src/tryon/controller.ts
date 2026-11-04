import type {Asset, Candidate, DeviceError, FaceMask, Media, Piece, Result, SelfPhoto, Store} from '../native/contracts';
import type {RelayResponse} from '../relay/client';
import type {UploadImageReader} from '../relay/selfPhoto';
import {safeError, TryOnError} from './errors';
import {serializeTryOn} from './request';
import type {PreparedResult, TryOnRequest} from './request';

export type TryOnDraft = {readonly targetPieceId: string | null; readonly companionPieceIds: readonly string[]};
export type TryOnPhase = 'idle' | 'preparing' | 'sending' | 'compositing' | 'saving' | 'complete' | 'failed' | 'cancelled';
export type TryOnState = {
  readonly draft: TryOnDraft;
  readonly phase: TryOnPhase;
  readonly selfState: 'empty' | 'ready' | 'registering' | 'failed';
  readonly selfPhoto: SelfPhoto | null;
  readonly result: Result | null;
  readonly error: DeviceError | null;
};
export interface TryOnDependencies {
  store: Store;
  faceMask: Pick<FaceMask, 'register' | 'compose'>;
  readImage: UploadImageReader;
  request(body: TryOnRequest, signal: AbortSignal): Promise<RelayResponse<'/v1/tryon'>>;
  writeProvider(image: RelayResponse<'/v1/tryon'>['image']): Promise<string>;
  online(): Promise<boolean>;
  exportResult(resultId: string): Promise<{uri: string}>;
  discardAsset: Media['discard'];
}
export interface TryOnController {
  getSnapshot(): TryOnState;
  subscribe(listener: () => void): () => void;
  start(targetPieceId: string): Promise<void>;
  addCompanion(id: string): Promise<void>;
  removeCompanion(id: string): void;
  addTripCandidate(candidate: Candidate, signal?: AbortSignal): Promise<Piece>;
  registerSelf(asset: Asset): Promise<boolean>;
  generate(): Promise<Result | null>;
  cancel(): void;
  restoreResult(result: Result): Promise<void>;
  canChangePieces(result: Result): Promise<boolean>;
  exportResult(resultId: string): Promise<{uri: string}>;
  refresh(): Promise<void>;
  dispose(): Promise<void>;
}

export function createTryOnController(deps: TryOnDependencies): TryOnController {
  let state: TryOnState = Object.freeze({draft: Object.freeze({targetPieceId: null, companionPieceIds: Object.freeze([])}), phase: 'idle', selfState: 'empty', selfPhoto: null, result: null, error: null});
  const listeners = new Set<() => void>();
  let active: AbortController | null = null;
  let running: Promise<Result | null> | null = null;
  let editing = false;
  let disposed = false;
  let revision = 0;
  let refreshRevision = 0;
  const publish = (patch: Partial<TryOnState>) => {
    state = Object.freeze({...state, ...patch});
    if (!disposed) for (const listener of listeners) listener();
  };
  const draft = (targetPieceId: string | null, ids: readonly string[]) => {
    revision++;
    publish({draft: Object.freeze({targetPieceId, companionPieceIds: Object.freeze([...ids])}), phase: 'idle', result: null, error: null});
  };
  const idle = () => {
    if (disposed) throw new TryOnError('cancelled');
    if (active || editing || state.selfState === 'registering') throw new TryOnError('busy');
  };
  const piece = async (id: string, target = false) => {
    if (typeof id !== 'string' || !id) throw new TryOnError('invalid_composition');
    const value = await deps.store.get({entity: 'Piece', id});
    if (!value) throw new TryOnError('invalid_reference');
    if ((value.origin !== 'shop' && value.origin !== 'wardrobe') || (target && value.origin !== 'shop')) throw new TryOnError('invalid_composition');
    return value;
  };
  const validate = async (value: TryOnDraft) => {
    if (!value.targetPieceId || value.companionPieceIds.length > 5 ||
        new Set([value.targetPieceId, ...value.companionPieceIds]).size !== value.companionPieceIds.length + 1) throw new TryOnError('invalid_composition');
    await piece(value.targetPieceId, true);
    for (const id of value.companionPieceIds) await piece(id);
  };
  const room = (id?: string) => {
    if (!state.draft.targetPieceId) throw new TryOnError('invalid_composition');
    if (id === state.draft.targetPieceId || (id && state.draft.companionPieceIds.includes(id))) throw new TryOnError('invalid_composition');
    if (state.draft.companionPieceIds.length >= 5) throw new TryOnError('companion_limit');
  };
  const edit = async (action: () => Promise<void>) => {
    idle();
    editing = true;
    try { await action(); } finally { editing = false; }
  };
  const refresh = async () => {
    const current = ++refreshRevision;
    const self = await deps.store.getSelfPhoto();
    if (disposed || current !== refreshRevision || state.selfState === 'registering') return;
    // A failed replacement never silently unlocks generation with the previous photo.
    publish({selfPhoto: self, selfState: state.selfState === 'failed' ? 'failed' : self ? 'ready' : 'empty'});
  };
  const cancel = () => {
    revision++;
    active?.abort();
    if (active) publish({phase: 'cancelled', error: null});
  };
  const run = async (operation: AbortController): Promise<Result | null> => {
    const signal = operation.signal;
    let prepared: PreparedResult | null = null;
    let saved: Result | null = null;
    const temp = new Set<string>();
    try {
      publish({phase: 'preparing', error: null, result: null});
      if (state.selfState === 'failed') throw new TryOnError('masking_failed');
      if (!await deps.online()) throw new TryOnError('offline', true);
      signal.throwIfAborted();
      const selection = state.draft;
      await validate(selection);
      signal.throwIfAborted();
      const currentSelf = await deps.store.getSelfPhoto();
      const self = currentSelf ? {...currentSelf} : null;
      if (!self) throw new TryOnError('self_photo_required');
      if (!self.maskedFile || self.maskedFile === self.file || self.maskedFile === self.headMask) throw new TryOnError('masking_failed');
      signal.throwIfAborted();
      prepared = await deps.store.prepareResult({targetPieceId: selection.targetPieceId!, companionPieceIds: [...selection.companionPieceIds]});
      signal.throwIfAborted();
      const body = await serializeTryOn(self.maskedFile, prepared, deps.readImage, signal);
      signal.throwIfAborted();
      publish({phase: 'sending'});
      const response = await deps.request(body, signal);
      signal.throwIfAborted();
      const providerFile = await deps.writeProvider(response.image);
      temp.add(providerFile);
      signal.throwIfAborted();
      publish({phase: 'compositing'});
      const composed = await deps.faceMask.compose({providerFile, selfUpdatedAt: self.updatedAt});
      if (composed.ok) temp.add(composed.file);
      signal.throwIfAborted();
      if (!composed.ok) throw new TryOnError(composed.reason);
      const metrics = composed.metrics;
      const measurements = [metrics.neckColorDeltaE95, metrics.shoulderColorDeltaE95, metrics.neckOffsetRatio95, metrics.shoulderOffsetRatio95];
      if (composed.file === providerFile || composed.faceless === metrics.passed ||
          (metrics.passed && (metrics.decision !== 'composited' || !metrics.thresholdVersion ||
            measurements.some(value => value === null || !Number.isFinite(value) || value < 0))) ||
          (!metrics.passed && metrics.decision === 'composited')) throw new TryOnError('unsafe_output');
      publish({phase: 'saving'});
      saved = await deps.store.saveResult({draftId: prepared.draftId, file: composed.file, faceless: composed.faceless, providerFile});
      // A cancellation during the atomic save removes that result, not an unrelated one.
      signal.throwIfAborted();
      publish({phase: 'complete', result: saved});
      return saved;
    } catch (error) {
      if (saved) await deps.store.deleteResult({id: saved.id});
      publish({phase: signal.aborted ? 'cancelled' : 'failed', result: null, error: signal.aborted ? null : safeError(error)});
      return null;
    } finally {
      // Native work cannot be interrupted midway. Reclaim only after it settles.
      const cleanup: Promise<unknown>[] = [...temp].map(file => deps.store.discardTemp({file}));
      if (prepared && (!saved || signal.aborted)) cleanup.push(deps.store.discardResultDraft({draftId: prepared.draftId}));
      const failures = await Promise.allSettled(cleanup);
      if (failures.some(result => result.status === 'rejected')) publish({error: safeError(new TryOnError('io_error'))});
      active = null;
      running = null;
    }
  };
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async start(targetPieceId) {
      await edit(async () => { await piece(targetPieceId, true); draft(targetPieceId, []); });
      await refresh();
    },
    async addCompanion(id) {
      await edit(async () => { room(id); await piece(id); draft(state.draft.targetPieceId, [...state.draft.companionPieceIds, id]); });
    },
    removeCompanion(id) { idle(); draft(state.draft.targetPieceId, state.draft.companionPieceIds.filter(value => value !== id)); },
    async addTripCandidate(candidate, signal) {
      let saved: Piece | undefined;
      await edit(async () => {
        room();
        const version = revision;
        signal?.throwIfAborted();
        saved = await deps.store.saveCandidate({candidate, origin: 'shop', labelMode: 'describe'});
        signal?.throwIfAborted();
        if (disposed || version !== revision) throw new TryOnError('cancelled');
        room(saved.id);
        draft(state.draft.targetPieceId, [...state.draft.companionPieceIds, saved.id]);
      });
      return saved!;
    },
    async registerSelf(asset) {
      idle();
      refreshRevision++;
      publish({selfState: 'registering', error: null});
      try {
        const result = await deps.faceMask.register({asset});
        if (!result.ok) {
          publish({selfState: 'failed', error: safeError(new TryOnError('masking_failed'))});
          return false;
        }
        publish({selfPhoto: result.selfPhoto, selfState: 'ready', error: null});
        return true;
      } catch (error) {
        publish({selfState: 'failed', error: safeError(error)});
        return false;
      } finally {
        await deps.discardAsset({assetId: asset.id});
      }
    },
    generate() {
      idle();
      active = new AbortController();
      running = run(active);
      return running;
    },
    cancel,
    async restoreResult(result) {
      await edit(async () => {
        await piece(result.targetPieceId, true);
        const remaining: string[] = [];
        for (const id of result.companionPieceIds) {
          if (await deps.store.get({entity: 'Piece', id})) remaining.push(id);
        }
        const restored = {targetPieceId: result.targetPieceId, companionPieceIds: remaining};
        await validate(restored);
        draft(restored.targetPieceId, remaining);
      });
      await refresh();
    },
    async canChangePieces(result) { const target = await deps.store.get({entity: 'Piece', id: result.targetPieceId}); return target?.origin === 'shop'; },
    exportResult: deps.exportResult,
    refresh,
    async dispose() { disposed = true; cancel(); listeners.clear(); await running; },
  };
}
