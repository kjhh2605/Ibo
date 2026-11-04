export type Id = string;
export type FileRef = string;
export type Time = number;
export type Point = {lat: number; lng: number};
export type Fix = Point & {t: number; accuracyM: number};
export type Location = Point & {accuracyM: number};
export type BBox = [x: number, y: number, w: number, h: number];
export type Permission = 'prompt' | 'granted' | 'denied';
export type Asset = {id: Id; file: FileRef; w: number; h: number};
export interface Listener { remove(): Promise<void> }
export interface Events<E> { addListener<K extends keyof E & string>(name: K, fn: (event: E[K]) => void): Promise<Listener> }
export type DeviceError = {code: string; message: string; retryable: boolean};

export type Trip = {id: Id; startedAt: Time; endedAt: Time | null; status: 'recording' | 'ended'};
export type TrailPoint = Fix & {tripId: Id};
export type Shop = {id: Id; tripId: Id; n: number; startedAt: Time; spot: Location; storefrontPhotoId: Id | null; description: string | null; descriptionState: 'none' | 'pending' | 'done' | 'failed'; note: string | null};
export type Photo = {id: Id; tripId: Id; shopId: Id; kind: 'item' | 'storefront'; takenAt: Time; location: Location; file: FileRef; w: number; h: number; indexState: 'pending' | 'done' | 'failed'};
export type PhotoEmbedding = {photoId: Id; model: 'pe-core-t16-image'; dim: 512; vector: number[]};
export type Candidate = {id: Id; photoId: Id; source: 'sam' | 'edgetam'; label: string; score: number; mask: FileRef; bbox: BBox};
export type Piece = {id: Id; origin: 'shop' | 'wardrobe'; label: string; category: string; cutoutFile: FileRef; createdAt: Time; photoId: Id | null; shopId: Id | null; tripId: Id | null; walkTo: Point | null};
export type SelfPhoto = {file: FileRef; headMask: FileRef; maskedFile: FileRef; updatedAt: Time};
export type ResultPieceSnapshot = {pieceId: Id; origin: 'shop' | 'wardrobe'; label: string; category: string; cutoutFile: FileRef; walkTo: Point | null; shop: {n: number; startedAt: Time; storefrontFile: FileRef | null; description: string | null; note: string | null} | null};
export type Result = {id: Id; targetPieceId: Id; companionPieceIds: Id[]; targetSnapshot: ResultPieceSnapshot; companionSnapshots: ResultPieceSnapshot[]; file: FileRef; faceless: boolean; providerFile: FileRef; createdAt: Time};
export type QueueJob = {id: Id; kind: 'describe_storefront' | 'label_piece'; refId: Id; attempts: number; nextAt: Time};

export type SessionState = {phase: 'idle' | 'requesting_location' | 'requesting_notification' | 'starting' | 'recording' | 'stopping'; trip: Trip | null; shop: Shop | null; locationPermission: Permission; notificationPermission: Permission; photos: number; elapsedMinutes: number; latestFix: Fix | null};
export interface ShoppingSession extends Events<{state: SessionState; location: Fix; notice: {code: 'notification_unavailable'}; open: {url: 'streetfitting://home' | 'streetfitting://capture' | 'streetfitting://capture?newShop=1'}; error: {code: 'location_permission_denied' | 'location_disabled' | 'service_unavailable'; retryable: boolean}}> {
  getState(): Promise<SessionState>; start(): Promise<SessionState>; newShop(): Promise<Shop>; stop(): Promise<{trip: Trip}>; openSettings(): Promise<void>;
}
export interface Capture extends Events<{captured: {asset: Asset; photo: Photo | null}; preview: {ready: boolean}}> {
  openPreview(o: {facing: 'back' | 'front'} & ({purpose: 'shopping' | 'wardrobe' | 'self'; shopId?: never} | {purpose: 'storefront'; shopId: Id})): Promise<void>;
  setPreviewRect(o: {x: number; y: number; width: number; height: number}): Promise<void>;
  takePhoto(o: {kind: 'item' | 'storefront'}): Promise<{asset: Asset; photo: Photo | null}>; closePreview(): Promise<void>;
}
export interface PhotoIndex extends Events<{indexed: {photoId: Id; state: 'done' | 'failed'}}> {
  index(o: {photoId: Id}): Promise<PhotoEmbedding>; search(o: {phraseVector: number[]; photoIds?: Id[]; k: number}): Promise<Array<{photoId: Id; score: number}>>;
}
export type SegMask = {mask: FileRef; bbox: BBox; score: number};
export interface Segmenter extends Events<{prepared: {handle: string; assetId: Id}}> {
  prepare(o: {asset: Asset}): Promise<{handle: string; w: number; h: number}>; tap(o: {handle: string; x: number; y: number}): Promise<{masks: SegMask[]}>; person(o: {handle: string}): Promise<{masks: SegMask[]}>; release(o: {handle: string}): Promise<void>;
}
export type MaskFailure = 'person_not_found' | 'head_not_found' | 'ambiguous_person' | 'unsafe_boundary';
export type MaskMetrics = {personAccepted: boolean; headAreaRatio: number | null; gtHeadPixels: number | null; exposedHeadPixels: number | null; privacyPassed: boolean | null};
export type ComposeMetrics = {neckColorDeltaE95: number | null; shoulderColorDeltaE95: number | null; neckOffsetRatio95: number | null; shoulderOffsetRatio95: number | null; thresholdVersion: string | null; passed: boolean; decision: 'composited' | 'threshold_exceeded' | 'metrics_unavailable' | 'not_calibrated'};
export interface FaceMask extends Events<{stage: {stage: 'segmenting' | 'masking' | 'compositing'}}> {
  register(o: {asset: Asset}): Promise<{ok: true; selfPhoto: SelfPhoto; metrics: MaskMetrics} | {ok: false; reason: MaskFailure; metrics: MaskMetrics}>;
  compose(o: {providerFile: FileRef; selfUpdatedAt: number}): Promise<{ok: true; file: FileRef; faceless: boolean; metrics: ComposeMetrics} | {ok: false; reason: 'unsafe_output' | 'self_photo_changed'; metrics: ComposeMetrics}>;
  evaluateFixture(o: {asset: Asset; expectedPerson: boolean; groundTruthHeadMask: FileRef | null}): Promise<{registrationOk: boolean; reason: MaskFailure | null; metrics: MaskMetrics; passed: boolean}>;
}
export interface Media extends Events<{exported: {uri: string; sourceId: Id}}> {
  pick(o: {purpose: 'wardrobe' | 'self'}): Promise<{asset: Asset}>; exportPhoto(o: {photoId: Id}): Promise<{uri: string}>; exportResult(o: {resultId: Id}): Promise<{uri: string}>; discard(o: {assetId: Id}): Promise<void>;
}
export type VoiceRecording = {file: FileRef; durationMs: number; sampleRate: 16000; channels: 1; bitsPerSample: 16};
export interface Voice extends Events<{state: {state: 'recording' | 'stopped'; reason?: 'silence' | 'limit' | 'manual' | 'cancelled'}; level: {rmsDbfs: number}; completed: VoiceRecording; error: {code: 'no_speech' | 'audio_unavailable' | 'io_error'; retryable: boolean}}> {
  start(): Promise<void>; stop(): Promise<VoiceRecording>; cancel(): Promise<void>;
}
export type EntityMap = {Trip: Trip; TrailPoint: TrailPoint; Shop: Shop; Photo: Photo; PhotoEmbedding: PhotoEmbedding; Piece: Piece; Result: Result; QueueJob: QueueJob};
export type Page<T> = {items: T[]; nextCursor: string | null};
export interface Store extends Events<{changed: {entities: (keyof EntityMap | 'SelfPhoto')[]; ids: Id[]}}> {
  get<K extends keyof EntityMap>(o: {entity: K; id: Id}): Promise<EntityMap[K] | null>;
  list<K extends keyof EntityMap>(o: {entity: K; tripId?: Id; shopId?: Id; origin?: 'shop' | 'wardrobe'; limit?: number; cursor?: string}): Promise<Page<EntityMap[K]>>;
  getSelfPhoto(): Promise<SelfPhoto | null>;
  saveCandidate(o: {candidate: Candidate; origin: 'shop' | 'wardrobe'; labelMode: 'concept' | 'describe'}): Promise<Piece>;
  updateShop(o: {id: Id; note: string | null}): Promise<Shop>; updatePiece(o: {id: Id; label: string; category: string}): Promise<Piece>;
  prepareResult(o: {targetPieceId: Id; companionPieceIds: Id[]}): Promise<{draftId: Id; targetSnapshot: ResultPieceSnapshot; companionSnapshots: ResultPieceSnapshot[]}>;
  saveResult(o: {draftId: Id; file: FileRef; faceless: boolean; providerFile: FileRef}): Promise<Result>; discardResultDraft(o: {draftId: Id}): Promise<void>;
  deleteTrip(o: {id: Id}): Promise<void>; deletePhoto(o: {id: Id}): Promise<void>; deletePiece(o: {id: Id}): Promise<void>; deleteResult(o: {id: Id}): Promise<void>;
  enqueue(o: {kind: QueueJob['kind']; refId: Id}): Promise<QueueJob>; nextJob(o: {now: number}): Promise<QueueJob | null>; beginJob(o: {id: Id; now: number}): Promise<QueueJob>;
  completeJob(o: {id: Id; description?: string; label?: string; category?: string}): Promise<void>; failJob(o: {id: Id; retryable: boolean; retryAfterMs?: number; preflight?: boolean}): Promise<void>; discardTemp(o: {file: FileRef}): Promise<void>;
}

// Internal repository capabilities for native plugin implementations, never a JS raw-write API.
export interface DeviceRepository {
  startSession(input: {fix: Fix}): Promise<{trip: Trip; shop: Shop}>;
  newShop(input: {tripId: Id; fix: Fix}): Promise<Shop>;
  stopSession(input: {tripId: Id; endedAt: Time}): Promise<Trip>;
  commitPhoto(input: {photo: Photo; storefrontEdit?: boolean}): Promise<Photo>;
  commitEmbedding(input: {embedding: PhotoEmbedding}): Promise<PhotoEmbedding>;
  replaceSelfPhoto(input: {selfPhoto: SelfPhoto}): Promise<SelfPhoto>;
}
