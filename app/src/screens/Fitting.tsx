import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {ReactNode} from 'react';
import {config} from '../config';
import {GARMENT_SLOTS, categoryNames, emptySlotRule, pieceCategory, slotExamples, slotNames, slotOf} from '../category';
import type {GarmentSlot} from '../category';
import type {Asset, Piece, QueueJob, Result as SavedResult, ResultPieceSnapshot} from '../native/contracts';
import {wornSlots} from '../tryon';
import type {Outfit as OutfitDraft} from '../tryon';
import {localCompositionConfig} from '../native/compositionConfig';
import type {Route} from '../ui/navigation';
import type {FittingState} from '../ui/services';

import {listAll, useData, useUi} from '../ui/state';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Sweep} from '../ui/motion';
import {Divider} from '@astryxdesign/core/Divider';
import {Action, Button, Chip, Confirm, EditFields, Empty, Eyebrow, Heading, Hint, HStack, Icon, IconTile, Media, Panel, PhotoView, Pop, Problem, Reveal, RowButton, Section, SkeletonPhoto, SkeletonRows, SkeletonText, StickyBar, Text, Thumbnail, VStack} from '../ui/components';
import {CameraIcon, HangerIcon, ImageIcon, LockIcon, NoteIcon, PencilIcon, PinIcon, PlusIcon, RouteIcon, ShieldIcon, SparkleIcon, TrashIcon} from '../ui/icons';

/** Whether a piece can go in a mannequin slot, and how. */
export function slotChoice(outfit: OutfitDraft, slot: GarmentSlot, piece: Pick<Piece, 'id' | 'category'>) {
  if (outfit[slot] === piece.id) return 'wearing';
  const own = slotOf(piece);
  if (own === slot) return 'fits';
  return own ? 'other_slot' : 'unsorted';
}
export function resultViewPolicy(result: SavedResult, existingPieceIds: ReadonlySet<string> | null, ownerCanChange: boolean, resultDownload: boolean = config.resultDownload) {
  const pieces = [result.targetSnapshot, ...result.companionSnapshots];
  const seen = new Set<string>();
  return {
    file: result.file,
    faceless: result.faceless,
    pieces,
    title: pieces.map(piece => piece.label).join(', '),
    // A look can hold shop pieces from several shops; offer one walk-back per shop (or per spot without one).
    destinations: pieces.filter((piece): piece is ResultPieceSnapshot & {walkTo: NonNullable<ResultPieceSnapshot['walkTo']>} => {
      if (piece.origin !== 'shop' || !piece.walkTo) return false;
      const key = piece.shop ? `shop:${piece.shop.n}:${piece.shop.startedAt}` : `spot:${piece.walkTo.lat},${piece.walkTo.lng}`;
      return !seen.has(key) && !!seen.add(key);
    }),
    canChangePieces: ownerCanChange && pieces.some(piece => existingPieceIds?.has(piece.pieceId) === true),
    canDownload: resultDownload,
  };
}
function kindOf(piece: {category: string}) {
  const kind = pieceCategory(piece.category);
  return kind === 'unknown' ? '' : categoryNames[kind];
}
const phases: Record<FittingState['phase'], string> = {
  idle: 'Ready',
  preparing: 'Preparing your pieces…',
  sending: 'Creating your look. Your face isn’t sent.',
  compositing: 'Adding your face back on this phone…',
  saving: 'Saving your look…',
  cancelling: 'Cancelling and cleaning up on this phone…',
  complete: 'Your look is saved.',
  failed: 'Couldn’t create your look.',
  cancelled: 'Cancelled. Your pieces are still selected.',
};
function generating(state: FittingState) {
  return state.phase === 'preparing' || state.phase === 'sending' || state.phase === 'compositing' || state.phase === 'saving' || state.phase === 'cancelling';
}
function errorCode(cause: unknown) {
  return typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : '';
}
function fittingError(code: string) {
  switch (code) {
    case 'offline': return 'You’re offline. Connect and tap Fit again. Your pieces are still selected.';
    case 'content_policy_violation': return 'This look goes against the image service’s content rules. Try a different photo or different pieces.';
    case 'upstream_timeout': return 'This took too long and nothing was saved. Tap Fit to try again.';
    case 'self_photo_changed': return 'Your photo changed while the look was being made. Check it, then tap Fit again.';
    case 'unsafe_output': return 'We couldn’t finish this look safely, so nothing was saved.';
    case 'invalid_reference':
    case 'not_found': return 'One of your pieces was deleted. Check your selection, then try again.';
    case 'busy': return 'Another photo or look is still in progress. Wait for it to finish, or cancel it.';
    default: return 'Couldn’t create your look. Your unmasked photo was never sent. Check your photo and pieces, then try again.';
  }
}
function dateTime(time: number) {
  return new Date(time).toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'});
}
function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  return alive;
}
function useFitting() {
  const {services} = useUi();
  const subscribe = useCallback((listener: () => void) => services.fitting.subscribe(listener), [services.fitting]);
  const snapshot = useCallback(() => services.fitting.getSnapshot(), [services.fitting]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
function Naming({piece, jobs}: {piece: Piece; jobs: QueueJob[]}) {
  const {online, services} = useUi();
  const job = jobs.find(value => value.kind === 'label_piece' && value.refId === piece.id);
  if (job) return <Text type="supporting">{!online ? 'Waiting for connection to name this piece.' : job.attempts > 0 ? 'Naming will try again soon, or you can rename it yourself.' : 'Naming this piece…'}</Text>;
  if (pieceCategory(piece.category) !== 'unknown') return null;
  return <VStack gap={2}><Text type="supporting">Couldn’t name this piece automatically. Rename it yourself or try again.</Text><Action label="Try naming again" variant="ghost" run={() => services.store.enqueue({kind: 'label_piece', refId: piece.id})}/></VStack>;
}
function PieceRow({piece, jobs, action, badge}: {piece: Piece; jobs: QueueJob[]; action?: ReactNode; badge?: ReactNode}) {
  return <HStack gap={3} vAlign="center" padding={3} style={{background: 'var(--color-background-card)', borderRadius: 'var(--radius-container)', boxShadow: 'var(--shadow-low)'}}>
    <Media file={piece.cutoutFile} label={piece.label} width="var(--spacing-12)" height="var(--spacing-12)" fit="contain"/>
    <VStack gap={1} style={{flex: 1, minWidth: 0}}><HStack gap={2} vAlign="center" wrap="wrap"><Text type="label" weight="semibold">{piece.label}</Text>{badge}</HStack><Text type="supporting" size="sm">{kindOf(piece) ? `${kindOf(piece)} · ` : ''}{piece.origin === 'shop' ? 'Saved from a shop' : 'Your wardrobe'}</Text><Naming piece={piece} jobs={jobs}/></VStack>
    {action}
  </HStack>;
}

export function Item({route}: {route: Extract<Route, {name: 'item'}>}) {
  const {services, push, deleted, showSheet, say, online} = useUi();
  const alive = useAlive();
  const saved = useData(async () => {
    const piece = await services.store.get({entity: 'Piece', id: route.pieceId});
    if (!piece) return null;
    const [photo, shop, jobs] = await Promise.all([
      piece.photoId ? services.store.get({entity: 'Photo', id: piece.photoId}) : null,
      piece.shopId ? services.store.get({entity: 'Shop', id: piece.shopId}) : null,
      listAll(services, 'QueueJob'),
    ]);
    const storefront = shop?.storefrontPhotoId ? await services.store.get({entity: 'Photo', id: shop.storefrontPhotoId}) : null;
    return {piece, photo, shop, storefront, jobs};
  }, [services, route.pieceId]);
  if (saved.loading && !saved.data) return <VStack gap={4}><SkeletonPhoto height="44dvh" label="Loading piece"/><SkeletonText lines={2} width="55%"/><HStack gap={2}><Skeleton height="var(--spacing-12)" radius="rounded"/><Skeleton height="var(--spacing-12)" radius="rounded"/></HStack><SkeletonRows count={1}/></VStack>;
  if (saved.error) return <Problem message={saved.error} retry={saved.retry}/>;
  if (!saved.data) return <Empty title="This piece is no longer saved"><Text>Looks you made with it are still saved.</Text><Button label="Back to saved pieces" onClick={() => push({name: 'home'})}/></Empty>;
  const {piece, photo, shop, storefront, jobs} = saved.data;
  return <>
    <VStack as="section" gap={4}>
      <PhotoView file={piece.cutoutFile} label={piece.label}/>
      <HStack gap={3} vAlign="start" hAlign="between">
        <VStack gap={1} style={{minWidth: 0}}><HStack gap={2} vAlign="center" wrap="wrap"><Chip tone={piece.origin === 'shop' ? 'accent' : 'muted'}>{piece.origin === 'shop' ? 'Shop piece' : 'Wardrobe'}</Chip>{kindOf(piece) && <Chip>{kindOf(piece)}</Chip>}</HStack><Heading level={2}>{piece.label}</Heading><Text type="supporting">{piece.origin === 'wardrobe' ? 'In your wardrobe' : shop ? `Shop ${shop.n} · ${dateTime(shop.startedAt)}` : 'Saved from a shop'}</Text></VStack>
        <Button label="Edit" variant="secondary" size="sm" icon={<Icon icon={PencilIcon}/>} onClick={() => showSheet({title: 'Edit piece', form: true, content: <EditFields label={piece.label} category={piece.category} onSave={(label, category) => services.store.updatePiece({id: piece.id, label, category})}/>})}/>
      </HStack>
      <Naming piece={piece} jobs={jobs}/>
    </VStack>
    <VStack gap={2}><HStack gap={2}><Action label="Try it on" size="lg" icon={<Icon icon={SparkleIcon}/>} style={{flex: 1}} run={async () => {
      if (!slotOf(piece)) {showSheet({title: 'What kind of piece is this?', content: <SortAndWear piece={piece}/>}); return;}
      await services.fitting.wear(piece.id); if (alive.current) push({name: 'outfit'});
    }}/>{piece.origin === 'shop' && <Button label="Walk back" variant="secondary" size="lg" icon={<Icon icon={RouteIcon}/>} style={{flex: 1}} isDisabled={!piece.walkTo} onClick={() => push({name: 'walk', source: 'item', id: piece.id})}/>}</HStack>{piece.origin === 'shop' && !piece.walkTo && <Hint icon="warning">No location was saved with this photo, so walking back isn’t available.</Hint>}{!online && <Hint>You’re offline. Connect to try it on{piece.origin === 'shop' ? ' or walk back' : ''}.</Hint>}</VStack>
    {piece.origin === 'shop' ? <Section title={shop ? `Shop ${shop.n}` : 'Saved photo spot'} eyebrow="Where you found it"><Panel gap={3} padding={3}>
      {storefront ? <PhotoView file={storefront.file} label={`Storefront of Shop ${shop?.n}`}/> : <HStack gap={3} vAlign="center" padding={4} style={{background: 'var(--color-background-muted)', borderRadius: 'var(--radius-element)'}}><Icon icon={ImageIcon} color="secondary"/><Text type="supporting">No storefront photo</Text></HStack>}
      {shop?.description && <Text>{shop.description}</Text>}
      {shop?.descriptionState === 'pending' && <Text type="supporting">{online ? 'Describing the storefront…' : 'Will describe the storefront when you’re back online.'}</Text>}
      {shop?.descriptionState === 'failed' && <Text type="supporting">Couldn’t describe the storefront.</Text>}
      {shop?.note && <HStack gap={2} vAlign="start" padding={3} style={{background: 'var(--color-hanok-bead)', borderRadius: 'var(--radius-element)'}}><Icon icon={NoteIcon} size="sm" color="secondary"/><Text size="sm">{shop.note}</Text></HStack>}
      {piece.walkTo && <HStack gap={2} vAlign="center" style={{color: 'var(--color-text-secondary)'}}><Icon icon={PinIcon} size="sm" color="inherit"/><Text type="supporting" size="sm" hasTabularNumbers>Location saved where you took the photo</Text></HStack>}
      {photo && <Button label="Original photo" variant="secondary" size="sm" icon={<Icon icon={ImageIcon}/>} onClick={() => push({name: 'pick', mode: 'shop', photoId: photo.id})}/>}
      {!photo && <Hint>The original photo was deleted. This piece and its location are still saved.</Hint>}
    </Panel></Section> : <Panel tone="muted" padding={4}><HStack gap={3} vAlign="center"><IconTile icon={HangerIcon}/><Text>Tap Try it on to put it on the mannequin. Mix it with pieces you saved from shops.</Text></HStack></Panel>}
    <HStack gap={2} wrap="wrap" hAlign="between">{piece.origin === 'shop' && <Button label="Find another" variant="ghost" icon={<Icon icon="search"/>} onClick={()=>push({name:'ask'})}/>}
    <Confirm icon={<Icon icon={TrashIcon}/>} title="Delete this piece?" description="It will be removed from your saved pieces. Looks you made with it stay." action="Delete piece" onConfirm={async () => {await services.store.deletePiece({id: piece.id}); deleted('Piece', piece.id); say('Piece deleted');}}/></HStack>
  </>;
}

function SelfPhotoChooser() {
  const {services, push, showSheet} = useUi();
  const state = useFitting();
  const alive = useAlive();
  const choose = async () => {
    let asset: Asset | null = null;
    let consumedByFitting = false;
    try {
      asset = (await services.media.pick({purpose: 'self'})).asset;
      if (!alive.current) return;
      await services.fitting.registerSelf(asset);
      consumedByFitting = true;
      if (alive.current) showSheet(null);
    } catch (cause) {
      if (errorCode(cause) !== 'cancelled') throw cause;
    } finally {
      if (asset && !consumedByFitting) await services.media.discard({assetId: asset.id});
    }
  };
  const busy = state.selfState === 'registering';
  return <VStack gap={4}>
    <Text>Face the camera with your arms slightly away from your body, and get your whole body in the shot. This replaces your current photo.</Text>
    <Hint icon={ShieldIcon}>Your face and hair are removed on this phone before anything is sent. The original stays here.</Hint>
    {busy && <HStack gap={2} vAlign="center"><Spinner size="sm" aria-label="Processing"/><Text type="supporting">Removing face and hair on this phone…</Text></HStack>}
    <Button label="Take a photo" variant="secondary" icon={<Icon icon={CameraIcon}/>} isDisabled={busy} onClick={() => push({name: 'capture', purpose: 'self'})}/>
    <Action label="Choose from gallery" variant="secondary" icon={<Icon icon={ImageIcon}/>} disabled={busy} run={choose}/>
    <Button label={busy ? 'Close photo options' : 'Cancel'} variant="ghost" onClick={() => showSheet(null)}/>
  </VStack>;
}

/** Shown before trying on a piece that isn't an outer layer, top or bottom yet. */
function SortAndWear({piece}: {piece: Piece}) {
  const {services, push, showSheet} = useUi();
  const alive = useAlive();
  return <VStack gap={4}>
    <Text>{piece.label} isn’t sorted yet. Choose where it goes on the mannequin.</Text>
    {GARMENT_SLOTS.map(slot => <Action key={slot} label={`Wear as ${slotNames[slot].toLowerCase()}`} variant="secondary" run={async () => {await services.fitting.setSlot(slot, piece.id); if (alive.current) {showSheet(null); push({name: 'outfit'});}}}/>)}
    <Text type="supporting" size="sm">Shoes, bags, dresses and accessories can’t be tried on yet.</Text>
    <Button label="Cancel" variant="ghost" onClick={() => showSheet(null)}/>
  </VStack>;
}

function SlotChooser({slot}: {slot: GarmentSlot}) {
  const {services, push, showSheet} = useUi();
  const state = useFitting();
  const pieces = useData(async () => ({pieces: await listAll(services, 'Piece'), jobs: await listAll(services, 'QueueJob')}), [services]);
  const busy = generating(state) || state.selfState === 'registering';
  const name = slotNames[slot].toLowerCase();
  const wear = (piece: Piece) => <Action label={`Wear ${piece.label}`} text="Wear" variant="secondary" size="sm" icon={<Icon icon={PlusIcon}/>} disabled={busy} run={async () => {await services.fitting.setSlot(slot, piece.id); showSheet(null);}}/>;
  const fits = pieces.data?.pieces.filter(piece => slotChoice(state.draft.outfit, slot, piece) !== 'other_slot' && slotChoice(state.draft.outfit, slot, piece) !== 'unsorted') ?? [];
  // Unsorted pieces, and pieces Spark (or the user) sorted differently, can be re-sorted here.
  const others = pieces.data?.pieces.filter(piece => ['other_slot', 'unsorted'].includes(slotChoice(state.draft.outfit, slot, piece))) ?? [];
  return <VStack gap={4}>
    <Text>{slotExamples[slot]}. One {name} at a time; choosing another swaps it.</Text>
    <Button label="From a trip photo" variant="secondary" icon={<Icon icon={CameraIcon}/>} isDisabled={busy} onClick={() => push({name: 'trips', forOutfit: slot})}/>
    {pieces.loading && !pieces.data ? <SkeletonRows count={3} label="Loading your pieces"/> : pieces.error ? <Problem message={pieces.error} retry={pieces.retry}/> : <>
      {(['wardrobe', 'shop'] as const).map(origin => {
        const available = fits.filter(piece => piece.origin === origin);
        return <Section key={origin} title={origin === 'wardrobe' ? 'Your wardrobe' : 'Saved from shops'}>
          {!available.length && <Hint>{origin === 'wardrobe' ? `No ${name} pieces in your wardrobe yet.` : `No saved shop ${name} pieces yet. Pick one from a trip photo.`}</Hint>}
          {available.map((piece, index) => <Reveal key={piece.id} index={index}><PieceRow piece={piece} jobs={pieces.data?.jobs ?? []} badge={slotChoice(state.draft.outfit, slot, piece) === 'wearing' ? <Chip tone="success">Wearing</Chip> : undefined} action={slotChoice(state.draft.outfit, slot, piece) === 'wearing' ? undefined : wear(piece)}/></Reveal>)}
        </Section>;
      })}
      {others.length > 0 && <Section title="Other pieces" description={`Using one as a ${name} saves that as its kind.`}>
        {others.map((piece, index) => <Reveal key={piece.id} index={index}><PieceRow piece={piece} jobs={pieces.data?.jobs ?? []} action={<Action label={`Use ${piece.label} as ${name}`} text={`Use as ${name}`} variant="secondary" size="sm" disabled={busy} run={async () => {await services.fitting.setSlot(slot, piece.id); showSheet(null);}}/>}/></Reveal>)}
      </Section>}
    </>}
    <Button label="Done choosing" variant="secondary" onClick={() => showSheet(null)}/>
  </VStack>;
}

/** A plain dress form: head and neck stay blank because only the body is ever restyled. */
function MannequinFigure({outfit}: {outfit: OutfitDraft}) {
  const fill = (slot: GarmentSlot) => ({fill: outfit[slot] ? 'var(--color-accent)' : 'var(--color-background-muted)', stroke: outfit[slot] ? 'var(--color-accent)' : 'var(--color-border)', strokeDasharray: outfit[slot] ? undefined : '4 3', transition: 'fill 240ms ease, stroke 240ms ease'});
  return <svg viewBox="0 0 120 260" role="img" aria-label={`Mannequin wearing ${wornSlots(outfit).map(([slot]) => slotNames[slot].toLowerCase()).join(', ') || 'nothing yet'}`} style={{width: 'calc(var(--spacing-12) * 2)', height: 'auto', flexShrink: 0}}>
    <circle cx="60" cy="22" r="15" style={{fill: 'var(--color-background-muted)', stroke: 'var(--color-border)'}}/>
    <path d="M54 37h12v9H54z" style={{fill: 'var(--color-background-muted)', stroke: 'var(--color-border)'}}/>
    <path d="M38 52q22-10 44 0l4 70H34z" style={fill('top')}/>
    <path d="M30 50q30-14 60 0l12 86-14 2-6-58v58H38V80l-6 58-14-2z" style={{...fill('outer'), fillOpacity: outfit.outer ? 0.55 : 0.4}}/>
    <path d="M36 140h48l-4 112H64l-4-80-4 80H40z" style={fill('bottom')}/>
  </svg>;
}

function SlotRow({slot, outfit, piece, jobs, busy, deleted}: {slot: GarmentSlot; outfit: OutfitDraft; piece: Piece | undefined; jobs: QueueJob[]; busy: boolean; deleted: boolean}) {
  const {services, online, showSheet} = useUi();
  const name = slotNames[slot].toLowerCase();
  const filled = new Set(wornSlots(outfit).map(([value]) => value));
  const choose = () => showSheet({title: `Choose ${name}`, content: <SlotChooser slot={slot}/>});
  const clear = (label: string) => <Action label={label} text="Remove" variant="ghost" size="sm" disabled={busy} run={async () => {services.fitting.clearSlot(slot);}}/>;
  const naming = piece && jobs.some(job => job.kind === 'label_piece' && job.refId === piece.id);
  return <VStack gap={1}>
    <Eyebrow>{slotNames[slot]}</Eyebrow>
    {deleted ? <><Text>This piece was deleted.</Text>{clear(`Clear ${name}`)}</>
      : piece ? <><RowButton label={`Change ${name}`} title={piece.label} meta={naming ? (online ? 'Naming…' : 'Named when you’re online') : piece.origin === 'shop' ? 'Saved from a shop' : 'Your wardrobe'} start={<Media file={piece.cutoutFile} label={piece.label} width="var(--spacing-10)" height="var(--spacing-10)" fit="contain"/>} isDisabled={busy} onClick={choose}/>{clear(`Remove ${piece.label} from ${name}`)}</>
      : <RowButton label={`Add ${name}`} meta={emptySlotRule(slot, filled)} start={<IconTile icon={PlusIcon} tone="muted"/>} isDisabled={busy} onClick={choose}/>}
  </VStack>;
}

export function Outfit() {
  const {services, popTo, showSheet, online} = useUi();
  const state = useFitting();
  const alive = useAlive();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const pieces = useData(async () => ({pieces: await listAll(services, 'Piece'), jobs: await listAll(services, 'QueueJob')}), [services]);
  useEffect(() => {
    let live = true;
    void services.fitting.refresh().catch(() => {if (live) setRefreshError('Couldn’t load your photo and pieces. Try again.');});
    return () => {
      live = false;
      const current = services.fitting.getSnapshot();
      if (generating(current)) services.fitting.cancel();
    };
  }, [services.fitting]);
  const outfit = state.draft.outfit;
  const worn = wornSlots(outfit);
  const pieceOf = (id: string | undefined) => id ? pieces.data?.pieces.find(piece => piece.id === id) : undefined;
  const busy = generating(state) || state.selfState === 'registering';
  const allWornExist = worn.every(([, id]) => !!pieceOf(id));
  const ready = !pieces.loading && !pieces.error && !refreshError && worn.length > 0 && state.selfState === 'ready' && !!state.selfPhoto && allWornExist && !busy && online;
  const steps = [state.selfState === 'ready' && !!state.selfPhoto, worn.length > 0];
  // Say why Fit is unavailable right next to it, instead of leaving a silently disabled button.
  const blocker = !online ? 'Connect to the internet to create your look.' : state.selfState !== 'ready' || !state.selfPhoto ? 'Add a full-body photo of yourself first.' : !worn.length ? 'Put at least one piece on the mannequin.' : !allWornExist ? 'Clear the piece that was deleted.' : 'Loading your photo and pieces…';
  return <>
    <VStack gap={3}>
      <Text type="large">Dress the mannequin: one outer layer, top and bottom. Fit shows the whole outfit on you in one look.</Text>
      <HStack gap={2} wrap="wrap">{['Your photo', 'Your outfit'].map((name, index) => <Chip key={`${name}:${steps[index]}`} tone={steps[index] ? 'success' : 'muted'}>{steps[index] ? <Pop>✓</Pop> : `${index + 1} · `}{name}</Chip>)}</HStack>
    </VStack>
    {!online && <Problem message="You’re offline. You can still pick pieces. Connect to create your look." retry={pieces.retry}/>}
    {refreshError && <Problem message={refreshError}/>}
    {refreshError && <Action label="Reload your photo and combination" variant="secondary" run={async () => {await services.fitting.refresh(); setRefreshError(null);}}/>}
    <Section title="Your photo" eyebrow="Step 1">
      <Panel gap={3} padding={3}>
      {state.selfPhoto && state.selfState !== 'registering' && <VStack style={{position: 'relative'}}><PhotoView file={state.selfPhoto.file} label="Your full-body photo, kept on this phone"/><HStack gap={1} vAlign="center" paddingInline={2} paddingBlock={1} style={{position: 'absolute', top: 'var(--spacing-3)', left: 'var(--spacing-3)', background: 'color-mix(in srgb, var(--color-background-inverted) 78%, transparent)', color: 'var(--color-on-dark)', borderRadius: 'var(--radius-full)'}}><Icon icon={LockIcon} size="xsm" color="inherit"/><Text type="label" size="xsm" color="inherit">On this phone</Text></HStack></VStack>}
      {state.selfState === 'empty' && <HStack gap={3} vAlign="center"><IconTile icon={CameraIcon} tone="muted" size="lg"/><Text>Add one full-body photo to try on your pieces.</Text></HStack>}
      {state.selfState === 'registering' && <HStack gap={3} vAlign="center" padding={4} style={{background: 'var(--color-accent-muted)', borderRadius: 'var(--radius-element)'}}><Spinner size="lg" aria-label="Processing"/><Text color="accent">Removing face and hair on this phone…</Text></HStack>}
      {state.selfState === 'failed' && <Problem message="We couldn’t safely remove your face and hair from this photo, so nothing was sent. Please retake a full-body photo."/>}
      {state.selfState === 'failed' && state.selfPhoto && <Text type="supporting">Your previous photo is still saved, but you’ll need a new photo that works before creating a look.</Text>}
      {state.selfState === 'ready' && state.selfPhoto && <Hint icon={ShieldIcon}>Full-body · {dateTime(state.selfPhoto.updatedAt)}. Your original stays on this phone.</Hint>}
      <Button label={state.selfState === 'failed' ? 'Retake' : state.selfPhoto ? 'Change' : 'Add your photo'} variant={state.selfPhoto ? 'secondary' : 'primary'} icon={<Icon icon={state.selfPhoto ? PencilIcon : CameraIcon}/>} isDisabled={busy} onClick={() => showSheet({title: state.selfPhoto ? 'Change your photo' : 'Add your photo', content: <SelfPhotoChooser/>})}/>
      {state.selfState === 'registering' && <Hint>You can leave this screen. Your photo keeps processing on this phone.</Hint>}
      </Panel>
    </Section>
    {pieces.loading && !pieces.data ? <SkeletonRows count={3} label="Loading your outfit"/> : pieces.error ? <Problem message={pieces.error} retry={pieces.retry}/> :
      <Section title={`Your outfit · ${worn.length} of ${GARMENT_SLOTS.length}`} eyebrow="Step 2">
        <HStack gap={4} vAlign="start">
          <MannequinFigure outfit={outfit}/>
          <VStack gap={3} style={{flex: 1, minWidth: 0}}>
            {GARMENT_SLOTS.map(slot => <SlotRow key={slot} slot={slot} outfit={outfit} piece={pieceOf(outfit[slot])} jobs={pieces.data?.jobs ?? []} busy={busy} deleted={!!outfit[slot] && !pieceOf(outfit[slot])}/>)}
          </VStack>
        </HStack>
        <Hint>Empty slots keep what you’re wearing in your photo. A jacket in your photo comes off only when you choose a top.</Hint>
      </Section>}
    <StickyBar>
    {generating(state) && <Reveal from="scale"><VStack role="status" aria-live="polite" gap={3} padding={5} style={{background: 'var(--color-hero)', color: 'var(--color-on-hero)', borderRadius: 'var(--radius-container)'}}><HStack gap={3} vAlign="center"><Spinner size="lg" shade="inherit" aria-label="Generating"/><Text type="label" weight="semibold" color="inherit">{phases[state.phase]}</Text></HStack><HStack gap={1}>{(['preparing', 'sending', 'compositing', 'saving'] as const).map((phase, index, all) => <VStack key={phase} height="var(--spacing-1)" style={{flex: 1, borderRadius: 'var(--radius-full)', overflow: 'hidden', transition: 'background 400ms ease', background: all.indexOf(state.phase as typeof phase) > index ? 'var(--color-on-hero)' : 'color-mix(in srgb, var(--color-on-hero) 25%, transparent)'}}>{all.indexOf(state.phase as typeof phase) === index && <Sweep/>}</VStack>)}</HStack><Text size="sm" style={{color: 'color-mix(in srgb, var(--color-on-hero) 78%, transparent)'}}>Your original photo, face and hair stay on this phone.</Text><Button label="Cancel generation" variant="secondary" isDisabled={state.phase === 'cancelling'} onClick={() => services.fitting.cancel()}/></VStack></Reveal>}
    {state.phase === 'cancelled' && <Hint>{phases.cancelled}</Hint>}
    {state.error && errorCode(state.error) !== 'cancelled' && state.selfState !== 'failed' && <Problem message={fittingError(state.error.code)}/>}
    {!ready && !busy && !pieces.loading && <Hint icon="info">{blocker}</Hint>}
    <Action label="Fit" size="lg" icon={<Icon icon={SparkleIcon}/>} disabled={!ready} run={async () => {const result = await services.fitting.generate(); if (result && alive.current) popTo('outfit', {name: 'result', resultId: result.id});}}/>
    <Hint icon={ShieldIcon}>Only your photo with face and hair removed and the cut-outs on the mannequin are sent.</Hint>
    {localCompositionConfig.provenance?.humanApproved === false && <Text type="supporting">This demo bundles provisional face-restoration calibration for one synthetic self photo, used only in debug or verification builds. It has not been human-reviewed. Other photos remain faceless.</Text>}
    </StickyBar>
  </>;
}

function DeleteResult({result}: {result: SavedResult}) {
  const {services, deleted, say} = useUi();
  return <Confirm icon={<Icon icon={TrashIcon}/>} title="Delete this look?" description="This deletes the look. Your saved pieces stay." action="Delete look" onConfirm={async () => {await services.store.deleteResult({id: result.id}); deleted('Result', result.id); say('Look deleted');}}/>;
}

export function Result({route}: {route: Extract<Route, {name: 'result'}>}) {
  const {services, push, popTo, stack, online} = useUi();
  const alive = useAlive();
  const saved = useData(() => services.store.get({entity: 'Result', id: route.resultId}), [services, route.resultId]);
  const links = useData(async () => {
    const result = await services.store.get({entity: 'Result', id: route.resultId});
    if (!result) return null;
    const [canChange, pieces] = await Promise.all([services.fitting.canChangePieces(result), Promise.all([result.targetSnapshot, ...result.companionSnapshots].map(snapshot => services.store.get({entity: 'Piece', id: snapshot.pieceId})))]);
    return {canChange, pieceIds: new Set(pieces.filter((piece): piece is Piece => !!piece).map(piece => piece.id))};
  }, [services, route.resultId]);
  if (saved.loading && !saved.data) return <VStack gap={4}><SkeletonText lines={1} width="40%"/><SkeletonPhoto height="52dvh" label="Loading your look"/><SkeletonRows count={1}/></VStack>;
  if (saved.error) return <Problem message={saved.error} retry={saved.retry}/>;
  if (!saved.data) return <Empty title="This look is no longer saved"><Button label="Back to try-ons" onClick={() => popTo('home', {name: 'results'})}/></Empty>;
  const result = saved.data;
  const view = resultViewPolicy(result, links.data?.pieceIds ?? null, links.data?.canChange === true && !links.loading && !links.error);
  const snapshots = view.pieces;
  const canChange = view.canChangePieces;
  const anyDeleted = links.data && snapshots.some(piece => !links.data!.pieceIds.has(piece.pieceId));
  const walkTo = (piece: ResultPieceSnapshot) => push({name: 'walk', source: 'result', id: result.id, pieceId: piece.pieceId});
  const walkLabel = (piece: ResultPieceSnapshot) => piece.shop ? `Walk to Shop ${piece.shop.n}` : `Walk back to ${piece.label}`;
  // Each shop the look's pieces came from, once.
  const shops = [...new Map(snapshots.flatMap(piece => piece.shop ? [[`${piece.shop.n}:${piece.shop.startedAt}`, piece.shop] as const] : [])).values()];
  return <>
    <VStack gap={3}><HStack gap={2} vAlign="center" wrap="wrap"><Chip tone="accent">{snapshots.length} {snapshots.length === 1 ? 'piece' : 'pieces'}</Chip><Text type="supporting" size="sm">{dateTime(result.createdAt)}</Text></HStack><PhotoView file={view.file} label={`Your generated look wearing ${view.title}`}/>{view.faceless && <Hint icon={ShieldIcon}>Your face couldn’t be put back cleanly, so this look is shown without it.</Hint>}{anyDeleted && <Hint icon="warning">Some pieces were deleted, but this look and its walk-back spots are still saved.</Hint>}</VStack>
    <HStack gap={2}><Action label="Change pieces" variant="secondary" size="lg" icon={<Icon icon={PencilIcon}/>} style={{flex: 1}} disabled={!canChange} run={async () => {if (!await services.fitting.canChangePieces(result)) {links.retry(); return;} await services.fitting.restoreResult(result); if (alive.current) {if (stack.some(entry => entry.name === 'outfit')) popTo('outfit'); else push({name: 'outfit'});}}}/>{view.destinations.length === 1 && <Button label={walkLabel(view.destinations[0])} variant="primary" size="lg" icon={<Icon icon={RouteIcon}/>} style={{flex: 1}} onClick={() => walkTo(view.destinations[0])}/>}</HStack>
    {view.destinations.length > 1 && <Hint icon={RouteIcon}>These pieces came from different spots. Walk back to each one from the list below.</Hint>}
    {links.error && <Problem message="Couldn’t check whether the original pieces still exist." retry={links.retry}/>}
    <Section title="Wearing">
      {snapshots.map((piece, index) => <Reveal key={piece.pieceId} index={index}><HStack gap={3} vAlign="center" padding={3} style={{background: 'var(--color-background-card)', borderRadius: 'var(--radius-container)', boxShadow: 'var(--shadow-low)'}}><Media file={piece.cutoutFile} label={piece.label} width="var(--spacing-12)" height="var(--spacing-12)" fit="contain"/><VStack gap={1} style={{flex: 1, minWidth: 0}}><Text type="label" weight="semibold">{piece.label}</Text><Text type="supporting" size="sm">{kindOf(piece) ? `${kindOf(piece)} · ` : ''}{piece.origin === 'wardrobe' ? 'Your wardrobe' : piece.shop ? `Shop ${piece.shop.n}` : 'Saved from a shop'}{links.data && !links.data.pieceIds.has(piece.pieceId) ? ' · Saved copy' : ''}</Text></VStack><VStack gap={1}>{view.destinations.length > 1 && view.destinations.includes(piece as typeof view.destinations[number]) && <Button label={walkLabel(piece)} variant="secondary" size="sm" icon={<Icon icon={RouteIcon}/>} onClick={() => walkTo(piece)}>Walk</Button>}{links.data?.pieceIds.has(piece.pieceId) && !links.loading && <Button label={`Open ${piece.label}`} variant="ghost" size="sm" endContent={<Icon icon="chevronRight" size="sm"/>} onClick={() => push({name: 'item', pieceId: piece.pieceId})}>Open</Button>}</VStack></HStack></Reveal>)}
    </Section>
    {shops.map(shop => <Section key={`${shop.n}:${shop.startedAt}`} title={`Shop ${shop.n}`} eyebrow="Saved with this look"><Panel gap={3} padding={3}>
      {shop.storefrontFile && <PhotoView file={shop.storefrontFile} label={`Saved storefront of Shop ${shop.n}`}/>}
      {shop.description && <Text>{shop.description}</Text>}
      {shop.note && <HStack gap={2} vAlign="start" padding={3} style={{background: 'var(--color-hanok-bead)', borderRadius: 'var(--radius-element)'}}><Icon icon={NoteIcon} size="sm" color="secondary"/><Text size="sm">{shop.note}</Text></HStack>}
      <Hint icon="clock">Saved with this look · {dateTime(shop.startedAt)}</Hint>
    </Panel></Section>)}
    {!online && <Hint>You can view this look offline. Connect to walk back or change pieces.</Hint>}
    {view.canDownload && <Action label="Save look to gallery" variant="secondary" run={async () => {if (!view.canDownload) return; await services.fitting.exportResult(result.id);}}/>}
    <DeleteResult result={result}/>
  </>;
}

export function Results() {
  const {services, push, online} = useUi();
  const results = useData(() => listAll(services, 'Result'), [services]);
  if (results.loading && !results.data) return <VStack gap={4}><SkeletonText lines={1} width="35%"/><SkeletonRows count={2} media="calc(var(--spacing-12) * 2)" label="Loading your looks"/></VStack>;
  if (results.error) return <Problem message={results.error} retry={results.retry}/>;
  const saved = (results.data ?? []).toSorted((left, right) => right.createdAt - left.createdAt);
  return <VStack gap={4}><HStack gap={2} vAlign="center"><Chip tone="accent">{saved.length} {saved.length === 1 ? 'look' : 'looks'}</Chip><Hint icon={LockIcon}>Kept on this phone</Hint></HStack>{!online && <Hint>Your saved looks can be opened and deleted offline.</Hint>}{!saved.length ? <Empty title="No looks yet" icon={SparkleIcon}><Text type="supporting">Dress the mannequin on the Try on screen, then tap Fit.</Text><Button label="Open saved pieces" onClick={() => push({name: 'home'})}/></Empty> : saved.map((result, index) => <Reveal key={result.id} index={index}><Panel gap={3} padding={3}><HStack gap={3} vAlign="start"><Thumbnail src={result.file} label={`look with ${resultViewPolicy(result, null, false).title}`} style={{width: 'calc(var(--spacing-12) * 2)', height: 'calc(var(--spacing-12) * 2.5)'}} onClick={() => push({name: 'result', resultId: result.id})}/><VStack gap={1} style={{flex: 1, minWidth: 0}}><Text type="label" weight="semibold">{resultViewPolicy(result, null, false).title}</Text><Text type="supporting" size="sm">{result.companionSnapshots.length + 1} {result.companionSnapshots.length ? 'pieces' : 'piece'} · {dateTime(result.createdAt)}</Text>{result.faceless && <Chip>Shown without your face</Chip>}</VStack></HStack><Divider/><HStack gap={2} hAlign="between" vAlign="center"><DeleteResult result={result}/><Button label={`Open look from ${dateTime(result.createdAt)}`} variant="secondary" size="sm" endContent={<Icon icon="chevronRight" size="sm"/>} onClick={() => push({name: 'result', resultId: result.id})}>Open look</Button></HStack></Panel></Reveal>)}</VStack>;
}

function AddWardrobePiece() {
  const {services, push, showSheet} = useUi();
  const alive = useAlive();
  const choose = async () => {
    try {
      const {asset} = await services.media.pick({purpose: 'wardrobe'});
      if (!alive.current) {await services.media.discard({assetId: asset.id}); return;}
      push({name: 'pick', mode: 'wardrobe', asset});
    } catch (cause) {
      if (errorCode(cause) !== 'cancelled') throw cause;
    }
  };
  return <VStack gap={4}><Text>Lay it flat or hang it up. You’ll tap it to cut it out.</Text><Hint icon={ShieldIcon}>Only the cut-out is sent, to name it and to try it on. The whole photo never leaves your phone.</Hint><Button label="Take a photo" variant="secondary" icon={<Icon icon={CameraIcon}/>} onClick={() => push({name: 'capture', purpose: 'wardrobe'})}/><Action label="Choose from gallery" variant="secondary" icon={<Icon icon={ImageIcon}/>} run={choose}/><Button label="Cancel" variant="ghost" onClick={() => showSheet(null)}/></VStack>;
}

export function Wardrobe() {
  const {services, push, showSheet, online} = useUi();
  const wardrobe = useData(async () => ({pieces: await listAll(services, 'Piece', {origin: 'wardrobe'}), jobs: await listAll(services, 'QueueJob')}), [services]);
  return <>
    <VStack gap={4}>
      <HStack gap={3} vAlign="center" hAlign="between"><Text type="large" weight="semibold">{wardrobe.data?.pieces.length ?? 0} pieces you own</Text><Button label="Add a piece" variant="primary" icon={<Icon icon={PlusIcon}/>} onClick={() => showSheet({title: 'Add a piece', content: <AddWardrobePiece/>})}/></HStack>
      {wardrobe.loading && !wardrobe.data ? <SkeletonRows count={3} media="var(--spacing-12)" label="Loading your wardrobe"/> : wardrobe.error ? <Problem message={wardrobe.error} retry={wardrobe.retry}/> : !wardrobe.data?.pieces.length ? <Empty title="Your wardrobe is empty" icon={HangerIcon}><Text type="supporting">Add a piece you own, then try it on with anything you saved.</Text></Empty> : <VStack gap={2}>{wardrobe.data.pieces.map((piece, index) => <Reveal key={piece.id} index={index}><PieceRow piece={piece} jobs={wardrobe.data?.jobs ?? []} action={<Button label={`Open ${piece.label}`} variant="ghost" size="sm" endContent={<Icon icon="chevronRight" size="sm"/>} onClick={() => push({name: 'item', pieceId: piece.id})}>Open</Button>}/></Reveal>)}</VStack>}
      <Hint icon={ShieldIcon}>Open a piece and tap Try it on to put it on the mannequin. Only the cut-out is ever sent, never the whole photo.</Hint>
      {!online && <Hint>You’re offline. You can still add and remove pieces. Naming finishes when you reconnect.</Hint>}
    </VStack>
  </>;
}
