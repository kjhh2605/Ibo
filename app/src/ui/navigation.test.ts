import {describe,expect,it} from 'vitest';
import {deepLink,popRoute,pruneDeleted,pushRoute,returnTo} from './navigation';
import type {Route} from './navigation';

describe('home-rooted navigation',()=>{
  it('never pops the root and returns through the preceding screen',()=>{
    const home:Route[]=[{name:'home'}];
    const stack=pushRoute(pushRoute(home,{name:'trips'}),{name:'trip',tripId:'trip-1'});
    expect(popRoute(stack)).toEqual([{name:'home'},{name:'trips'}]);
    expect(popRoute(home)).toBe(home);
  });
  it('preserves the outfit entry on completed and cancelled trip-photo round trips',()=>{
    const stack:Route[]=[{name:'home'},{name:'item',pieceId:'target'},{name:'outfit'},{name:'trips',forOutfit:true},{name:'trip',tripId:'trip-1',forOutfit:true},{name:'pick',photoId:'photo-1',mode:'outfit'}];
    expect(returnTo(stack,'outfit')).toEqual(stack.slice(0,3));
    expect(popRoute(stack)).toEqual(stack.slice(0,-1));
  });
  it('routes native links without starting shopping or duplicating camera',()=>{
    const home:Route[]=[{name:'home'}];
    expect(deepLink(home,'streetfitting://capture?newShop=1',false)).toBe(home);
    const capture=deepLink(home,'streetfitting://capture?newShop=1',true);
    expect(capture).toEqual([...home,{name:'capture'}]);
    expect(deepLink(capture,'streetfitting://capture',true)).toBe(capture);
    expect(deepLink(capture,'streetfitting://home',true)).toEqual(home);
    expect(deepLink(home,'streetfitting://walk',true)).toBe(home);
  });
  it('prunes deleted source routes and their descendants but keeps result snapshots',()=>{
    const stack:Route[]=[{name:'home'},{name:'trips'},{name:'trip',tripId:'trip-1'},{name:'pick',photoId:'photo-1',mode:'shop'},{name:'item',pieceId:'piece-1'}];
    expect(pruneDeleted(stack,'Trip','trip-1')).toEqual(stack.slice(0,2));
    expect(pruneDeleted(stack,'Photo','photo-1')).toEqual(stack.slice(0,3));
    const results:Route[]=[{name:'home'},{name:'results'},{name:'result',resultId:'result-1'}];
    expect(pruneDeleted(results,'Piece','piece-1')).toBe(results);
    expect(pruneDeleted(results,'Result','result-1')).toEqual(results.slice(0,2));
  });
});
