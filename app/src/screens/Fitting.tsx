import {useCallback, useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {ReactNode} from 'react';
import {config} from '../config';
import type {Asset, Piece, QueueJob, Result as SavedResult} from '../native/contracts';
import type {Route} from '../ui/navigation';
import type {FittingState} from '../ui/services';
import {fileUrl} from '../ui/services';
import {listAll, useData, useUi} from '../ui/state';
import {Action, Button, Confirm, EditFields, Empty, HStack, Loading, PhotoView, Problem, Section, Text, Thumbnail, VStack} from '../ui/components';

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
function PieceRow({piece, jobs, action}: {piece: Piece; jobs: QueueJob[]; action?: ReactNode}) {
  return <HStack gap={4} wrap="wrap" vAlign="center"><Thumbnail src={fileUrl(piece.cutoutFile)} label={piece.label} alt={piece.label}/><VStack gap={2}><Text type="label">{piece.label}</Text><Text type="supporting">{piece.origin === 'shop' ? 'Saved from a shop' : 'Your wardrobe'}{piece.category !== 'unknown' ? ` · ${piece.category}` : ''}</Text><Naming piece={piece} jobs={jobs}/></VStack>{action}</HStack>;
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
    <Section title={piece.label}><Text>{piece.origin === 'wardrobe' ? 'In your wardrobe' : shop ? `Shop ${shop.n} · ${dateTime(shop.startedAt)}` : 'Saved from a shop'}</Text><PhotoView file={piece.cutoutFile} label={piece.label}/><Naming piece={piece} jobs={jobs}/><Text type="supporting">{piece.category}</Text><Button label="Rename" variant="ghost" onClick={() => showSheet({title: 'Rename piece', content: <EditFields label={piece.label} category={piece.category} onSave={(label, category) => services.store.updatePiece({id: piece.id, label, category})}/>})}/></Section>
    {piece.origin === 'shop' ? <Section title={shop ? `Shop ${shop.n}` : 'Saved photo spot'}>
      {storefront ? <PhotoView file={storefront.file} label={`Storefront of Shop ${shop?.n}`}/> : <Text type="supporting">No storefront photo</Text>}
      {shop?.description && <Text>{shop.description}</Text>}
      {shop?.descriptionState === 'pending' && <Text type="supporting">{online ? 'A storefront description is waiting to be completed.' : 'The storefront description is waiting for a connection.'}</Text>}
      {shop?.descriptionState === 'failed' && <Text type="supporting">The storefront description could not be completed.</Text>}
      {shop?.note && <Text>Note: {shop.note}</Text>}
      {piece.walkTo && <Text type="supporting">Photo spot · {piece.walkTo.lat.toFixed(5)}, {piece.walkTo.lng.toFixed(5)}</Text>}
      {photo && <Button label="Original photo" variant="ghost" onClick={() => push({name: 'pick', mode: 'shop', photoId: photo.id})}/>}
      {!photo && <Text type="supporting">The original photo is no longer linked. Your cut-out and saved photo location stay available.</Text>}
      {!online && <Text type="supporting">You can browse and edit offline. Connect to generate a look or load walking directions.</Text>}
      <HStack gap={3} wrap="wrap"><Action label="Try it on" run={async () => {await services.fitting.start(piece.id); if (alive.current) push({name: 'outfit'});}}/><Button label="Walk back" variant="secondary" isDisabled={!piece.walkTo} onClick={() => push({name: 'walk', source: 'item', id: piece.id})}/></HStack>
      {!piece.walkTo && <Text type="supporting">There is no saved photo location for walking guidance.</Text>}
    </Section> : <Text>Wear this with a saved shop piece. Choose it as a companion on the Try on screen.</Text>}
    <Confirm title="Delete this piece?" description="It will be removed from your saved pieces. Existing try-ons keep their own copy and walking destination." action="Delete piece" onConfirm={async () => {await services.store.deletePiece({id: piece.id}); deleted('Piece', piece.id); say('Piece deleted');}}/>
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
    <Text type="supporting">Face and hair are removed automatically on this phone before sending. Your original stays here.</Text>
    {busy && <Text type="supporting">Removing face and hair on this phone…</Text>}
    <Button label="Take a photo" variant="secondary" isDisabled={busy} onClick={() => push({name: 'capture', purpose: 'self'})}/>
    <Action label="Choose from gallery" variant="secondary" disabled={busy} run={choose}/>
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
    <Button label="From a trip photo" variant="secondary" isDisabled={full || busy} onClick={() => push({name: 'trips', forOutfit: true})}/>
    {pieces.loading ? <Loading/> : pieces.error ? <Problem message={pieces.error} retry={pieces.retry}/> : (['wardrobe', 'shop'] as const).map(origin => {
      const available = pieces.data?.pieces.filter(piece => piece.origin === origin && piece.id !== state.draft.targetPieceId) ?? [];
      return <Section key={origin} title={origin === 'wardrobe' ? 'Your wardrobe' : 'Saved from shops'}>
        {!available.length && <Text type="supporting">{origin === 'wardrobe' ? 'No wardrobe pieces yet. You can add pieces from Wardrobe on the home screen.' : 'No other saved shop pieces yet. Pick one from a trip photo.'}</Text>}
        {available.map(piece => {
          const eligibility = companionEligibility(state.draft, piece.id);
          return <PieceRow key={piece.id} piece={piece} jobs={pieces.data?.jobs ?? []} action={eligibility === 'selected' ? <Action label={`Remove ${piece.label}`} variant="ghost" disabled={busy} run={async () => {services.fitting.removeCompanion(piece.id);}}/> : <Action label={`Add ${piece.label}`} variant="secondary" disabled={eligibility !== 'available' || busy} run={() => services.fitting.addCompanion(piece.id)}/>}/>;
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
  return <>
    <Text>One shop piece. Your own combination.</Text>
    {!online && <Problem message="You can choose pieces and browse trip photos offline. Connect to generate your look; generation is not queued." retry={pieces.retry}/>}
    {refreshError && <Problem message={refreshError}/>}
    {refreshError && <Action label="Reload your photo and combination" variant="secondary" run={async () => {await services.fitting.refresh(); setRefreshError(null);}}/>}
    <Section title="Your photo">
      {state.selfPhoto && state.selfState !== 'registering' && <PhotoView file={state.selfPhoto.file} label="Your full-body photo, kept on this phone"/>}
      {state.selfState === 'empty' && <Text>Add one full-body photo to try on your pieces.</Text>}
      {state.selfState === 'registering' && <Text>Removing face and hair on this phone…</Text>}
      {state.selfState === 'failed' && <Problem message="We couldn’t safely remove your face and hair from the new photo. Retake a full-body photo. An unmasked photo will not be sent."/>}
      {state.selfState === 'failed' && state.selfPhoto && <Text type="supporting">Your previous successfully registered photo is still saved. Finish registering a replacement before generating.</Text>}
      {state.selfState === 'ready' && state.selfPhoto && <Text type="supporting">Full-body · {dateTime(state.selfPhoto.updatedAt)}. Your original stays on this phone.</Text>}
      <Button label={state.selfState === 'failed' ? 'Retake' : state.selfPhoto ? 'Change' : 'Add your photo'} variant="secondary" isDisabled={busy} onClick={() => showSheet({title: state.selfPhoto ? 'Change your photo' : 'Add your photo', content: <SelfPhotoChooser/>})}/>
      {state.selfState === 'registering' && <Text type="supporting">Photo processing finishes on this phone even if you leave this screen. It does not start generation.</Text>}
    </Section>
    {pieces.loading ? <Loading/> : pieces.error ? <Problem message={pieces.error} retry={pieces.retry}/> : <>
      <Section title="Target · 1 shop piece">
        {target?.origin === 'shop' ? <PieceRow piece={target} jobs={pieces.data?.jobs ?? []} action={<Text type="supporting">Fixed target</Text>}/> : <Empty title={state.draft.targetPieceId ? 'Your target piece is no longer saved' : 'Choose a shop piece first'}><Text>Open a piece saved from a shop and tap Try it on. Wardrobe pieces can only be companions.</Text><Button label="Choose a saved shop piece" isDisabled={busy} onClick={() => push({name: 'home'})}/></Empty>}
      </Section>
      <Section title={`Wear with it · ${companionIds.length} of ${MAX_COMPANIONS}`}>
        {!companionIds.length && <Text>Optional. Mix in pieces from your wardrobe, saved pieces, or a trip photo.</Text>}
        {companionIds.map(id => {
          const piece = pieces.data?.pieces.find(value => value.id === id);
          const remove = <Action label={piece ? `Remove ${piece.label}` : 'Remove unavailable piece'} variant="ghost" disabled={busy} run={async () => {services.fitting.removeCompanion(id);}}/>;
          return piece ? <PieceRow key={id} piece={piece} jobs={pieces.data?.jobs ?? []} action={remove}/> : <HStack key={id} gap={3} wrap="wrap"><Text>This companion is no longer saved.</Text>{remove}</HStack>;
        })}
        {companionIds.length >= MAX_COMPANIONS && <Text type="supporting">Up to 5 companion pieces. Remove one to add another.</Text>}
        <Button label="Add a companion" variant="secondary" isDisabled={!target || busy || companionIds.length >= MAX_COMPANIONS} onClick={() => showSheet({title: 'Wear with it', content: <CompanionChooser/>})}/>
      </Section>
    </>}
    {generating(state) && <VStack role="status" aria-live="polite" gap={3}><Text type="label">{phases[state.phase]}</Text><Text type="supporting">Your original photo, face and hair stay on this phone.</Text><Button label="Cancel generation" variant="secondary" onClick={() => services.fitting.cancel()}/></VStack>}
    {state.phase === 'cancelled' && <Text type="supporting">{phases.cancelled}</Text>}
    {state.error && errorCode(state.error) !== 'cancelled' && state.selfState !== 'failed' && <Problem message={fittingError(state.error.code)}/>}
    <Action label="Generate" disabled={!ready} run={async () => {const result = await services.fitting.generate(); if (result && alive.current) popTo('outfit', {name: 'result', resultId: result.id});}}/>
    <Text type="supporting">One face-and-hair-removed photo, your target and up to 5 companion cut-outs are sent for generation.</Text>
  </>;
}

function DeleteResult({result}: {result: SavedResult}) {
  const {services, deleted, say} = useUi();
  return <Confirm title="Delete this look?" description="This removes the look and its saved snapshots from your try-ons. Your saved pieces stay." action="Delete look" onConfirm={async () => {await services.store.deleteResult({id: result.id}); deleted('Result', result.id); say('Look deleted');}}/>;
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
    <Section title="Your look"><Text>{snapshots.length} {snapshots.length === 1 ? 'piece' : 'pieces'} · {dateTime(result.createdAt)}</Text><PhotoView file={view.file} label={`Your generated look wearing ${view.target.label}`}/>{view.faceless && <Text>Your face couldn’t be put back cleanly, so this look is shown without it.</Text>}{targetDeleted && <Text>The target piece was deleted. Your look and walk-back location are still saved.</Text>}</Section>
    {links.error && <Problem message="Your look is available, but links to the original pieces could not be checked." retry={links.retry}/>}
    <Section title="Wearing">
      {snapshots.map((piece, index) => <HStack key={piece.pieceId} gap={4} wrap="wrap" vAlign="center"><Thumbnail src={fileUrl(piece.cutoutFile)} label={piece.label} alt={piece.label}/><VStack gap={2}><Text type="label">{piece.label}</Text><Text type="supporting">{index === 0 ? 'Target · ' : 'Companion · '}{piece.origin === 'wardrobe' ? 'Your wardrobe' : piece.shop ? `Shop ${piece.shop.n}` : 'Saved from a shop'}{links.data && !links.data.pieceIds.has(piece.pieceId) ? ' · Saved snapshot' : ''}</Text></VStack>{links.data?.pieceIds.has(piece.pieceId) && !links.loading && <Button label={`Open ${piece.label}`} variant="ghost" onClick={() => push({name: 'item', pieceId: piece.pieceId})}/>}</HStack>)}
    </Section>
    {result.targetSnapshot.shop && <Section title={`Shop ${result.targetSnapshot.shop.n}`}>
      {result.targetSnapshot.shop.storefrontFile && <PhotoView file={result.targetSnapshot.shop.storefrontFile} label={`Saved storefront of Shop ${result.targetSnapshot.shop.n}`}/>}
      {result.targetSnapshot.shop.description && <Text>{result.targetSnapshot.shop.description}</Text>}
      {result.targetSnapshot.shop.note && <Text>Note: {result.targetSnapshot.shop.note}</Text>}
      <Text type="supporting">Saved with this look · {dateTime(result.targetSnapshot.shop.startedAt)}</Text>
    </Section>}
    {!online && <Text type="supporting">This look is available offline. Connect to load walking directions or generate a changed combination.</Text>}
    <HStack gap={3} wrap="wrap"><Action label="Change pieces" variant="secondary" disabled={!canChange} run={async () => {if (!await services.fitting.canChangePieces(result)) {links.retry(); return;} await services.fitting.restoreResult(result); if (alive.current) {if (stack.some(entry => entry.name === 'outfit')) popTo('outfit'); else push({name: 'outfit'});}}}/><Button label={view.target.shop ? `Walk to Shop ${view.target.shop.n}` : 'Walk back to the photo spot'} variant="primary" isDisabled={!view.destination} onClick={() => push({name: 'walk', source: 'result', id: result.id})}/></HStack>
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
  return <Section title="Try-ons"><Text>{saved.length} {saved.length === 1 ? 'look' : 'looks'} · kept on this phone</Text>{!online && <Text type="supporting">Your saved looks can be opened and deleted offline.</Text>}{!saved.length ? <Empty title="No looks yet"><Text>Open something you saved and tap Try it on.</Text><Button label="Open saved pieces" onClick={() => push({name: 'home'})}/></Empty> : saved.map(result => <VStack key={result.id} gap={3}><HStack gap={4} wrap="wrap" vAlign="center"><Thumbnail src={fileUrl(result.file)} alt={`Look with ${result.targetSnapshot.label}`} label={`Open look with ${result.targetSnapshot.label}`} onClick={() => push({name: 'result', resultId: result.id})}/><VStack gap={2}><Text type="label">{result.targetSnapshot.label}</Text><Text type="supporting">{result.companionSnapshots.length + 1} pieces · {dateTime(result.createdAt)}</Text>{result.faceless && <Text type="supporting">Shown without your face</Text>}</VStack><Button label={`Open look from ${dateTime(result.createdAt)}`} variant="secondary" onClick={() => push({name: 'result', resultId: result.id})}/></HStack><DeleteResult result={result}/></VStack>)}</Section>;
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
  return <VStack gap={4}><Text>Lay it flat or hang it up. You’ll tap it to cut it out.</Text><Text type="supporting">Only your chosen cut-out is sent for a name and for try-on, never the whole wardrobe photo.</Text><Button label="Take a photo" variant="secondary" onClick={() => push({name: 'capture', purpose: 'wardrobe'})}/><Action label="Choose from gallery" variant="secondary" run={choose}/><Button label="Cancel" variant="ghost" onClick={() => showSheet(null)}/></VStack>;
}

export function Wardrobe() {
  const {services, push, showSheet, online} = useUi();
  const wardrobe = useData(async () => ({pieces: await listAll(services, 'Piece', {origin: 'wardrobe'}), jobs: await listAll(services, 'QueueJob')}), [services]);
  return <>
    <Section title="Wardrobe">
      <Text>{wardrobe.data?.pieces.length ?? 0} pieces you own</Text>
      {wardrobe.loading ? <Loading/> : wardrobe.error ? <Problem message={wardrobe.error} retry={wardrobe.retry}/> : !wardrobe.data?.pieces.length ? <Empty title="Your wardrobe is empty"><Text>Add a piece you own, then wear it with a saved shop piece.</Text></Empty> : wardrobe.data.pieces.map(piece => <PieceRow key={piece.id} piece={piece} jobs={wardrobe.data?.jobs ?? []} action={<Button label={`Open ${piece.label}`} variant="secondary" onClick={() => push({name: 'item', pieceId: piece.id})}/>}/>)}
      <Text type="supporting">Mix these with what you saved to see them together. Only the cut-out piece is ever sent, never the whole photo.</Text>
      {!online && <Text type="supporting">You can add, browse and delete pieces offline. Naming waits for a connection.</Text>}
      <Button label="Add a piece" variant="primary" onClick={() => showSheet({title: 'Add a piece', content: <AddWardrobePiece/>})}/>
    </Section>
  </>;
}
