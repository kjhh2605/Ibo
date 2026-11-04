import type {Asset, Candidate} from '../native/contracts';

export type Route =
  | {name: 'home' | 'ask' | 'results' | 'wardrobe' | 'privacy'}
  | ({name: 'capture'} & ({purpose?: 'shopping' | 'wardrobe' | 'self'; shopId?: never} | {purpose: 'storefront'; shopId: string}))
  | {name: 'trips'; forOutfit?: boolean}
  | {name: 'trip'; tripId: string; shopId?: string; forOutfit?: boolean}
  | {name: 'pick'; photoId?: string; asset?: Asset; mode: 'shop' | 'wardrobe' | 'outfit'; candidates?: Candidate[]; concept?: string}
  | {name: 'item'; pieceId: string}
  | {name: 'outfit'}
  | {name: 'result'; resultId: string}
  | {name: 'walk'; source: 'item' | 'result'; id: string};
export const titles: Record<Route['name'], string> = {home: 'Street Fitting', capture: 'Camera', trips: 'All trips', trip: 'Trip', ask: 'Find it', pick: 'Pick the item', item: 'Item', outfit: 'Try on', result: 'Your look', results: 'Try-ons', walk: 'Walk back', wardrobe: 'Wardrobe', privacy: 'Privacy'};
export function pushRoute(stack: Route[], route: Route): Route[] {
  if (route.name === 'home') return [{name: 'home'}];
  if (route.name === 'capture' && stack.at(-1)?.name === 'capture') {
    const current = stack.at(-1) as Extract<Route, {name: 'capture'}>;
    return (current.purpose ?? 'shopping') === (route.purpose ?? 'shopping') && current.shopId === route.shopId ? stack : [...stack.slice(0, -1), route];
  }
  return [...stack, route];
}
export function popRoute(stack: Route[]): Route[] { return stack.length > 1 ? stack.slice(0, -1) : stack; }
export function returnTo(stack: Route[], name: Route['name'], next?: Route): Route[] {
  const index = stack.findLastIndex(route => route.name === name);
  const base = index < 0 ? [{name: 'home'} as Route] : stack.slice(0, index + 1);
  return next ? pushRoute(base, next) : base;
}
export function pruneDeleted(stack: Route[], entity: 'Trip' | 'Photo' | 'Piece' | 'Result', id: string): Route[] {
  const index = stack.findIndex(route => (entity === 'Trip' && route.name === 'trip' && route.tripId === id) || (entity === 'Photo' && route.name === 'pick' && route.photoId === id) || (entity === 'Piece' && route.name === 'item' && route.pieceId === id) || (entity === 'Result' && route.name === 'result' && route.resultId === id));
  if (index < 0) return stack;
  if (entity === 'Result') {
    const history = stack.findLastIndex((route, at) => at < index && route.name === 'results');
    return history < 0 ? [{name: 'home'}, {name: 'results'}] : stack.slice(0, history + 1);
  }
  return stack.slice(0, Math.max(1, index));
}
export function deepLink(stack: Route[], url: string, recording: boolean): Route[] {
  if (url === 'streetfitting://home') return [{name: 'home'}];
  if (recording && (url === 'streetfitting://capture' || url === 'streetfitting://capture?newShop=1')) return pushRoute(stack, {name: 'capture'});
  return stack;
}
