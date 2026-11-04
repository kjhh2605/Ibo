import type {components} from '../generated/relay-api';
import type {Candidate, Photo, PhotoIndex, Store, Voice} from '../native/contracts';
import type {RelayRequest, RelayResponse, RequestOptions} from '../relay/client';

export type Schema = components['schemas'];
export type ToolCall = Schema['ToolCallsResponse']['toolCalls'][number];
export type ToolResult = NonNullable<Schema['SearchTurnRequest']['toolResults']>[number];
export type AgentStage = 'thinking' | 'listening' | 'transcribing' | 'reading_visits' | 'narrowing' | 'searching_photos' | 'outlining_items';
export type AgentEvent = {
  type: 'query_started' | 'voice_started' | 'voice_stopped' | 'tool_started' | 'scope_narrowed' | 'tool_completed' | 'query_completed' | 'query_not_found' | 'query_failed' | 'query_cancelled';
  runId: string;
  toolCallId?: string;
  toolName?: ToolCall['name'];
  scope?: {tripId: string; shopId: string; tripRef: string; shopRef: string; n: number};
};
export type AgentSnapshot = {
  status: 'idle' | 'running' | 'results' | 'not_found' | 'error';
  runId: string | null;
  query: string;
  stage: AgentStage | null;
  events: AgentEvent[];
  stepsExpanded: boolean;
  showAll: boolean;
  photos: Photo[];
  candidates: Candidate[];
  visibleCandidates: Candidate[];
  concept: string | null;
  summary: string | null;
  error: {code: string; retryable: boolean} | null;
  notice: string | null;
};
export interface AgentController {
  getState(): AgentSnapshot;
  subscribe(listener: () => void): () => void;
  submit(query: string): Promise<void>;
  startVoice(): Promise<void>;
  stopVoice(): Promise<void>;
  cancel(): Promise<void>;
  setStepsExpanded(expanded: boolean): void;
  setShowAll(showAll: boolean): void;
  dispose(): Promise<void>;
}
export interface AgentRelay {
  request<P extends '/v1/search/turn' | '/v1/search/segment' | '/v1/transcribe'>(path: P, body: RelayRequest<P>, options?: RequestOptions): Promise<RelayResponse<P>>;
}
// Media owns bytes and temporary files, never accepts SelfPhoto or arbitrary upload URLs.
export interface AgentMedia {
  preparePhoto(photo: Photo, signal: AbortSignal): Promise<Schema['Image']>;
  cacheCandidate(photo: Photo, candidate: Schema['SegmentCandidate'], signal: AbortSignal): Promise<Candidate>;
  readVoice(file: string, signal: AbortSignal): Promise<Uint8Array>;
  discard(file: string): Promise<void>;
}
export type AgentDependencies = {
  store: Pick<Store, 'get' | 'list' | 'addListener'>;
  photoIndex: Pick<PhotoIndex, 'search'>;
  voice: Voice;
  relay: AgentRelay;
  media: AgentMedia;
  isOnline(): Promise<boolean>;
  fixture?: string;
};
