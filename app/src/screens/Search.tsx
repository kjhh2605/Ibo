import {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from 'react';
import type {KeyboardEvent, PointerEvent} from 'react';
import type {Asset, Candidate, Photo, SegMask, Shop, Trip} from '../native/contracts';
import type {Route} from '../ui/navigation';
import type {AgentState} from '../ui/services';
import {candidateId} from '../data';
import {imageUrl} from '../ui/images';
import {useData, useUi} from '../ui/state';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Action, Button, Chip, Confirm, Empty, Eyebrow, Heading, Hint, HStack, Icon, IconTile, Panel, Pop, Problem, Reveal, RowButton, SkeletonCard, StickyBar, SkeletonPhoto, SkeletonRows, SkeletonText, Text, TextInput, VStack} from '../ui/components';
import {reducedMotion, returning} from '../ui/easing';
import {ImageIcon, SendIcon, ShieldIcon, SparkleIcon, StoreIcon, TrashIcon} from '../ui/icons';

type PickRoute = Extract<Route, {name: 'pick'}>;
type ImagePoint = {x: number; y: number};
type DecodedMask = {pixels: Uint8Array; shape: Path2D; contour: Path2D; area: number; anchor: ImagePoint};
type PhotoCache = {image(): Promise<HTMLImageElement>; mask(file: string): Promise<DecodedMask>; forget(file: string): void; clear(): void};
type PickSource = {asset: Asset; photo: Photo | null; shop: Shop | null; trip: Trip | null};
type Choice = {candidate: Candidate; areaName?: string};

function errorCode(cause: unknown): string {
  return typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : 'unknown';
}

function errorMessage(code: string): string {
  switch (code) {
    case 'offline': return 'You’re offline. Connect to search or use your saved trips.';
    case 'microphone_permission_denied': return 'Microphone access is off. Allow access in device settings, or type your question.';
    case 'no_speech': return 'I didn’t catch that. Try speaking again or type your question.';
    case 'audio_unavailable': return 'The microphone is unavailable. Try again or type your question.';
    case 'index_unavailable': return 'Some photos are not ready to search. Try again or browse your trips.';
    case 'model_missing':
    case 'model_invalid': return 'On-device item selection is unavailable. Try preparing the photo again.';
    case 'handle_expired': return 'This photo’s selection session expired. Prepare the photo again.';
    case 'inference_failed': return 'Could not outline that area. Tap the item again or choose a saved match.';
    case 'not_found':
    case 'data_changed': return 'The saved data changed or was deleted. Browse your trips or ask again.';
    case 'photo_limit_exceeded': return 'This search reached its photo limit. Ask a new question or browse your trips.';
    case 'turn_limit_exceeded': return 'This search reached its limit. Ask a new question or browse your trips.';
    case 'content_policy_violation': return 'This request could not be processed. Try a different description.';
    case 'unauthorized':
    case 'authentication_failed':
    case 'app_check_failed': return 'Could not authenticate this request. Try again when your connection is ready.';
    case 'companion_limit':
    case 'companion_limit_reached':
    case 'too_many_companions': return 'Your outfit already has five companion pieces. Return to the outfit to remove one first.';
    case 'busy': return 'The previous operation is still finishing. Please try again.';
    case 'export_failed': return 'Could not save the photo to your gallery. Please try again.';
    case 'cleanup_failed': return 'Temporary selection data could not be removed from this device. Try again.';
    case 'io_error': return 'Could not read or save the local photo. Please try again.';
    default: return 'That didn’t work. Please try again or browse your saved trips.';
  }
}


async function readImage(file: string): Promise<HTMLImageElement> {
  const image = new Image();
  const source = await imageUrl(file);
  try {image.src = source.url; await image.decode(); return image;}
  finally {source.release();}
}

async function readMask(file: string, asset: Asset): Promise<DecodedMask> {
  const image = await readImage(file);
  if (image.naturalWidth !== asset.w || image.naturalHeight !== asset.h) throw {code: 'inference_failed'};
  const canvas = document.createElement('canvas');
  canvas.width = asset.w;
  canvas.height = asset.h;
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) throw {code: 'io_error'};
  context.drawImage(image, 0, 0);
  const rgba = context.getImageData(0, 0, asset.w, asset.h).data;
  const pixels = new Uint8Array(asset.w * asset.h);
  let area = 0;
  for (let index = 0; index < pixels.length; index++) {
    const offset = index * 4;
    const value = rgba[offset];
    if ((value !== 0 && value !== 255) || rgba[offset + 1] !== value || rgba[offset + 2] !== value || rgba[offset + 3] !== 255) throw {code: 'inference_failed'};
    pixels[index] = value;
    if (value) area++;
  }
  canvas.width = 1;
  canvas.height = 1;
  if (!area) throw {code: 'inference_failed'};
  const shape = new Path2D();
  const contour = new Path2D();
  let widest = 0;
  let anchor = {x: 0, y: 0};
  for (let y = 0; y < asset.h; y++) {
    let x = 0;
    while (x < asset.w) {
      if (!pixels[y * asset.w + x]) {x++; continue;}
      const start = x;
      while (x < asset.w && pixels[y * asset.w + x]) {
        const index = y * asset.w + x;
        if (y === 0 || !pixels[index - asset.w]) {contour.moveTo(x, y); contour.lineTo(x + 1, y);}
        if (y === asset.h - 1 || !pixels[index + asset.w]) {contour.moveTo(x, y + 1); contour.lineTo(x + 1, y + 1);}
        x++;
      }
      // Runs are the actual binary region, including holes and disconnected parts, not its bounding box.
      shape.rect(start, y, x - start, 1);
      contour.moveTo(start, y); contour.lineTo(start, y + 1);
      contour.moveTo(x, y); contour.lineTo(x, y + 1);
      if (x - start > widest) {widest = x - start; anchor = {x: (start + x) / 2, y: y + 0.5};}
    }
  }
  return {pixels, shape, contour, area, anchor};
}

function photoCache(asset: Asset): PhotoCache {
  let original: Promise<HTMLImageElement> | null = null;
  const masks = new Map<string, Promise<DecodedMask>>();
  return {
    image: () => original ??= readImage(asset.file).then(image => {
      if (image.naturalWidth !== asset.w || image.naturalHeight !== asset.h) throw {code: 'io_error'};
      return image;
    }),
    mask: file => {
      let result = masks.get(file);
      if (!result) {result = readMask(file, asset); masks.set(file, result);}
      return result;
    },
    forget: file => {masks.delete(file);},
    clear: () => {original = null; masks.clear();},
  };
}

function paintPhoto(canvas: HTMLCanvasElement, image: HTMLImageElement, masks: {candidate: Candidate; decoded: DecodedMask; number: number}[], selected: string | null, point: ImagePoint | null) {
  const context = canvas.getContext('2d');
  if (!context) throw {code: 'io_error'};
  const style = getComputedStyle(canvas);
  const scale = canvas.width / Math.max(canvas.getBoundingClientRect().width, 1);
  const spacing = parseFloat(style.getPropertyValue('--spacing-2')) || parseFloat(style.fontSize) / 2;
  const line = (parseFloat(style.getPropertyValue('--border-width')) || 1) * scale;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const chosen = masks.find(mask => mask.candidate.id === selected);
  if (chosen) {
    context.fillStyle = style.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.clip(chosen.decoded.shape);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.restore();
  }
  for (const {candidate, decoded, number} of masks) {
    context.save();
    context.strokeStyle = style.color;
    context.lineWidth = line * (candidate.id === selected ? 3 : 2);
    context.globalAlpha = selected && candidate.id !== selected ? 0.65 : 1;
    context.stroke(decoded.contour);
    context.scale(scale, scale);
    context.font = style.font || `${style.fontSize} ${style.fontFamily}`;
    const label = String(number);
    const radius = Math.max(context.measureText(label).width / 2, parseFloat(style.fontSize) / 2) + spacing;
    const x = Math.max(radius, Math.min(canvas.width / scale - radius, decoded.anchor.x / scale));
    const y = Math.max(radius, Math.min(canvas.height / scale - radius, decoded.anchor.y / scale));
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = style.color; context.fill();
    context.fillStyle = style.borderColor;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(label, x, y);
    context.restore();
  }
  if (point) {
    const x = point.x * canvas.width;
    const y = point.y * canvas.height;
    const radius = spacing * scale;
    context.strokeStyle = style.borderColor;
    context.lineWidth = line * 2;
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.stroke();
    context.strokeStyle = style.color;
    context.beginPath(); context.moveTo(x - radius, y); context.lineTo(x + radius, y); context.moveTo(x, y - radius); context.lineTo(x, y + radius); context.stroke();
  }
}

function PhotoSurface({asset, candidates, selected = null, cache, point = null, disabled = false, onTap, onSelect, onOpen, onReady}: {
  asset: Asset; candidates: Candidate[]; selected?: string | null; cache: PhotoCache; point?: ImagePoint | null; disabled?: boolean;
  onTap?: (point: ImagePoint) => void; onSelect?: (id: string) => void; onOpen?: () => void; onReady?: (ids: Set<string>) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const decoded = useRef<{candidate: Candidate; decoded: DecodedMask; number: number}[]>([]);
  const pointer = useRef<ImagePoint | null>(null);
  const [cursor, setCursor] = useState<ImagePoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const tapMode = Boolean(onTap);
  const cursorPoint = tapMode ? cursor ?? point : null;
  useEffect(() => {setCursor(null);}, [point, tapMode]);
  useEffect(() => {
    let live = true;
    setError(null);
    onReady?.(new Set());
    void (async () => {
      const image = await cache.image();
      const results = await Promise.allSettled(candidates.map(async (candidate, index) => ({candidate, decoded: await cache.mask(candidate.mask), number: index + 1})));
      if (!live || !canvas.current) return;
      const valid = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
      decoded.current = valid;
      paintPhoto(canvas.current, image, valid, selected, cursorPoint);
      onReady?.(new Set(valid.map(mask => mask.candidate.id)));
      if (results.some(result => result.status === 'rejected')) setError('One or more item outlines could not be displayed. Try again, choose another match, or tap the item yourself.');
    })().catch(() => {if (live) {decoded.current = []; setError('Could not display this photo. Please try again.');}});
    return () => {live = false;};
  }, [asset, cache, candidates, selected, cursorPoint, attempt, onReady]);
  const activate = (position: ImagePoint) => {
    if (disabled) return;
    if (onOpen) {onOpen(); return;}
    if (onTap) {onTap(position); return;}
    const x = Math.min(asset.w - 1, Math.floor(position.x * asset.w));
    const y = Math.min(asset.h - 1, Math.floor(position.y * asset.h));
    const hit = decoded.current.find(mask => mask.decoded.pixels[y * asset.w + x]);
    if (hit) onSelect?.(hit.candidate.id);
  };
  const pointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const start = pointer.current;
    pointer.current = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > (parseFloat(getComputedStyle(event.currentTarget).fontSize) || 16)) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const position = {x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height};
    if (position.x < 0 || position.x > 1 || position.y < 0 || position.y > 1) return;
    activate(position);
  };
  const keyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const current = cursor ?? point ?? {x: 0.5, y: 0.5};
    const delta = event.shiftKey ? 0.1 : 0.02;
    if (event.key.startsWith('Arrow') && onTap) {
      event.preventDefault();
      setCursor({x: Math.max(0, Math.min(1, current.x + (event.key === 'ArrowLeft' ? -delta : event.key === 'ArrowRight' ? delta : 0))), y: Math.max(0, Math.min(1, current.y + (event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0)))});
    } else if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); activate(current);}
  };
  const interactive = Boolean(onTap || onSelect || onOpen);
  return <VStack gap={3}>
    <canvas ref={canvas} width={asset.w} height={asset.h} role={interactive ? 'button' : 'img'} aria-label={onOpen ? 'Open this matching photo' : onTap ? 'Tap the item in the photo. You can also use arrow keys and Enter to choose a point.' : 'Original photo with numbered item outlines. Select an item below.'} aria-disabled={interactive ? disabled : undefined} tabIndex={interactive && !disabled ? 0 : undefined} onPointerDown={event => {pointer.current = {x: event.clientX, y: event.clientY};}} onPointerUp={pointerUp} onPointerCancel={() => {pointer.current = null;}} onKeyDown={keyDown} style={{width: '100%', height: 'auto', borderRadius: 'var(--radius-md)', color: 'var(--color-accent)', backgroundColor: 'var(--color-overlay)', borderColor: 'var(--color-on-accent)', touchAction: 'pan-y'}} />
    {error && <Problem message={error} retry={() => {cache.clear(); setAttempt(value => value + 1);}} />}
  </VStack>;
}

function CandidatePreview({asset, candidate, cache, ready}: {asset: Asset; candidate: Candidate; cache: PhotoCache; ready: boolean}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setFailed(false);
    void Promise.all([cache.image(), cache.mask(candidate.mask)]).then(([image, mask]) => {
      if (!live || !canvas.current) return;
      const context = canvas.current.getContext('2d');
      if (!context) throw {code: 'io_error'};
      context.clearRect(0, 0, canvas.current.width, canvas.current.height);
      context.save(); context.translate(-candidate.bbox[0], -candidate.bbox[1]); context.clip(mask.shape);
      context.drawImage(image, 0, 0, asset.w, asset.h); context.restore();
    }).catch(() => {if (live) setFailed(true);});
    return () => {live = false;};
  }, [asset, candidate, cache, ready]);
  return failed ? <Text type="supporting">Outline unavailable</Text> : <canvas ref={canvas} width={candidate.bbox[2]} height={candidate.bbox[3]} role="img" aria-label={`${candidate.label} cutout`} style={{width: 'var(--spacing-10)', height: 'var(--spacing-10)', objectFit: 'contain'}} />;
}

function stageLabel(stage: string | null): string {
  switch (stage) {
    case 'listening': return 'Listening…';
    case 'transcribing': return 'Transcribing…';
    case 'reading_visits': return 'Read your trips';
    case 'narrowing': return 'Narrowing the search…';
    case 'searching_photos': return 'Searched its photos';
    case 'outlining_items': return 'Outlined the items';
    default: return 'Finding your item…';
  }
}

function searchSteps(state: AgentState) {
  const steps: {label: string; tool?: string; state: 'working' | 'complete' | 'failed'}[] = [];
  const finish = () => {for (const step of steps) if (step.state === 'working') step.state = 'complete';};
  for (const event of state.events) {
    if (event.type === 'voice_started') steps.push({label: 'Listening…', state: 'working'});
    if (event.type === 'voice_stopped') {finish(); steps.push({label: 'Transcribing…', state: 'working'});}
    if (event.type === 'query_started') finish();
    if (event.type === 'scope_narrowed' && event.scope) steps.push({label: `Narrowed to Shop ${event.scope.n}`, tool: 'find_photos', state: 'working'});
    if (event.type === 'tool_started') {
      const label = event.toolName === 'list_visits' ? 'Read your trips' : event.toolName === 'find_photos' ? 'Searched its photos' : event.toolName === 'extract_items' ? 'Outlined the items' : null;
      if (label) steps.push({label, tool: event.toolName, state: 'working'});
    }
    if (event.type === 'tool_completed') {
      for (const step of steps) if (step.state === 'working' && (!event.toolName || step.tool === event.toolName)) step.state = 'complete';
    }
    if (event.type === 'query_completed' || event.type === 'query_not_found') finish();
    if (event.type === 'query_failed') for (const step of steps) if (step.state === 'working') step.state = 'failed';
  }
  return steps;
}

function SearchResult({photo, candidates, allCandidates, concept, index}: {photo: Photo; candidates: Candidate[]; allCandidates: Candidate[]; concept: string | null; index: number}) {
  const {services, push} = useUi();
  const context = useData(async () => {
    const current = await services.store.get({entity: 'Photo', id: photo.id});
    if (!current) return null;
    const [shop, trip] = await Promise.all([services.store.get({entity: 'Shop', id: current.shopId}), services.store.get({entity: 'Trip', id: current.tripId})]);
    return {photo: current, shop, trip};
  }, [services, photo.id]);
  const cache = useMemo(() => photoCache(photo), [photo]);
  const destination: PickRoute = {name: 'pick', mode: 'shop', photoId: photo.id, candidates: allCandidates, concept: concept ?? undefined};
  if (!context.data && context.loading) return <SkeletonCard index={index} label="Loading matching photo" />;
  if (context.error) return <Problem message={context.error} retry={context.retry} />;
  if (!context.data) return <Text type="supporting">This matching photo was deleted.</Text>;
  return <Reveal index={index}><Panel gap={3} padding={3}>
    <HStack gap={2} vAlign="center" hAlign="between">
      <HStack gap={2} vAlign="center"><IconTile icon={StoreIcon} tone={index === 0 ? 'hero' : 'muted'} size="sm"/><VStack gap={0}><Text type="label" weight="semibold">{context.data.shop ? `Shop ${context.data.shop.n}` : 'Trip photo'}</Text><Text type="supporting" size="xsm">{new Date(context.data.trip?.startedAt ?? photo.takenAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})} · {new Date(photo.takenAt).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})} · {allCandidates.length} {allCandidates.length === 1 ? 'item' : 'items'}</Text></VStack></HStack>
      {index === 0 ? <Chip tone="accent">Top result</Chip> : <Chip>#{index + 1}</Chip>}
    </HStack>
    <PhotoSurface asset={photo} candidates={candidates} selected={candidates[0]?.id ?? null} cache={cache} onOpen={() => push(destination)} />
    <Button label={index === 0 ? 'Best match' : `Match ${index + 1}`} variant={index === 0 ? 'primary' : 'secondary'} endContent={<Icon icon="chevronRight" size="sm"/>} onClick={() => push(destination)} />
  </Panel></Reveal>;
}

export function Ask() {
  const {services, online, push} = useUi();
  const {agent} = services;
  const subscribe = useCallback((listener: () => void) => agent.subscribe(listener), [agent]);
  const snapshot = useCallback(() => agent.getState(), [agent]);
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  const [text, setText] = useState('');
  const [operationError, setOperationError] = useState<string | null>(null);
  const lastAttempt = useRef<{kind: 'text'; query: string} | {kind: 'voice'} | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      // Completed masks are handed to Pick; only unfinished network/voice work is cancelled here.
      if (agent.getState().status === 'running') void agent.cancel().catch(() => {});
    };
  }, [agent]);
  const perform = (action: () => Promise<void>) => {
    setOperationError(null);
    void action().catch(cause => {if (live.current && errorCode(cause) !== 'cancelled') setOperationError(errorCode(cause));});
  };
  const submit = (query = text) => {
    if (!query.trim()) return;
    setText(query);
    lastAttempt.current = {kind: 'text', query};
    // Close the on-screen keyboard so the search progress and results are visible.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!online) {setOperationError('offline'); return;}
    perform(() => agent.submit(query));
  };
  const startVoice = () => {
    lastAttempt.current = {kind: 'voice'};
    if (!online) {setOperationError('offline'); return;}
    perform(() => agent.startVoice());
  };
  const searchBox = useRef<HTMLElement>(null);
  const resultsTop = useRef<HTMLElement>(null);
  const askAgain = () => perform(async () => {
    await agent.cancel();
    if (!live.current) return;
    setText('');
    // Bring the person back to the empty search box, ready to type.
    searchBox.current?.scrollIntoView({block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth'});
    searchBox.current?.querySelector('input')?.focus({preventScroll: true});
  });
  // When a search finishes, glide to the answer once instead of leaving it below the fold.
  const shownResults = useRef<string | null>(null);
  useEffect(() => {
    if (state.status !== 'results' || !state.query || shownResults.current === state.query || returning()) {if (state.status === 'results') shownResults.current = state.query; return;}
    shownResults.current = state.query;
    resultsTop.current?.scrollIntoView({block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth'});
  }, [state.status, state.query]);
  const status = operationError ? 'error' : state.status;
  const steps = operationError ? [] : searchSteps(state);
  const finished = status === 'results' || status === 'not_found' || status === 'error';
  const listening = status === 'running' && state.stage === 'listening';
  const transcribing = status === 'running' && state.stage === 'transcribing';
  const displayQuery = operationError ? (lastAttempt.current?.kind === 'text' ? lastAttempt.current.query : null) : state.query;
  const failure = operationError ?? state.error?.code;
  const examples = ['the blue puffer at the outdoor stall', 'red dress from the second shop', 'gray blazer about 20 min ago'];
  return <VStack gap={5}>
    <Panel gap={3}>
      <HStack gap={2} vAlign="center"><Icon icon={SparkleIcon} size="sm" color="accent"/><Text type="supporting">Search across all your trips</Text></HStack>
      <VStack ref={searchBox}>
      <TextInput type="search" label="Describe the item" value={text} onChange={setText} onEnter={() => submit()} placeholder="e.g. the jacket at the blue tarp stall" isDisabled={listening || transcribing} hasClear />
      </VStack>
      <HStack gap={3} wrap="wrap">
        <Button label={listening ? 'Stop listening' : 'Speak'} variant={listening ? 'primary' : 'secondary'} icon={<Icon icon={listening ? 'stop' : 'microphone'}/>} isDisabled={transcribing || (status === 'running' && !listening)} onClick={() => {if (listening) perform(() => agent.stopVoice()); else startVoice();}} />
        <Button label="Find" variant={listening ? 'secondary' : 'primary'} icon={<Icon icon="search"/>} style={{flex: 1}} isDisabled={!text.trim() || listening || transcribing} onClick={() => submit()} />
        {state.status === 'running' && <Button label="Cancel search" variant="ghost" onClick={() => perform(() => agent.cancel())} />}
      </HStack>
    </Panel>
    {!online && <Text role="status">You’re offline. Finding photos and voice need a connection; your saved trips and item selection are still available.</Text>}
    {displayQuery && status !== 'idle' && <VStack gap={1}><Eyebrow>You asked</Eyebrow><Text type="large" weight="semibold">“{displayQuery}”</Text></VStack>}
    {status === 'running' && <HStack gap={3} vAlign="center" padding={4} style={{background: 'var(--color-accent-muted)', borderRadius: 'var(--radius-container)'}}><Spinner size="lg" aria-label="Searching"/><Text role="status" color="accent">{stageLabel(state.stage)}{listening ? ' Search starts automatically when you finish speaking.' : ''}</Text></HStack>}
    {finished && steps.length > 0 && <Button label={`${state.status === 'results' ? `${state.photos.length} photos found` : state.status === 'not_found' ? 'No matching photos' : 'Search stopped'} · ${state.stepsExpanded ? 'Hide steps' : 'Show steps'}`} variant="ghost" aria-expanded={state.stepsExpanded} onClick={() => agent.setStepsExpanded(!state.stepsExpanded)} />}
    {(!finished || state.stepsExpanded) && steps.length > 0 && <VStack as="ol" gap={0} aria-label="Search steps" style={{listStyle: 'none', paddingInlineStart: 0, margin: 0}}>{steps.map((step, index) => <VStack as="li" key={`${index}:${step.tool ?? step.label}`}><Reveal><HStack gap={3} vAlign="start"><VStack align="center" gap={0} style={{alignSelf: 'stretch'}}><VStack align="center" justify="center" width="var(--spacing-6)" height="var(--spacing-6)" style={{flexShrink: 0, borderRadius: 'var(--radius-full)', background: step.state === 'complete' ? 'var(--color-success-muted)' : step.state === 'failed' ? 'var(--color-error-muted)' : 'var(--color-accent-muted)', color: step.state === 'complete' ? 'var(--color-on-success-muted)' : step.state === 'failed' ? 'var(--color-on-error-muted)' : 'var(--color-text-accent)'}}>{step.state === 'working' ? <Spinner size="sm" shade="inherit" aria-label="In progress"/> : <Pop><Icon icon={step.state === 'complete' ? 'check' : 'close'} size="xsm" color="inherit"/></Pop>}</VStack>{index < steps.length - 1 && <VStack width="thin" style={{flex: 1, minHeight: 'var(--spacing-3)', borderInlineStart: 'thin solid var(--color-border)'}}/>}</VStack><VStack gap={0.5} paddingBlock={0.5} style={{paddingBottom: 'var(--spacing-3)'}}><Text type="label">{step.label}</Text><Text type="supporting" size="xsm">{step.state === 'complete' ? 'Done' : step.state === 'failed' ? 'Could not complete' : 'In progress…'}</Text></VStack></HStack></Reveal></VStack>)}</VStack>}
    {status === 'running' && !listening && !transcribing && <VStack gap={4} aria-hidden><SkeletonCard index={0} label="Searching your photos" /><SkeletonCard index={1} label="Searching your photos" /></VStack>}
    {state.notice && !operationError && <Text role="status">{state.notice}</Text>}
    {failure && <Problem message={errorMessage(failure)} retry={() => {
      if (lastAttempt.current?.kind === 'voice' && (operationError || !state.events.some(event => event.type === 'query_started'))) startVoice();
      else if (operationError && lastAttempt.current?.kind === 'text') submit(lastAttempt.current.query);
      else if (state.query || text) submit(state.query || text);
      else startVoice();
    }} />}
    {status === 'idle' && !failure && <VStack gap={2}>
      <Eyebrow>Try one of these</Eyebrow>
      {examples.map((example, index) => <Reveal key={example} index={index}><RowButton label={example} start={<Icon icon="search" size="sm" color="secondary"/>} end={<Icon icon={SendIcon} size="sm" color="secondary"/>} onClick={() => submit(example)} /></Reveal>)}
    </VStack>}
    {status === 'results' && <VStack gap={4} ref={resultsTop} style={{scrollMarginTop: 'var(--spacing-4)'}}>
      {state.summary && <Reveal from="scale"><HStack gap={3} vAlign="start" padding={4} style={{background: 'var(--color-hero)', color: 'var(--color-on-hero)', borderRadius: 'var(--radius-container)'}}><Icon icon={SparkleIcon} size="md" color="inherit"/><Text type="large" weight="semibold" color="inherit">{state.summary}</Text></HStack></Reveal>}
      {state.photos.map((photo, index) => <SearchResult key={photo.id} photo={photo} index={index} concept={state.concept} candidates={state.visibleCandidates.filter(candidate => candidate.photoId === photo.id)} allCandidates={state.candidates.filter(candidate => candidate.photoId === photo.id)} />)}
      {!state.photos.length && <Empty title="These photos are no longer available"><Text>Browse your trips or ask another question.</Text></Empty>}
      {state.candidates.length > 3 && <Button label={state.showAll ? 'Show first 3' : `Show all (${state.candidates.length})`} variant="secondary" onClick={() => agent.setShowAll(!state.showAll)} />}
      <Button label="Ask again" variant="secondary" onClick={askAgain} />
    </VStack>}
    {status === 'not_found' && <Empty title="No matching photos" icon="search"><Text>{state.summary ?? 'We couldn’t find that item in your trips. Try a color, a type of clothing, or something you remember about the shop.'}</Text><Button label="Ask again" variant="secondary" onClick={askAgain} /></Empty>}
    {status === 'error' && <Button label="Ask again" variant="secondary" onClick={askAgain} />}
    <Button label="Browse your trips" variant="ghost" icon={<Icon icon="calendar"/>} onClick={() => push({name: 'trips'})} />
    <Hint icon={ShieldIcon}>Your words and shop summaries from all trips, including your notes, are sent to Spark to find the photo. Up to three selected shopping photos can be sent to SAM for item outlines. Photos of you, location coordinates, and photo embeddings are not part of this search.</Hint>
  </VStack>;
}

function PickPhoto({route, source}: {route: PickRoute; source: PickSource}) {
  const {services, online, push, back, popTo, deleted, say} = useUi();
  const photoArea = useRef<HTMLElement>(null);
  const {photo, shop, trip} = source;
  const {id, file, w, h} = source.asset;
  const asset = useMemo(() => ({id, file, w, h}), [id, file, w, h]);
  const matches = useMemo(() => [...(route.candidates ?? [])].sort((a, b) => b.score - a.score), [route.candidates]);
  const [tapping, setTapping] = useState(matches.length === 0);
  const [tapChoices, setTapChoices] = useState<Choice[]>([]);
  const [point, setPoint] = useState<ImagePoint | null>(null);
  const [selected, setSelected] = useState<string | null>(matches[0]?.id ?? null);
  const [showAll, setShowAll] = useState(false);
  const [readyMasks, setReadyMasks] = useState<Set<string>>(new Set());
  const [preparing, setPreparing] = useState(true);
  const [segmenting, setSegmenting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [prepareAttempt, setPrepareAttempt] = useState(0);
  const cache = useMemo(() => photoCache(asset), [asset]);
  const lifecycle = useRef<{live: boolean; handle: string | null; sequence: number; tap: Promise<void> | null; save: Promise<void> | null; release: (() => Promise<void>) | null; files: Set<string>; cancellation: AbortController}>({live: false, handle: null, sequence: 0, tap: null, save: null, release: null, files: new Set(), cancellation: new AbortController()});
  const fittingSubscribe = useCallback((listener: () => void) => services.fitting.subscribe(listener), [services]);
  const fittingSnapshot = useCallback(() => services.fitting.getSnapshot(), [services]);
  const fitting = useSyncExternalStore(fittingSubscribe, fittingSnapshot, fittingSnapshot);
  const atLimit = route.mode === 'outfit' && fitting.draft.companionPieceIds.length >= 5;
  const choices = useMemo<Choice[]>(() => tapping ? tapChoices : matches.map(candidate => ({candidate})), [tapping, tapChoices, matches]);
  const visible = useMemo(() => showAll ? choices : choices.slice(0, 3), [choices, showAll]);
  const visibleCandidates = useMemo(() => visible.map(choice => choice.candidate), [visible]);
  const chosen = choices.find(choice => choice.candidate.id === selected)?.candidate;
  const maskReady = Boolean(chosen && readyMasks.has(chosen.id));
  const onReady = useCallback((ids: Set<string>) => setReadyMasks(ids), []);
  const discard = useCallback(async (files: Iterable<string>, owned: Set<string>) => {
    const results = await Promise.allSettled(Array.from(files, async file => {
      await services.store.discardTemp({file});
      cache.forget(file);
      owned.delete(file);
    }));
    if (results.some(result => result.status === 'rejected')) throw {code: 'cleanup_failed'};
  }, [cache, services]);

  useEffect(() => {
    const current = {live: true, handle: null as string | null, sequence: 0, tap: null as Promise<void> | null, save: null as Promise<void> | null, release: null as (() => Promise<void>) | null, files: new Set<string>(), cancellation: new AbortController()};
    lifecycle.current = current;
    return () => {
      current.live = false;
      current.cancellation.abort();
      current.sequence++;
      void (async () => {
        const released = await Promise.allSettled([current.release?.(), current.tap, current.save]);
        const cleaned = await Promise.allSettled([
          discard(current.files, current.files),
          route.mode === 'wardrobe' && (lifecycle.current === current || !lifecycle.current.live) ? services.media.discard({assetId: asset.id}) : Promise.resolve(),
        ]);
        if ([...released, ...cleaned].some(result => result.status === 'rejected')) say('Some temporary photo data could not be removed from this device.');
      })();
    };
  }, [asset.id, discard, route.mode, services, say]);

  useEffect(() => {
    const current = lifecycle.current;
    let active = true;
    let handle: string | null = null;
    setPreparing(true);
    setPrepareError(null);
    const prepared = services.segmenter.prepare({asset}).then(result => {
      handle = result.handle;
      if (!active || !current.live) return;
      if (result.w !== asset.w || result.h !== asset.h) throw {code: 'inference_failed'};
      current.handle = result.handle;
    }).catch(cause => {if (active && current.live && errorCode(cause) !== 'cancelled') setPrepareError(errorCode(cause));}).finally(() => {if (active && current.live) setPreparing(false);});
    let releasing: Promise<void> | null = null;
    const release = () => releasing ??= (async () => {
      await prepared;
      await Promise.allSettled([current.tap, current.save]);
      if (handle) await services.segmenter.release({handle});
    })();
    current.release = release;
    return () => {
      active = false;
      if (current.handle === handle) current.handle = null;
      void release().catch(() => say('On-device selection resources could not be released.'));
    };
  }, [asset, services, prepareAttempt, say]);

  const clearTap = () => {
    const current = lifecycle.current;
    current.sequence++;
    const old = Array.from(current.files);
    setTapChoices([]);
    setPoint(null);
    setSelected(null);
    setSelectionError(null);
    void discard(old, current.files).catch(() => {
      if (current.live) setSelectionError('cleanup_failed');
      else say('Some temporary photo data could not be removed from this device.');
    });
  };

  const tap = (position: ImagePoint) => {
    const current = lifecycle.current;
    if (!current.live || !current.handle || current.tap || saving) return;
    const sequence = ++current.sequence;
    const handle = current.handle;
    const old = Array.from(current.files);
    setPoint(position);
    setSelected(null);
    setTapChoices([]);
    setSelectionError(null);
    setSaveError(null);
    setSegmenting(true);
    const task = (async () => {
      let returned: SegMask[] = [];
      let retained = false;
      try {
        await discard(old, current.files);
        returned = (await services.segmenter.tap({handle, x: position.x, y: position.y})).masks;
        if (returned.length !== 3 || returned.some(mask => !Number.isFinite(mask.score) || mask.score < 0 || mask.score > 1)) throw {code: 'inference_failed'};
        const results = await Promise.all(returned.map(async (mask, decoderIndex) => {
          const decoded = await cache.mask(mask.mask);
          return {candidate: {id: await candidateId(asset.id, 'edgetam', decoded.pixels), photoId: asset.id, source: 'edgetam' as const, label: route.concept ?? 'Picked item', score: mask.score, mask: mask.mask, bbox: mask.bbox}, area: decoded.area, decoderIndex};
        }));
        if (!current.live || current.sequence !== sequence) return;
        const areas = [...results].sort((a, b) => a.area - b.area || a.decoderIndex - b.decoderIndex);
        const names = ['Small area', 'Medium area', 'Large area'];
        const sorted = results.sort((a, b) => b.candidate.score - a.candidate.score || a.decoderIndex - b.decoderIndex);
        for (const result of sorted) current.files.add(result.candidate.mask);
        retained = true;
        setTapChoices(sorted.map(result => ({candidate: result.candidate, areaName: names[areas.indexOf(result)]})));
        setSelected(sorted[0].candidate.id);
      } catch (cause) {
        if (current.live && current.sequence === sequence && errorCode(cause) !== 'cancelled') {
          setSelectionError(errorCode(cause));
          if (errorCode(cause) === 'handle_expired') {current.handle = null; setPrepareError('handle_expired');}
        }
      } finally {
        try {
          if (!retained) {
            for (const mask of returned) current.files.add(mask.mask);
            await discard(returned.map(mask => mask.mask), current.files);
          }
        } catch {
          if (current.live) setSelectionError('cleanup_failed');
          else say('Some temporary photo data could not be removed from this device.');
        } finally {
          current.tap = null;
          if (current.live) setSegmenting(false);
        }
      }
    })();
    current.tap = task;
  };

  const complete = () => {
    const current = lifecycle.current;
    if (!current.live || !chosen || !maskReady || current.save || current.tap || atLimit) return;
    const candidate = {...chosen, label: route.concept ?? 'Picked item'};
    setSaveError(null);
    setSaving(true);
    const task = (async () => {
      try {
        if (route.mode === 'outfit') {
          await services.fitting.addTripCandidate(candidate, current.cancellation.signal);
          if (current.live) {say('Saved and added to your outfit'); popTo('outfit');}
        } else {
          const piece = await services.store.saveCandidate({candidate, origin: route.mode === 'wardrobe' ? 'wardrobe' : 'shop', labelMode: route.mode !== 'wardrobe' && route.concept ? 'concept' : 'describe'});
          if (!current.live) return;
          if (route.mode === 'wardrobe') {say('Added to your wardrobe'); popTo('wardrobe');}
          else push({name: 'item', pieceId: piece.id});
        }
      } catch (cause) {if (current.live && errorCode(cause) !== 'cancelled') setSaveError(errorCode(cause));}
      finally {current.save = null; if (current.live) setSaving(false);}
    })();
    current.save = task;
  };

  return <VStack gap={4}>
    {route.mode === 'wardrobe' && <Heading level={2}>Add to wardrobe</Heading>}
    <Text type="supporting">{route.mode === 'wardrobe' ? 'Tap the piece you own' : `${shop ? `Shop ${shop.n} · ` : ''}${new Date(trip?.startedAt ?? photo!.takenAt).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})} · ${new Date(photo!.takenAt).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit'})}`}</Text>
    {!online && <Text role="status">You’re offline. You can still select, save, and delete local items. New item names will be queued until you reconnect.</Text>}
    {photo && !saving && <HStack gap={2} wrap="wrap">
      <Action label="Save to gallery" variant="secondary" size="sm" icon={<Icon icon={ImageIcon}/>} run={async () => {
        try {await services.media.exportPhoto({photoId: photo.id}); say('Saved to gallery · location removed');}
        catch (cause) {if (errorCode(cause) !== 'cancelled') throw cause;}
      }} />
      <Confirm title="Delete photo?" description="This photo will be removed from your trip. Saved items and their walking directions will stay." action="Delete photo" icon={<Icon icon={TrashIcon}/>} onConfirm={async () => {await lifecycle.current.tap; await services.store.deletePhoto({id: photo.id}); deleted('Photo', photo.id); say('Photo deleted');}} />
    </HStack>}
    <VStack ref={photoArea} style={{scrollMarginTop: 'var(--spacing-4)'}}><PhotoSurface asset={asset} candidates={visibleCandidates} selected={selected} cache={cache} point={tapping ? point : null} disabled={saving || (tapping && (preparing || segmenting || Boolean(prepareError)))} onTap={tapping ? tap : undefined} onSelect={tapping ? undefined : setSelected} onReady={onReady} /></VStack>
    {tapping && !point && <Chip tone="accent">Tap the item in the photo</Chip>}
    {preparing && <HStack gap={2} vAlign="center"><Spinner size="sm" aria-label="Preparing"/><Text role="status" type="supporting">Preparing on-device item selection…</Text></HStack>}
    {prepareError && <Problem message={errorMessage(prepareError)} retry={() => setPrepareAttempt(value => value + 1)} />}
    {segmenting && <HStack gap={2} vAlign="center"><Spinner size="sm" aria-label="Outlining"/><Text role="status" type="supporting">Outlining this area on your device…</Text></HStack>}
    {selectionError && <Problem message={errorMessage(selectionError)} retry={selectionError === 'cleanup_failed' && !point ? clearTap : point && !prepareError ? () => tap(point) : undefined} />}
    {choices.length > 0 && <VStack gap={2}>
      <Heading level={3}>{tapping ? 'Which area?' : `Found ${choices.length} ${choices.length === 1 ? 'item' : 'items'}, best first`}</Heading>
      <Hint>Scores describe mask quality, not the probability that this is your item.</Hint>
      {visible.map(({candidate, areaName}, index) => <Reveal key={`${candidate.id}:${index}`} index={index}><RowButton label={`${index + 1}. ${areaName ?? candidate.label} · score ${Math.round(candidate.score * 100)}%`} pressed={candidate.id === selected} isDisabled={saving || segmenting} onClick={() => {setSelected(candidate.id); setSaveError(null);}}
        start={<VStack align="center" justify="center" width="var(--spacing-12)" height="var(--spacing-12)" style={{flexShrink: 0, borderRadius: 'var(--radius-element)', background: 'var(--color-background-muted)', overflow: 'hidden'}}><CandidatePreview asset={asset} candidate={candidate} cache={cache} ready={readyMasks.has(candidate.id)} /></VStack>}
        title={`${index + 1}. ${areaName ?? candidate.label}`}
        meta={<HStack as="span" gap={2} vAlign="center"><VStack as="span" width="var(--spacing-12)" height="var(--spacing-1)" style={{borderRadius: 'var(--radius-full)', background: 'var(--color-background-muted)', overflow: 'hidden'}}><VStack as="span" height="100%" width={`${Math.round(candidate.score * 100)}%`} style={{background: 'var(--color-accent)'}}/></VStack><Text as="span" type="supporting" size="xsm">Score {Math.round(candidate.score * 100)}%{candidate.id === selected ? ' · Selected' : ''}</Text></HStack>}
        end={<VStack as="span" align="center" justify="center" width="var(--spacing-6)" height="var(--spacing-6)" style={{flexShrink: 0, borderRadius: 'var(--radius-full)', border: candidate.id === selected ? 'none' : 'medium solid var(--color-border)', background: candidate.id === selected ? 'var(--color-accent)' : 'transparent', color: 'var(--color-on-accent)'}}>{candidate.id === selected && <Pop><Icon icon="check" size="xsm" color="inherit"/></Pop>}</VStack>}
      /></Reveal>)}
      {choices.length > 3 && <Button label={showAll ? 'Show first 3' : `Show all (${choices.length})`} variant="secondary" isDisabled={saving} onClick={() => {setShowAll(value => !value); if (showAll && selected && !choices.slice(0, 3).some(choice => choice.candidate.id === selected)) setSelected(null);}} />}
    </VStack>}
    {matches.length > 0 && <Button label={tapping ? 'Show matches' : 'Not here? Tap it'} variant="ghost" isDisabled={saving} onClick={() => {clearTap(); setTapping(value => !value); setShowAll(false); if (tapping) setSelected(matches[0]?.id ?? null); else requestAnimationFrame(() => photoArea.current?.scrollIntoView({block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth'}));}} />}
    {tapping && (tapChoices.length > 0 || segmenting) && <Button label="Cancel area selection" variant="ghost" isDisabled={saving} onClick={clearTap} />}
    <StickyBar>
    {atLimit && <Problem message="Your outfit already has five companion pieces. Return to the outfit to remove one first." />}
    {saveError && <Problem message={errorMessage(saveError)} retry={maskReady && !atLimit ? complete : undefined} />}
    {chosen && !route.concept && <Text type="supporting">This will be saved as “Picked item” while its name and category are prepared. You can edit them after saving.</Text>}
    <Button label={route.mode === 'wardrobe' ? 'Add to wardrobe' : route.mode === 'outfit' ? 'Add to outfit' : 'Use this item'} variant="primary" size="lg" isLoading={saving} isDisabled={!chosen || !maskReady || segmenting || atLimit} onClick={complete} />
    <Button label={route.mode === 'outfit' ? 'Cancel and return to outfit' : 'Cancel'} variant="ghost" onClick={() => {if (route.mode === 'outfit') popTo('outfit'); else back();}} />
    </StickyBar>
  </VStack>;
}

export function Pick({route}: {route: PickRoute}) {
  const {services, back} = useUi();
  const source = useData<PickSource | null>(async () => {
    if (route.mode === 'wardrobe') return route.asset ? {asset: route.asset, photo: null, shop: null, trip: null} : null;
    if (!route.photoId) return null;
    const photo = await services.store.get({entity: 'Photo', id: route.photoId});
    if (!photo) return null;
    const [shop, trip] = await Promise.all([services.store.get({entity: 'Shop', id: photo.shopId}), services.store.get({entity: 'Trip', id: photo.tripId})]);
    return {asset: {id: photo.id, file: photo.file, w: photo.w, h: photo.h}, photo, shop, trip};
  }, [services, route.photoId, route.asset, route.mode]);
  if (!source.data && source.loading) return <VStack gap={4}><SkeletonText lines={1} width="50%" /><SkeletonPhoto height="45dvh" label="Loading photo" /><SkeletonRows count={3} label="Loading items" /></VStack>;
  if (source.error) return <Problem message={source.error} retry={source.retry} />;
  if (!source.data) return <Empty title={route.mode === 'wardrobe' ? 'Photo unavailable' : 'Photo deleted'}><Text>{route.mode === 'wardrobe' ? 'Choose a wardrobe photo to select an item.' : 'This photo is no longer in your trips. Saved cutouts and walking directions are unchanged.'}</Text><Button label="Go back" variant="secondary" onClick={back} /></Empty>;
  if (route.candidates?.some(candidate => candidate.photoId !== source.data!.asset.id)) return <Problem message="These item outlines belong to a different photo. Go back and choose the photo again." />;
  return <PickPhoto key={`${route.mode}:${source.data.asset.id}`} route={route} source={source.data} />;
}
