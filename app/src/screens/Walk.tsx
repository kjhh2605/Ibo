import {useEffect, useRef, useState} from 'react';
import type {Listener, ResultPieceSnapshot} from '../native/contracts';
import type {Route} from '../ui/navigation';
import type {MapView, WalkState} from '../ui/services';
import {useData, useUi} from '../ui/state';
import {Action, Button, Empty, HStack, Loading, PhotoView, Problem, Section, Text, VStack} from '../ui/components';

// Map is a shared owner service. Finish a pending mount before unmounting it,
// including when a screen is left and immediately opened again.
const mapOperations = new WeakMap<MapView, Promise<void>>();
function updateMapOwner(map: MapView, operation: () => Promise<void>) {
  const next = (mapOperations.get(map) ?? Promise.resolve()).then(operation);
  mapOperations.set(map, next.catch(() => {}));
  return next;
}
function walkError(code: string) {
  switch (code) {
    case 'offline': return 'The walking route can’t load while you’re offline. Your saved destination is still here. Connect, then try again.';
    case 'location_permission_denied': return 'Walking directions need your current location. Allow location access in your device settings, then try again.';
    case 'location_unavailable': return 'Your current location is unavailable. No turn, direction or distance can be calculated yet. Try again where location is available.';
    case 'destination_unavailable': return 'There is no saved photo location for this item. Walking guidance cannot start.';
    case 'route_unavailable': return 'No walking route is available for this photo spot. If your current location is available, use the straight-line direction instead.';
    case 'upstream_timeout': return 'The walking route took too long to load. Your saved destination has not changed. Try again.';
    case 'map_unavailable': return 'The map could not load. Your saved destination and any available text directions are still here.';
    default: return 'Walking guidance could not load. Your saved destination has not changed. Try again.';
  }
}
function distance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}
const compass = [
  {arrow: '↑', name: 'North'}, {arrow: '↗', name: 'Northeast'},
  {arrow: '→', name: 'East'}, {arrow: '↘', name: 'Southeast'},
  {arrow: '↓', name: 'South'}, {arrow: '↙', name: 'Southwest'},
  {arrow: '←', name: 'West'}, {arrow: '↖', name: 'Northwest'},
];
type Destination = Pick<ResultPieceSnapshot, 'label' | 'walkTo' | 'shop'>;

export function Walk({route}: {route: Extract<Route, {name: 'walk'}>}) {
  const {services, back, online} = useUi();
  const sourceKey = `${route.source}:${route.id}`;
  const source = useData<{key: string; destination: Destination} | null>(async () => {
    if (route.source === 'result') {
      const result = await services.store.get({entity: 'Result', id: route.id});
      return result ? {key: sourceKey, destination: result.targetSnapshot} : null;
    }
    const piece = await services.store.get({entity: 'Piece', id: route.id});
    if (!piece || piece.origin !== 'shop') return null;
    const shop = piece.shopId ? await services.store.get({entity: 'Shop', id: piece.shopId}) : null;
    const storefront = shop?.storefrontPhotoId ? await services.store.get({entity: 'Photo', id: shop.storefrontPhotoId}) : null;
    return {key: sourceKey, destination: {label: piece.label, walkTo: piece.walkTo, shop: shop ? {n: shop.n, startedAt: shop.startedAt, storefrontFile: storefront?.file ?? null, description: shop.description, note: shop.note} : null}};
  }, [services, route.source, route.id]);
  const destination = source.data?.key === sourceKey ? source.data.destination : null;
  const hasDestination = !!destination?.walkTo;
  const [walking, setWalking] = useState<{key: string; state: WalkState | null; error: string | null}>({key: sourceKey, state: null, error: null});
  const [walkAttempt, setWalkAttempt] = useState(0);
  const state = walking.key === sourceKey ? walking.state : null;
  const startError = walking.key === sourceKey ? walking.error : null;
  const host = useRef<HTMLElement>(null);
  const [mapAttempt, setMapAttempt] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  useEffect(() => {
    if (!hasDestination) return;
    let live = true;
    let listener: Listener | null = null;
    let started = false;
    setWalking({key: sourceKey, state: null, error: null});
    void (async () => {
      try {
        const handle = await services.walk.addListener('state', next => {if (live) setWalking({key: sourceKey, state: next, error: null});});
        if (!live) {await handle.remove(); return;}
        listener = handle;
        started = true;
        const next = await services.walk.start(route.source === 'item' ? {source: 'item', pieceId: route.id} : {source: 'result', resultId: route.id});
        if (live) setWalking({key: sourceKey, state: next, error: null});
      } catch (cause) {
        if (!live) return;
        const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : 'route_unavailable';
        if (code !== 'cancelled') setWalking({key: sourceKey, state: null, error: code});
      }
    })();
    return () => {
      live = false;
      if (listener) void listener.remove().catch(() => {});
      if (started) void services.walk.stop().catch(() => {});
    };
  }, [services.walk, hasDestination, sourceKey, route.source, route.id, walkAttempt]);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let live = true;
    let listener: Listener | null = null;
    setMapReady(false);
    setMapError(false);
    void services.map.addListener('error', () => {if (live) setMapError(true);}).then(async handle => {
      if (live) listener = handle;
      else await handle.remove();
    }).catch(() => {if (live) setMapError(true);});
    void updateMapOwner(services.map, async () => {
      if (!live) return;
      await services.map.mount({element});
      if (live) setMapReady(true);
    }).catch(() => {if (live) setMapError(true);});
    return () => {
      live = false;
      if (listener) void listener.remove().catch(() => {});
      void updateMapOwner(services.map, () => services.map.unmount()).catch(() => {});
    };
  }, [services.map, mapAttempt]);

  useEffect(() => {
    if (!mapReady || !state) return;
    let live = true;
    void updateMapOwner(services.map, async () => {
      if (!live) return;
      await services.map.update({fix: state.fix, destination: state.destination, route: state.route, progressM: state.progressM});
    }).catch(() => {if (live) setMapError(true);});
    return () => {live = false;};
  }, [services.map, mapReady, state]);

  const mode = !online && state?.mode !== 'arrived' ? 'offline' : state?.mode;
  const info = state?.destinationInfo ?? destination;
  const shop = info?.shop;
  const shopName = shop ? `Shop ${shop.n}` : 'Saved photo spot';
  const pin = state?.destination ?? destination?.walkTo;
  const step = state?.stepIndex !== null && state?.stepIndex !== undefined ? state.route?.steps[state.stepIndex] : null;
  const modifier = step?.maneuver.modifier?.replaceAll('_', ' ');
  const maneuver = step?.maneuver.type.replaceAll('_', ' ');
  const instruction = step ? `${maneuver === 'depart' ? 'Start walking' : maneuver === 'arrive' ? 'Continue to the end of the walking route' : maneuver === 'turn' ? `Turn${modifier ? ` ${modifier}` : ''}` : `${maneuver ? maneuver.charAt(0).toUpperCase() + maneuver.slice(1) : 'Continue'}${modifier ? ` ${modifier}` : ''}`}${step.name ? ` · ${step.name}` : ''}` : null;
  const direction = state?.bearingDeg !== null && state?.bearingDeg !== undefined ? compass[Math.round(((state.bearingDeg % 360) + 360) / 45) % compass.length] : null;
  const retryWalk = async () => {
    if (state) await services.walk.retry();
    else setWalkAttempt(value => value + 1);
  };
  return <>
    <Section title={info?.label ?? 'Walk back'}>
      <Text>{shopName}{shop ? ` · ${new Date(shop.startedAt).toLocaleString('en-US', {dateStyle: 'medium', timeStyle: 'short'})}` : ''}</Text>
      {pin && <Text type="supporting">Photo spot · {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)} · Fixed pin</Text>}
      <Text type="supporting">Walking guidance stays in the app. The destination is where the target item was photographed.</Text>
    </Section>
    <VStack ref={host} as="section" role="region" aria-label="Walking map" width="100%" height="50dvh" minHeight="var(--spacing-10)"/>
    <HStack gap={2} wrap="wrap"><Text type="supporting">Map attribution:</Text><Button label="OpenFreeMap" href="https://openfreemap.org/" variant="ghost" size="sm"/><Button label="© OpenStreetMap contributors" href="https://www.openstreetmap.org/copyright" variant="ghost" size="sm"/><Text type="supporting">Walking routes: FOSSGIS OSRM</Text></HStack>
    {mapError && <Problem message={walkError('map_unavailable')} retry={() => setMapAttempt(value => value + 1)}/>}
    {source.loading ? <Loading/> : source.error ? <Problem message={source.error} retry={source.retry}/> : !hasDestination ? <Empty title="No saved photo location"><Text>Walking guidance needs the location where this item was photographed. A shop pin or companion piece cannot replace it.</Text><Button label="Back" onClick={back}/></Empty> : <>
      {startError && <Problem message={walkError(startError)} retry={() => setWalkAttempt(value => value + 1)}/>}
      {!startError && (!state || mode === 'loading') && online && <VStack role="status" aria-live="polite" gap={3}><Text>Loading your current location and walking route…</Text></VStack>}
      {mode === 'offline' && <VStack gap={3}><Problem message={walkError('offline')}/><Text type="supporting">Any previously loaded route or distance is for reference only, not live guidance.</Text><Action label="Try again" variant="secondary" disabled={!online} run={retryWalk}/></VStack>}
      {mode === 'error' && <VStack gap={3}><Problem message={walkError(state?.errorCode ?? 'route_unavailable')}/><Action label="Try again" variant="secondary" run={retryWalk}/></VStack>}
      {mode === 'route' && state && <Section title="Walking directions">
        {state.rerouting ? <Text>Off route. Finding a new way…</Text> : instruction ? <HStack gap={3} wrap="wrap"><Text type="large">{modifier?.includes('uturn') ? '↶' : modifier?.includes('left') ? '↰' : modifier?.includes('right') ? '↱' : '↑'}</Text><VStack gap={2}>{state.stepDistanceM !== null && <Text type="label">In {distance(state.stepDistanceM)}</Text>}<Text>{instruction}</Text></VStack></HStack> : <Text>Waiting for the next walking instruction.</Text>}
        {(state.distanceM !== null || state.durationS !== null) && <Text>{state.distanceM !== null ? distance(state.distanceM) : ''}{state.distanceM !== null && state.durationS !== null ? ' · ' : ''}{state.durationS !== null ? `${Math.ceil(state.durationS / 60)} min` : ''} remaining</Text>}
      </Section>}
      {(mode === 'direction' || mode === 'nearby') && state && <Section title={mode === 'nearby' ? 'Check the surroundings' : 'Final segment'}>
        {direction && <Text type="large">{direction.arrow} {direction.name}</Text>}
        {state.distanceM !== null && <Text type="label">{distance(state.distanceM)} · straight-line distance to the photo spot</Text>}
        {state.bearingDeg !== null && <Text type="supporting">{Math.round(state.bearingDeg)}° from north · the arrow is relative to north, not the direction you are facing.</Text>}
        {state.errorCode === 'route_unavailable' && <Text>No walking route is available here. This is a straight-line direction, not a path through buildings or stalls.</Text>}
        {mode === 'direction' && <Action label="Retry walking route" variant="secondary" run={retryWalk}/>}
        <Text>{shop?.storefrontFile ? 'Look for this shop front. Stalls here sit close together, so trust the photo over the pin.' : 'No storefront photo is saved. Check the note, nearby signs and the shaded photo-spot area; the pin alone does not confirm the shop.'}</Text>
      </Section>}
      {mode === 'arrived' && <Section title={`You confirmed ${shopName}`}><Text>{shop?.storefrontFile ? 'You confirmed the shop using the storefront and your surroundings.' : 'You confirmed the shop using your surroundings. The photo spot stays fixed.'}</Text><Button label="Done" variant="primary" onClick={back}/></Section>}
      {shop?.storefrontFile ? <PhotoView file={shop.storefrontFile} label={`Storefront of ${shopName}`}/> : <Text type="supporting">No storefront photo</Text>}
      {shop?.description && <Text>{shop.description}</Text>}
      {shop?.note && <Text>Note: {shop.note}</Text>}
      {!shop?.storefrontFile && !shop?.description && !shop?.note && <Text type="supporting">No note or storefront description was saved. Use the photo spot and nearby signs to identify the shop.</Text>}
      {mode === 'nearby' && <Action label="I found this shop" run={() => services.walk.confirmArrival()}/>}
      {mode !== 'arrived' && <Button label="End" variant="secondary" onClick={back}/>}
    </>}
  </>;
}
