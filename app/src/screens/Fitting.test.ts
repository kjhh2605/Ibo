import {describe, expect, it} from 'vitest';
import type {Result} from '../native/contracts';
import {resultViewPolicy, slotChoice} from './Fitting';

const result: Result = {
  id: 'look-1',
  targetPieceId: 'target',
  companionPieceIds: ['companion'],
  targetSnapshot: {
    pieceId: 'target', origin: 'shop', label: 'Saved red jacket', category: 'outer',
    cutoutFile: 'file:///results/look-1/target.png', walkTo: {lat: 37.57, lng: 126.99},
    shop: {n: 2, startedAt: 1000, storefrontFile: 'file:///results/look-1/storefront.jpg', description: 'A striped awning.', note: 'Second stall.'},
  },
  companionSnapshots: [{
    pieceId: 'companion', origin: 'shop', label: 'Saved blue trousers', category: 'bottom',
    cutoutFile: 'file:///results/look-1/companion.png', walkTo: {lat: 35.1, lng: 129.1},
    shop: {n: 9, startedAt: 2000, storefrontFile: null, description: null, note: null},
  }],
  file: 'file:///results/look-1/display.png',
  providerFile: 'file:///results/look-1/provider.png',
  faceless: false,
  createdAt: 3000,
};

describe('result snapshot presentation and actions', () => {
  it('keeps the look, names, cut-outs, shops and every shop destination after every original piece is deleted', () => {
    const view = resultViewPolicy(result, new Set(), false);
    expect(view.file).toBe(result.file);
    expect(view.title).toBe('Saved red jacket, Saved blue trousers');
    expect(view.pieces.map(piece => [piece.label, piece.cutoutFile])).toEqual([
      ['Saved red jacket', 'file:///results/look-1/target.png'],
      ['Saved blue trousers', 'file:///results/look-1/companion.png'],
    ]);
    expect(view.destinations.map(piece => [piece.pieceId, piece.walkTo])).toEqual([
      ['target', {lat: 37.57, lng: 126.99}], ['companion', {lat: 35.1, lng: 129.1}],
    ]);
    expect(view.canChangePieces).toBe(false);
  });

  it('offers one walk-back per shop, to the first piece from it', () => {
    const sameShop: Result = {...result, companionSnapshots: [{...result.companionSnapshots[0], shop: result.targetSnapshot.shop}]};
    expect(resultViewPolicy(sameShop, null, false).destinations.map(piece => piece.pieceId)).toEqual(['target']);
  });

  it('never offers wardrobe pieces or spot-less shop pieces as walk destinations', () => {
    const wardrobe: Result = {...result, companionSnapshots: [{...result.companionSnapshots[0], origin: 'wardrobe', walkTo: null, shop: null}], targetSnapshot: {...result.targetSnapshot, walkTo: null}};
    expect(resultViewPolicy(wardrobe, null, false).destinations).toEqual([]);
  });

  it('allows changing pieces when the owner allows it and any piece of the look still exists', () => {
    expect(resultViewPolicy(result, new Set(['target']), true).canChangePieces).toBe(true);
    expect(resultViewPolicy(result, new Set(['companion']), true).canChangePieces).toBe(true);
    expect(resultViewPolicy(result, new Set(['target']), false).canChangePieces).toBe(false);
    expect(resultViewPolicy(result, new Set(), true).canChangePieces).toBe(false);
    expect(resultViewPolicy(result, null, true).canChangePieces).toBe(false);
  });

  it('gates export by the feature flag, independently of original-piece deletion', () => {
    expect(resultViewPolicy(result, new Set(['target']), true, false).canDownload).toBe(false);
    expect(resultViewPolicy(result, new Set(), false, false).canDownload).toBe(false);
    expect(resultViewPolicy(result, new Set(), false, true).canDownload).toBe(true);
  });
});

describe('mannequin slot choices', () => {
  it('lists a piece under its own slot only, and offers unsorted pieces for sorting', () => {
    const outfit = {top: 'shirt'};
    expect(slotChoice(outfit, 'top', {id: 'shirt', category: 'top'})).toBe('wearing');
    expect(slotChoice(outfit, 'top', {id: 'tee', category: 'top'})).toBe('fits');
    expect(slotChoice(outfit, 'top', {id: 'coat', category: 'outer'})).toBe('other_slot');
    expect(slotChoice(outfit, 'outer', {id: 'legacy', category: 'denim jacket'})).toBe('fits');
    expect(slotChoice(outfit, 'bottom', {id: 'new', category: 'unknown'})).toBe('unsorted');
    expect(slotChoice(outfit, 'bottom', {id: 'shoes', category: 'other'})).toBe('unsorted');
  });
});
