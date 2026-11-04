import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {ReactNode} from 'react';
import {config} from '../config';
import type {Asset, Piece, QueueJob, Result as SavedResult} from '../native/contracts';
import type {Route} from '../ui/navigation';
import type {FittingState} from '../ui/services';

import {listAll, useData, useUi} from '../ui/state';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Divider} from '@astryxdesign/core/Divider';
import {Action, Button, Chip, Confirm, EditFields, Empty, Heading, Hint, HStack, Icon, IconTile, Loading, Media, Panel, PhotoView, Problem, Section, Text, Thumbnail, VStack} from '../ui/components';
import {CameraIcon, HangerIcon, ImageIcon, LockIcon, NoteIcon, PencilIcon, PinIcon, PlusIcon, RouteIcon, ShieldIcon, SparkleIcon, TrashIcon} from '../ui/icons';

const MAX_COMPANIONS = 5;
export function companionEligibility(draft: FittingState['draft'], pieceId: string) {
  if (!draft.targetPieceId) return 'no_target';
  if (pieceId === draft.targetPieceId) return 'target';
  if (draft.companionPieceIds.includes(pieceId)) return 'selected';
  if (draft.companionPieceIds.length >= MAX_COMPANIONS) return 'limit';
  return 'available';
}
export function resultViewPolicy(result: SavedResult, existingPieceIds: ReadonlySet<string> | null, ownerCanChange: boolean, resultDownload: boolean = config.resultDownload) {
  return {
    file: result.file,
    faceless: result.faceless,
    target: result.targetSnapshot,
    pieces: [result.targetSnapshot, ...result.companionSnapshots],
    destination: result.targetSnapshot.walkTo,
    canChangePieces: ownerCanChange && existingPieceIds?.has(result.targetPieceId) === true,
    canDownload: resultDownload,
  };
}
const phases: Record<FittingState['phase'], string> = {
  idle: 'Ready to generate',
  preparing: 'Preparing your pieces…',
  sending: 'Sending without your face and generating the look…',
  compositing: 'Checking the look and putting your face back on this phone…',
  saving: 'Saving your look on this phone…',
  complete: 'Your look is saved.',
  failed: 'Your look could not be completed.',
  cancelled: 'Generation cancelled. Your combination is still here.',
};
function generating(state: FittingState) {
  return state.phase === 'preparing' || state.phase === 'sending' || state.phase === 'compositing' || state.phase === 'saving';
}
function errorCode(cause: unknown) {
  return typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : '';
}
function fittingError(code: string) {
  switch (code) {
    case 'offline': return 'You’re offline. Connect, then tap Generate to try again. Your combination is saved.';
    case 'content_policy_violation': return 'The image provider could not create this look under its content policy. Change your photo or pieces before trying again.';
    case 'upstream_timeout': return 'The image provider took too long. No completed look was saved. You can tap Generate to try again.';
    case 'self_photo_changed': return 'Your photo changed while this look was being made. Check your photo, then tap Generate to try again.';
    case 'unsafe_output': return 'This look could not be safely finished. No completed look was saved.';
    case 'invalid_reference':
    case 'not_found': return 'One of your selected pieces is no longer available. Check your combination before generating.';
    case 'busy': return 'Another photo or look is still being processed. Wait for it to finish or cancel it.';
    default: return 'Your look could not be completed. Your original photo was not used as an unmasked replacement. Check your photo and pieces, then try again.';
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
  if (job) return <Text type="supporting">{!online ? 'Waiting for connection to name this piece.' : job.attempts > 0 ? 'Naming is waiting to retry. You can also rename this piece.' : 'Spark is naming this piece…'}</Text>;
  if (piece.category !== 'unknown') return null;
  return <VStack gap={2}><Text type="supporting">No automatic name is available. You can rename this piece or ask Spark to name the cut-out.</Text><Action label="Try naming again" variant="ghost" run={() => services.store.enqueue({kind: 'label_piece', refId: piece.id})}/></VStack>;
}
function PieceRow({piece, jobs, action, badge}: {piece: Piece; jobs: QueueJob[]; action?: ReactNode; badge?: ReactNode}) {
  return <HStack gap={3} vAlign="center" padding={3} style={{background: 'var(--color-background-card)', borderRadius: 'var(--radius-container)', boxShadow: 'var(--shadow-low)'}}>
    <Media file={piece.cutoutFile} label={piece.label} width="var(--spacing-12)" height="var(--spacing-12)" fit="contain"/>
    <VStack gap={1} style={{flex: 1, minWidth: 0}}><HStack gap={2} vAlign="center" wrap="wrap"><Text type="label" weight="semibold">{piece.label}</Text>{badge}</HStack><Text type="supporting" size="sm">{piece.origin === 'shop' ? 'Saved from a shop' : 'Your wardrobe'}{piece.category !== 'unknown' ? ` · ${piece.category}` : ''}</Text><Naming piece={piece} jobs={jobs}/></VStack>
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
  if (saved.loading) return <Loading/>;
  if (saved.error) return <Problem message={saved.error} retry={saved.retry}/>;
  if (!saved.data) return <Empty title="This piece is no longer saved"><Text>Your existing try-ons keep their own copies.</Text><Button label="Back to saved pieces" onClick={() => push({name: 'home'})}/></Empty>;
  const {piece, photo, shop, storefront, jobs} = saved.data;
  return <>
    <VStack as="section" gap={4}>
      <PhotoView file={piece.cutoutFile} label={piece.label}/>
      <HStack gap={3} vAlign="start" hAlign="between">
        <VStack gap={1} style={{minWidth: 0}}><HStack gap={2} vAlign="center" wrap="wrap"><Chip tone={piece.origin === 'shop' ? 'accent' : 'muted'}>{piece.origin === 'shop' ? 'Shop piece' : 'Wardrobe'}</Chip>{piece.category !== 'unknown' && <Chip>{piece.category}</Chip>}</HStack><Heading level={2}>{piece.label}</Heading><Text type="supporting">{piece.origin === 'wardrobe' ? 'In your wardrobe' : shop ? `Shop ${shop.n} · ${dateTime(shop.startedAt)}` : 'Saved from a shop'}</Text></VStack>
        <Button label="Rename" variant="secondary" size="sm" icon={<Icon icon={PencilIcon}/>} onClick={() => showSheet({title: 'Rename piece', content: <EditFields label={piece.label} category={piece.category} onSave={(label, category) => services.store.updatePiece({id: piece.id, label, category})}/>})}/>
      </HStack>
      <Naming piece={piece} jobs={jobs}/>
    </VStack>
    {piece.origin === 'shop' && <VStack gap={2}><HStack gap={2}><Action label="Try it on" size="lg" icon={<Icon icon={SparkleIcon}/>} style={{flex: 1}} run={async () => {await services.fitting.start(piece.id); if (alive.current) push({name: 'outfit'});}}/><Button label="Walk back" variant="secondary" size="lg" icon={<Icon icon={RouteIcon}/>} style={{flex: 1}} isDisabled={!piece.walkTo} onClick={() => push({name: 'walk', source: 'item', id: piece.id})}/></HStack>{!piece.walkTo && <Hint icon="warning">There is no saved photo location for walking guidance.</Hint>}{!online && <Hint>You can browse and edit offline. Connect to generate a look or load walking directions.</Hint>}</VStack>}
    {piece.origin === 'shop' ? <Section title={shop ? `Shop ${shop.n}` : 'Saved photo spot'} eyebrow="Where you found it"><Panel gap={3} padding={3}>
      {storefront ? <PhotoView file={storefront.file} label={`Storefront of Shop ${shop?.n}`}/> : <HStack gap={3} vAlign="center" padding={4} style={{background: 'var(--color-background-muted)', borderRadius: 'var(--radius-element)'}}><Icon icon={ImageIcon} color="secondary"/><Text type="supporting">No storefront photo</Text></HStack>}
      {shop?.description && <Text>{shop.description}</Text>}
      {shop?.descriptionState === 'pending' && <Text type="supporting">{online ? 'A storefront description is waiting to be completed.' : 'The storefront description is waiting for a connection.'}</Text>}
      {shop?.descriptionState === 'failed' && <Text type="supporting">The storefront description could not be completed.</Text>}
      {shop?.note && <HStack gap={2} vAlign="start" padding={3} style={{background: 'var(--color-hanok-bead)', borderRadius: 'var(--radius-element)'}}><Icon icon={NoteIcon} size="sm" color="secondary"/><Text size="sm">{shop.note}</Text></HStack>}
      {piece.walkTo && <HStack gap={2} vAlign="center" style={{color: 'var(--color-text-secondary)'}}><Icon icon={PinIcon} size="sm" color="inherit"/><Text type="supporting" size="sm" hasTabularNumbers>Photo spot · {piece.walkTo.lat.toFixed(5)}, {piece.walkTo.lng.toFixed(5)}</Text></HStack>}
      {photo && <Button label="Original photo" variant="secondary" size="sm" icon={<Icon icon={ImageIcon}/>} onClick={() => push({name: 'pick', mode: 'shop', photoId: photo.id})}/>}
      {!photo && <Hint>The original photo is no longer linked. Your cut-out and saved photo location stay available.</Hint>}
    </Panel></Section> : <Panel tone="muted" padding={4}><HStack gap={3} vAlign="center"><IconTile icon={HangerIcon}/><Text>Wear this with a saved shop piece. Choose it as a companion on the Try on screen.</Text></HStack></Panel>}
    <HStack gap={2} wrap="wrap" hAlign="between">{piece.origin === 'shop' && <Button label="Find another" variant="ghost" icon={<Icon icon="search"/>} onClick={()=>push({name:'ask'})}/>}
    <Confirm icon={<Icon icon={TrashIcon}/>} title="Delete this piece?" description="It will be removed from your saved pieces. Existing try-ons keep their own copy and walking destination." action="Delete piece" onConfirm={async () => {await services.store.deletePiece({id: piece.id}); deleted('Piece', piece.id); say('Piece deleted');}}/></HStack>
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
    <Text>Stand facing the camera, with your arms a little away from your body. Use a full-body photo. A successfully masked photo replaces your previous one.</Text>
    <Hint icon={ShieldIcon}>Face and hair are removed automatically on this phone before sending. Your original stays here.</Hint>
    {busy && <HStack gap={2} vAlign="center"><Spinner size="sm" aria-label="Processing"/><Text type="supporting">Removing face and hair on this phone…</Text></HStack>}
    <Button label="Take a photo" variant="secondary" icon={<Icon icon={CameraIcon}/>} isDisabled={busy} onClick={() => push({name: 'capture', purpose: 'self'})}/>
    <Action label="Choose from gallery" variant="secondary" icon={<Icon icon={ImageIcon}/>} disabled={busy} run={choose}/>
    <Button label={busy ? 'Close photo options' : 'Cancel'} variant="ghost" onClick={() => showSheet(null)}/>
  </VStack>;
}

function CompanionChooser() {
  const {services, push, showSheet} = useUi();
  const state = useFitting();
  const pieces = useData(async () => ({pieces: await listAll(services, 'Piece'), jobs: await listAll(services, 'QueueJob')}), [services]);
  const full = state.draft.companionPieceIds.length >= MAX_COMPANIONS;
  const busy = generating(state) || state.selfState === 'registering';
  return <VStack gap={4}>
    <Text>Add up to 5 companion pieces. Your shop target stays fixed.</Text>
    {full && <Text type="supporting">Up to 5 companion pieces. Remove one to add another.</Text>}
    <Button label="From a trip photo" variant="secondary" icon={<Icon icon={CameraIcon}/>} isDisabled={full || busy} onClick={() => push({name: 'trips', forOutfit: true})}/>
    {pieces.loading ? <Loading/> : pieces.error ? <Problem message={pieces.error} retry={pieces.retry}/> : (['wardrobe', 'shop'] as const).map(origin => {
      const available = pieces.data?.pieces.filter(piece => piece.origin === origin && piece.id !== state.draft.targetPieceId) ?? [];
      return <Section key={origin} title={origin === 'wardrobe' ? 'Your wardrobe' : 'Saved from shops'}>
        {!available.length && <Hint>{origin === 'wardrobe' ? 'No wardrobe pieces yet. You can add pieces from Wardrobe on the home screen.' : 'No other saved shop pieces yet. Pick one from a trip photo.'}</Hint>}
        {available.map(piece => {
          const eligibility = companionEligibility(state.draft, piece.id);
          return <PieceRow key={piece.id} piece={piece} jobs={pieces.data?.jobs ?? []} action={eligibility === 'selected' ? <Action label={`Remove ${piece.label}`} variant="ghost" size="sm" disabled={busy} run={async () => {services.fitting.removeCompanion(piece.id);}}/> : <Action label={`Add ${piece.label}`} variant="secondary" size="sm" icon={<Icon icon={PlusIcon}/>} disabled={eligibility !== 'available' || busy} run={() => services.fitting.addCompanion(piece.id)}/>}/>;
        })}
      </Section>;
    })}
    <Button label="Done choosing" variant="secondary" onClick={() => showSheet(null)}/>
  </VStack>;
}

export function Outfit() {
  const {services, push, popTo, showSheet, online} = useUi();
  const state = useFitting();
  const alive = useAlive();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const pieces = useData(async () => ({pieces: await listAll(services, 'Piece'), jobs: await listAll(services, 'QueueJob')}), [services]);
  useEffect(() => {
    let live = true;
    void services.fitting.refresh().catch(() => {if (live) setRefreshError('Your photo and combination could not be refreshed. Try loading them again.');});
    return () => {
      live = false;
      const current = services.fitting.getSnapshot();
      if (generating(current)) services.fitting.cancel();
    };
  }, [services.fitting]);
  const target = pieces.data?.pieces.find(piece => piece.id === state.draft.targetPieceId);
  const companionIds = state.draft.companionPieceIds;
  const busy = generating(state) || state.selfState === 'registering';
  const allCompanionsExist = companionIds.every(id => pieces.data?.pieces.some(piece => piece.id === id));
  const ready = !pieces.loading && !pieces.error && !refreshError && target?.origin === 'shop' && state.selfState === 'ready' && !!state.selfPhoto && companionIds.length <= MAX_COMPANIONS && allCompanionsExist && !busy && online;
  const steps = [state.selfState === 'ready' && !!state.selfPhoto, target?.origin === 'shop', companionIds.length > 0];
  return <>
    <VStack gap={3}>
      <Text type="large">One shop piece. Your own combination.</Text>
      <HStack gap={2} wrap="wrap">{['Your photo', 'Target', 'Companions'].map((name, index) => <Chip key={name} tone={steps[index] ? 'success' : 'muted'}>{steps[index] ? '✓ ' : `${index + 1} · `}{name}</Chip>)}</HStack>
    </VStack>
    {!online && <Problem message="You can choose pieces and browse trip photos offline. Connect to generate your look; generation is not queued." retry={pieces.retry}/>}
    {refreshError && <Problem message={refreshError}/>}
    {refreshError && <Action label="Reload your photo and combination" variant="secondary" run={async () => {await services.fitting.refresh(); setRefreshError(null);}}/>}
    <Section title="Your photo" eyebrow="Step 1">
      <Panel gap={3} padding={3}>
      {state.selfPhoto && state.selfState !== 'registering' && <VStack style={{position: 'relative'}}><PhotoView file={state.selfPhoto.file} label="Your full-body photo, kept on this phone"/><HStack gap={1} vAlign="center" paddingInline={2} paddingBlock={1} style={{position: 'absolute', top: 'var(--spacing-3)', left: 'var(--spacing-3)', background: 'color-mix(in srgb, var(--color-background-inverted) 78%, transparent)', color: 'var(--color-on-dark)', borderRadius: 'var(--radius-full)'}}><Icon icon={LockIcon} size="xsm" color="inherit"/><Text type="label" size="xsm" color="inherit">On this phone</Text></HStack></VStack>}
      {state.selfState === 'empty' && <HStack gap={3} vAlign="center"><IconTile icon={CameraIcon} tone="muted" size="lg"/><Text>Add one full-body photo to try on your pieces.</Text></HStack>}
      {state.selfState === 'registering' && <HStack gap={3} vAlign="center" padding={4} style={{background: 'var(--color-accent-muted)', borderRadius: 'var(--radius-element)'}}><Spinner size="lg" aria-label="Processing"/><Text color="accent">Removing face and hair on this phone…</Text></HStack>}
      {state.selfState === 'failed' && <Problem message="We couldn’t safely remove your face and hair from the new photo. Retake a full-body photo. An unmasked photo will not be sent."/>}
      {state.selfState === 'failed' && state.selfPhoto && <Text type="supporting">Your previous successfully registered photo is still saved. Finish registering a replacement before generating.</Text>}
      {state.selfState === 'ready' && state.selfPhoto && <Hint icon={ShieldIcon}>Full-body · {dateTime(state.selfPhoto.updatedAt)}. Your original stays on this phone.</Hint>}
      <Button label={state.selfState === 'failed' ? 'Retake' : state.selfPhoto ? 'Change' : 'Add your photo'} variant={state.selfPhoto ? 'secondary' : 'primary'} icon={<Icon icon={state.selfPhoto ? PencilIcon : CameraIcon}/>} isDisabled={busy} onClick={() => showSheet({title: state.selfPhoto ? 'Change your photo' : 'Add your photo', content: <SelfPhotoChooser/>})}/>
      {state.selfState === 'registering' && <Hint>Photo processing finishes on this phone even if you leave this screen. It does not start generation.</Hint>}
      </Panel>
    </Section>
    {pieces.loading ? <Loading/> : pieces.error ? <Problem message={pieces.error} retry={pieces.retry}/> : <>
      <Section title="Target · 1 shop piece" eyebrow="Step 2">
        {target?.origin === 'shop' ? <PieceRow piece={target} jobs={pieces.data?.jobs ?? []} badge={<Chip tone="accent">Fixed target</Chip>}/> : <Empty icon={HangerIcon} title={state.draft.targetPieceId ? 'Your target piece is no longer saved' : 'Choose a shop piece first'}><Text>Open a piece saved from a shop and tap Try it on. Wardrobe pieces can only be companions.</Text><Button label="Choose a saved shop piece" isDisabled={busy} onClick={() => push({name: 'home'})}/></Empty>}
      </Section>
      <Section title={`Wear with it · ${companionIds.length} of ${MAX_COMPANIONS}`} eyebrow="Step 3 · optional">
        <HStack gap={1}>{Array.from({length: MAX_COMPANIONS}, (_, index) => <VStack key={index} height="var(--spacing-1)" style={{flex: 1, borderRadius: 'var(--radius-full)', background: index < companionIds.length ? 'var(--color-accent)' : 'var(--color-background-muted)'}}/>)}</HStack>
        {!companionIds.length && <Text type="supporting">Optional. Mix in pieces from your wardrobe, saved pieces, or a trip photo.</Text>}
        {companionIds.map(id => {
          const piece = pieces.data?.pieces.find(value => value.id === id);
          const remove = <Action label={piece ? `Remove ${piece.label}` : 'Remove unavailable piece'} variant="ghost" size="sm" disabled={busy} run={async () => {services.fitting.removeCompanion(id);}}/>;
          return piece ? <PieceRow key={id} piece={piece} jobs={pieces.data?.jobs ?? []} action={remove}/> : <HStack key={id} gap={3} wrap="wrap"><Text>This companion is no longer saved.</Text>{remove}</HStack>;
        })}
        {companionIds.length >= MAX_COMPANIONS && <Text type="supporting">Up to 5 companion pieces. Remove one to add another.</Text>}
        <Button label="Add a companion" variant="secondary" icon={<Icon icon={PlusIcon}/>} isDisabled={!target || busy || companionIds.length >= MAX_COMPANIONS} onClick={() => showSheet({title: 'Wear with it', content: <CompanionChooser/>})}/>
      </Section>
    </>}
    {generating(state) && <VStack role="status" aria-live="polite" gap={3} padding={5} style={{background: 'var(--color-hero)', color: 'var(--color-on-hero)', borderRadius: 'var(--radius-container)'}}><HStack gap={3} vAlign="center"><Spinner size="lg" shade="inherit" aria-label="Generating"/><Text type="label" weight="semibold" color="inherit">{phases[state.phase]}</Text></HStack><HStack gap={1}>{(['preparing', 'sending', 'compositing', 'saving'] as const).map((phase, index, all) => <VStack key={phase} height="var(--spacing-1)" style={{flex: 1, borderRadius: 'var(--radius-full)', background: all.indexOf(state.phase as typeof phase) >= index ? 'var(--color-on-hero)' : 'color-mix(in srgb, var(--color-on-hero) 25%, transparent)'}}/>)}</HStack><Text size="sm" style={{color: 'color-mix(in srgb, var(--color-on-hero) 78%, transparent)'}}>Your original photo, face and hair stay on this phone.</Text><Button label="Cancel generation" variant="secondary" onClick={() => services.fitting.cancel()}/></VStack>}
    {state.phase === 'cancelled' && <Hint>{phases.cancelled}</Hint>}
    {state.error && errorCode(state.error) !== 'cancelled' && state.selfState !== 'failed' && <Problem message={fittingError(state.error.code)}/>}
    <Action label="Generate" size="lg" icon={<Icon icon={SparkleIcon}/>} disabled={!ready} run={async () => {const result = await services.fitting.generate(); if (result && alive.current) popTo('outfit', {name: 'result', resultId: result.id});}}/>
    <Hint icon={ShieldIcon}>One face-and-hair-removed photo, your target and up to 5 companion cut-outs are sent for generation.</Hint>
  </>;
}

function DeleteResult({result}: {result: SavedResult}) {
  const {services, deleted, say} = useUi();
  return <Confirm icon={<Icon icon={TrashIcon}/>} title="Delete this look?" description="This removes the look and its saved snapshots from your try-ons. Your saved pieces stay." action="Delete look" onConfirm={async () => {await services.store.deleteResult({id: result.id}); deleted('Result', result.id); say('Look deleted');}}/>;
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
  if (saved.loading) return <Loading/>;
  if (saved.error) return <Problem message={saved.error} retry={saved.retry}/>;
  if (!saved.data) return <Empty title="This look is no longer saved"><Button label="Back to try-ons" onClick={() => popTo('home', {name: 'results'})}/></Empty>;
  const result = saved.data;
  const view = resultViewPolicy(result, links.data?.pieceIds ?? null, links.data?.canChange === true && !links.loading && !links.error);
  const snapshots = view.pieces;
  const canChange = view.canChangePieces;
  const targetDeleted = links.data && !links.data.pieceIds.has(result.targetPieceId);
  return <>
    <VStack gap={3}><HStack gap={2} vAlign="center" wrap="wrap"><Chip tone="accent">{snapshots.length} {snapshots.length === 1 ? 'piece' : 'pieces'}</Chip><Text type="supporting" size="sm">{dateTime(result.createdAt)}</Text></HStack><PhotoView file={view.file} label={`Your generated look wearing ${view.target.label}`}/>{view.faceless && <Hint icon={ShieldIcon}>Your face couldn’t be put back cleanly, so this look is shown without it.</Hint>}{targetDeleted && <Hint icon="warning">The target piece was deleted. Your look and walk-back location are still saved.</Hint>}</VStack>
    <HStack gap={2}><Action label="Change pieces" variant="secondary" size="lg" icon={<Icon icon={PencilIcon}/>} style={{flex: 1}} disabled={!canChange} run={async () => {if (!await services.fitting.canChangePieces(result)) {links.retry(); return;} await services.fitting.restoreResult(result); if (alive.current) {if (stack.some(entry => entry.name === 'outfit')) popTo('outfit'); else push({name: 'outfit'});}}}/><Button label={view.target.shop ? `Walk to Shop ${view.target.shop.n}` : 'Walk back to the photo spot'} variant="primary" size="lg" icon={<Icon icon={RouteIcon}/>} style={{flex: 1}} isDisabled={!view.destination} onClick={() => push({name: 'walk', source: 'result', id: result.id})}/></HStack>
    {links.error && <Problem message="Your look is available, but links to the original pieces could not be checked." retry={links.retry}/>}
    <Section title="Wearing">
      {snapshots.map((piece, index) => <HStack key={piece.pieceId} gap={3} vAlign="center" padding={3} style={{background: 'var(--color-background-card)', borderRadius: 'var(--radius-container)', boxShadow: 'var(--shadow-low)'}}><Media file={piece.cutoutFile} label={piece.label} width="var(--spacing-12)" height="var(--spacing-12)" fit="contain"/><VStack gap={1} style={{flex: 1, minWidth: 0}}><Text type="label" weight="semibold">{piece.label}</Text><Text type="supporting" size="sm">{index === 0 ? 'Target · ' : 'Companion · '}{piece.origin === 'wardrobe' ? 'Your wardrobe' : piece.shop ? `Shop ${piece.shop.n}` : 'Saved from a shop'}{links.data && !links.data.pieceIds.has(piece.pieceId) ? ' · Saved snapshot' : ''}</Text></VStack>{links.data?.pieceIds.has(piece.pieceId) && !links.loading && <Button label={`Open ${piece.label}`} variant="ghost" size="sm" endContent={<Icon icon="chevronRight" size="sm"/>} onClick={() => push({name: 'item', pieceId: piece.pieceId})}>Open</Button>}</HStack>)}
    </Section>
    {result.targetSnapshot.shop && <Section title={`Shop ${result.targetSnapshot.shop.n}`} eyebrow="Saved with this look"><Panel gap={3} padding={3}>
      {result.targetSnapshot.shop.storefrontFile && <PhotoView file={result.targetSnapshot.shop.storefrontFile} label={`Saved storefront of Shop ${result.targetSnapshot.shop.n}`}/>}
      {result.targetSnapshot.shop.description && <Text>{result.targetSnapshot.shop.description}</Text>}
      {result.targetSnapshot.shop.note && <HStack gap={2} vAlign="start" padding={3} style={{background: 'var(--color-hanok-bead)', borderRadius: 'var(--radius-element)'}}><Icon icon={NoteIcon} size="sm" color="secondary"/><Text size="sm">{result.targetSnapshot.shop.note}</Text></HStack>}
      <Hint icon="clock">Saved with this look · {dateTime(result.targetSnapshot.shop.startedAt)}</Hint>
    </Panel></Section>}
    {!online && <Hint>This look is available offline. Connect to load walking directions or generate a changed combination.</Hint>}
    {view.canDownload && <Action label="Save look to gallery" variant="secondary" run={async () => {if (!view.canDownload) return; await services.fitting.exportResult(result.id);}}/>}
    <DeleteResult result={result}/>
  </>;
}

export function Results() {
  const {services, push, online} = useUi();
  const results = useData(() => listAll(services, 'Result'), [services]);
  if (results.loading) return <Loading/>;
  if (results.error) return <Problem message={results.error} retry={results.retry}/>;
  const saved = (results.data ?? []).toSorted((left, right) => right.createdAt - left.createdAt);
  return <VStack gap={4}><HStack gap={2} vAlign="center"><Chip tone="accent">{saved.length} {saved.length === 1 ? 'look' : 'looks'}</Chip><Hint icon={LockIcon}>Kept on this phone</Hint></HStack>{!online && <Hint>Your saved looks can be opened and deleted offline.</Hint>}{!saved.length ? <Empty title="No looks yet" icon={SparkleIcon}><Text type="supporting">Open something you saved and tap Try it on.</Text><Button label="Open saved pieces" onClick={() => push({name: 'home'})}/></Empty> : saved.map(result => <Panel key={result.id} gap={3} padding={3}><HStack gap={3} vAlign="start"><Thumbnail src={result.file} label={`look with ${result.targetSnapshot.label}`} style={{width: 'calc(var(--spacing-12) * 2)', height: 'calc(var(--spacing-12) * 2.5)'}} onClick={() => push({name: 'result', resultId: result.id})}/><VStack gap={1} style={{flex: 1, minWidth: 0}}><Text type="label" weight="semibold">{result.targetSnapshot.label}</Text><Text type="supporting" size="sm">{result.companionSnapshots.length + 1} pieces · {dateTime(result.createdAt)}</Text>{result.faceless && <Chip>Shown without your face</Chip>}</VStack></HStack><Divider/><HStack gap={2} hAlign="between" vAlign="center"><DeleteResult result={result}/><Button label={`Open look from ${dateTime(result.createdAt)}`} variant="secondary" size="sm" endContent={<Icon icon="chevronRight" size="sm"/>} onClick={() => push({name: 'result', resultId: result.id})}>Open look</Button></HStack></Panel>)}</VStack>;
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
  return <VStack gap={4}><Text>Lay it flat or hang it up. You’ll tap it to cut it out.</Text><Hint icon={ShieldIcon}>Only your chosen cut-out is sent for a name and for try-on, never the whole wardrobe photo.</Hint><Button label="Take a photo" variant="secondary" icon={<Icon icon={CameraIcon}/>} onClick={() => push({name: 'capture', purpose: 'wardrobe'})}/><Action label="Choose from gallery" variant="secondary" icon={<Icon icon={ImageIcon}/>} run={choose}/><Button label="Cancel" variant="ghost" onClick={() => showSheet(null)}/></VStack>;
}

export function Wardrobe() {
  const {services, push, showSheet, online} = useUi();
  const wardrobe = useData(async () => ({pieces: await listAll(services, 'Piece', {origin: 'wardrobe'}), jobs: await listAll(services, 'QueueJob')}), [services]);
  return <>
    <VStack gap={4}>
      <HStack gap={3} vAlign="center" hAlign="between"><Text type="large" weight="semibold">{wardrobe.data?.pieces.length ?? 0} pieces you own</Text><Button label="Add a piece" variant="primary" icon={<Icon icon={PlusIcon}/>} onClick={() => showSheet({title: 'Add a piece', content: <AddWardrobePiece/>})}/></HStack>
      {wardrobe.loading ? <Loading/> : wardrobe.error ? <Problem message={wardrobe.error} retry={wardrobe.retry}/> : !wardrobe.data?.pieces.length ? <Empty title="Your wardrobe is empty" icon={HangerIcon}><Text type="supporting">Add a piece you own, then wear it with a saved shop piece.</Text></Empty> : <VStack gap={2}>{wardrobe.data.pieces.map(piece => <PieceRow key={piece.id} piece={piece} jobs={wardrobe.data?.jobs ?? []} action={<Button label={`Open ${piece.label}`} variant="ghost" size="sm" endContent={<Icon icon="chevronRight" size="sm"/>} onClick={() => push({name: 'item', pieceId: piece.id})}>Open</Button>}/>)}</VStack>}
      <Hint icon={ShieldIcon}>Mix these with what you saved to see them together. Only the cut-out piece is ever sent, never the whole photo.</Hint>
      {!online && <Hint>You can add, browse and delete pieces offline. Naming waits for a connection.</Hint>}
    </VStack>
  </>;
}
