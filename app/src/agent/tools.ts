import type {Candidate, EntityMap, Photo, Shop, Trip} from '../native/contracts';
import type {AgentDependencies, AgentEvent, Schema, ToolCall, ToolResult} from './types';
import {AgentError, inInterval, interval, object, refs, requireValue, text} from './wire';

export class SearchRun {
  readonly id = crypto.randomUUID();
  readonly abort = new AbortController();
  readonly trips = new Map<string, Trip>();
  readonly shops = new Map<string, Shop>();
  readonly photos = new Map<string, Photo>();
  readonly found = new Set<string>();
  readonly candidates = new Map<string, Candidate[]>();
  readonly files = new Set<string>();
  readonly localRefs = new Map<string, string>();
  token: string | undefined;
  turns = 0;
  samPhotos = 0;
  concept: string | undefined;
  phrase: string | undefined;
  validation: Promise<void> = Promise.resolve();
  readonly query: string;
  readonly context: Schema['QueryContext'];
  constructor(query: string, context: Schema['QueryContext']) { this.query = query; this.context = context; }
  reference(kind: string, id: string): string {
    const key = `${kind}:${id}`;
    let value = this.localRefs.get(key);
    if (!value) { value = crypto.randomUUID(); this.localRefs.set(key, value); }
    return value;
  }
}
export class SearchTools {
  private readonly deps: AgentDependencies;
  private readonly check: (run: SearchRun) => void;
  private readonly emit: (event: AgentEvent) => void;
  constructor(deps: AgentDependencies, check: (run: SearchRun) => void, emit: (event: AgentEvent) => void) {
    this.deps = deps; this.check = check; this.emit = emit;
  }

  async all<K extends 'Trip' | 'Shop' | 'Photo'>(run: SearchRun, entity: K): Promise<EntityMap[K][]> {
    const rows: EntityMap[K][] = [];
    const cursors = new Set<string>();
    let cursor: string | undefined;
    do {
      const page = await this.deps.store.list({entity, ...(cursor ? {cursor} : {})});
      this.check(run);
      rows.push(...page.items);
      if (page.nextCursor === null) break;
      requireValue(!cursors.has(page.nextCursor), 'local_data_error');
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
    } while (cursor !== undefined);
    requireValue(new Set(rows.map(row => row.id)).size === rows.length, 'local_data_error');
    return rows;
  }

  async validateReferences(run: SearchRun): Promise<void> {
    for (const [entity, entries] of [['Trip', run.trips], ['Shop', run.shops], ['Photo', run.photos]] as const) {
      for (const record of entries.values()) {
        const current = await this.deps.store.get({entity, id: record.id});
        this.check(run);
        requireValue(current !== null, 'data_changed');
      }
    }
  }

  async execute(run: SearchRun, call: ToolCall): Promise<ToolResult> {
    if (call.name === 'list_visits') return this.listVisits(run, call);
    if (call.name === 'find_photos') return this.findPhotos(run, call);
    throw new AgentError('invalid_tool_response');
  }

  private async listVisits(run: SearchRun, call: Extract<ToolCall, {name: 'list_visits'}>): Promise<ToolResult> {
    const trips = await this.all(run, 'Trip');
    const shops = await this.all(run, 'Shop');
    const photos = await this.all(run, 'Photo');
    const now = Date.parse(run.context.now);
    const range = interval(call.arguments.from, call.arguments.to);
    const visits: Schema['VisitSummary'][] = [];
    for (const shop of shops) {
      if (!inInterval(shop.startedAt, range, now)) continue;
      const trip = trips.find(t => t.id === shop.tripId);
      requireValue(trip && shop.startedAt >= trip.startedAt && (trip.status !== 'ended' || trip.endedAt !== null && trip.endedAt >= shop.startedAt), 'local_data_error');
      const tripRef = run.reference('trip', trip.id);
      const shopRef = run.reference('shop', shop.id);
      run.trips.set(tripRef, trip);
      run.shops.set(shopRef, shop);
      const items = photos.filter(p => p.shopId === shop.id && p.kind === 'item' && p.takenAt <= now);
      requireValue(items.every(p => p.tripId === trip.id && p.takenAt >= shop.startedAt && (trip.endedAt === null || p.takenAt <= trip.endedAt)), 'local_data_error');
      const times = items.map(p => p.takenAt);
      requireValue(shop.descriptionState !== 'done' || text(shop.description, 300), 'local_data_error');
      visits.push({tripRef, tripStartedAt: new Date(trip.startedAt).toISOString(), tripStatus: trip.status,
        ...(trip.endedAt === null ? {} : {tripEndedAt: new Date(trip.endedAt).toISOString()}),
        shopRef, n: shop.n, startedAt: new Date(shop.startedAt).toISOString(), descriptionState: shop.descriptionState,
        ...(shop.descriptionState === 'done' && shop.description ? {description: shop.description} : {}),
        ...(shop.note ? {note: shop.note} : {}), photoCount: items.length,
        ...(times.length ? {firstPhotoAt: new Date(Math.min(...times)).toISOString(), lastPhotoAt: new Date(Math.max(...times)).toISOString()} : {}),
      });
    }
    visits.sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt) || (a.shopRef < b.shopRef ? -1 : a.shopRef > b.shopRef ? 1 : 0));
    const selected = call.arguments.limit === undefined ? visits : visits.slice(0, call.arguments.limit);
    await this.validateReferences(run);
    return {name: call.name, toolCallId: call.id, result: {visits: selected, matchingCount: visits.length, truncated: selected.length < visits.length}};
  }

  private async findPhotos(run: SearchRun, call: Extract<ToolCall, {name: 'find_photos'}>): Promise<ToolResult> {
    const args = call.arguments;
    const selectedShops = args.shopRefs?.map(value => {
      const shop = run.shops.get(value);
      requireValue(shop);
      return shop;
    });
    if (selectedShops?.length === 1) {
      const shop = selectedShops[0];
      this.emit({type: 'scope_narrowed', runId: run.id, toolCallId: call.id, toolName: call.name, scope: {
        tripId: shop.tripId, shopId: shop.id, n: shop.n, tripRef: run.reference('trip', shop.tripId), shopRef: args.shopRefs![0],
      }});
    }
    this.emit({type: 'tool_started', runId: run.id, toolCallId: call.id, toolName: call.name});
    const range = interval(args.timeFrom, args.timeTo);
    const photos = (await this.all(run, 'Photo')).filter(p => p.kind === 'item' && inInterval(p.takenAt, range, Date.parse(run.context.now)) && (!selectedShops || selectedShops.some(s => s.id === p.shopId)));
    for (const photo of photos) {
      const shop = await this.deps.store.get({entity: 'Shop', id: photo.shopId});
      const trip = await this.deps.store.get({entity: 'Trip', id: photo.tripId});
      this.check(run);
      requireValue(shop && trip && shop.tripId === trip.id, 'data_changed');
      run.photos.set(run.reference('photo', photo.id), photo);
      run.shops.set(run.reference('shop', shop.id), shop);
      run.trips.set(run.reference('trip', trip.id), trip);
    }
    const k = args.k ?? 3;
    // PhotoIndex owns pending wait, failure, tie ordering and truncation. No second sort or score threshold.
    const ranked = await this.deps.photoIndex.search({phraseVector: call.phraseVector, photoIds: photos.map(p => p.id), k});
    this.check(run);
    await this.validateReferences(run);
    requireValue(ranked.length <= k && new Set(ranked.map(p => p.photoId)).size === ranked.length, 'index_unavailable');
    const result = ranked.map(row => {
      const photo = photos.find(p => p.id === row.photoId);
      requireValue(photo && Number.isFinite(row.score) && row.score >= -1.000001 && row.score <= 1.000001, 'index_unavailable');
      const photoRef = run.reference('photo', photo.id);
      run.found.add(photoRef);
      return {photoRef, shopRef: run.reference('shop', photo.shopId), takenAt: new Date(photo.takenAt).toISOString(), score: Math.max(-1, Math.min(1, row.score))};
    });
    run.phrase = args.phrase;
    return {name: call.name, toolCallId: call.id, result};
  }

  final(run: SearchRun, value: unknown): {photos: Photo[]; candidates: Candidate[]; concept: string; summary: string} {
    object(value, ['photoRefs', 'concept', 'summary', 'shopRef']);
    refs(value.photoRefs, 3);
    requireValue(text(value.concept, 160) && text(value.summary, 300));
    requireValue(run.concept === undefined ? run.phrase !== undefined : value.concept === run.concept);
    const photos = value.photoRefs.map(key => {
      requireValue(run.found.has(key));
      const photo = run.photos.get(key);
      requireValue(photo);
      if (value.shopRef !== undefined) requireValue(run.shops.get(value.shopRef as string)?.id === photo.shopId);
      return photo;
    });
    // Stable sort preserves final photo order and provider order for equal scores.
    const candidates = value.photoRefs.flatMap(key => run.candidates.get(key) ?? []).sort((a, b) => b.score - a.score);
    return {photos, candidates, concept: value.concept, summary: value.summary};
  }
}
