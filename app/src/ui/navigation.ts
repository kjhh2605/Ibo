import type {Asset, Candidate} from '../native/contracts';

export type Route =
  | {name: 'home' | 'ask' | 'results' | 'wardrobe' | 'privacy'}
  | {name: 'capture'; purpose?: 'shopping' | 'wardrobe' | 'self'}
  | {name: 'trips'; forOutfit?: boolean}
  | {name: 'trip'; tripId: string; shopId?: string; forOutfit?: boolean}
  | {name: 'pick'; photoId?: string; asset?: Asset; mode: 'shop' | 'wardrobe' | 'outfit'; candidates?: Candidate[]; concept?: string}
  | {name: 'item'; pieceId: string}
  | {name: 'outfit'}
  | {name: 'result'; resultId: string}
  | {name: 'walk'; source: 'item' | 'result'; id: string};
export const titles: Record<Route['name'], string> = {home: 'Street Fitting', capture: 'Camera', trips: 'All trips', trip: 'Trip', ask: 'Find it', pick: 'Pick an item', item: 'Saved piece', outfit: 'Try it on', result: 'Your try-on', results: 'Try-ons', walk: 'Walk there', wardrobe: 'Wardrobe', privacy: 'Privacy'};
export function pushRoute(stack: Route[], route: Route): Route[] {
  if (route.name === 'home') return [{name: 'home'}];
  if (route.name === 'capture' && stack.at(-1)?.name === 'capture') return stack;
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
  return index < 0 ? stack : stack.slice(0, Math.max(1, index));
}
export function deepLink(stack: Route[], url: string, recording: boolean): Route[] {
  if (url === 'streetfitting://home') return [{name: 'home'}];
  if (recording && (url === 'streetfitting://capture' || url === 'streetfitting://capture?newShop=1')) return pushRoute(stack, {name: 'capture'});
  return stack;
}
