import {describe, expect, it} from 'vitest';
import type {Result} from '../native/contracts';
import {companionEligibility, resultViewPolicy} from './Fitting';

const result: Result = {
  id: 'look-1',
  targetPieceId: 'target',
  companionPieceIds: ['companion'],
  targetSnapshot: {
    pieceId: 'target', origin: 'shop', label: 'Saved red jacket', category: 'jacket',
    cutoutFile: 'file:///results/look-1/target.png', walkTo: {lat: 37.57, lng: 126.99},
    shop: {n: 2, startedAt: 1000, storefrontFile: 'file:///results/look-1/storefront.jpg', description: 'A striped awning.', note: 'Second stall.'},
  },
  companionSnapshots: [{
    pieceId: 'companion', origin: 'shop', label: 'Saved blue trousers', category: 'trousers',
    cutoutFile: 'file:///results/look-1/companion.png', walkTo: {lat: 35.1, lng: 129.1},
    shop: {n: 9, startedAt: 2000, storefrontFile: null, description: null, note: null},
  }],
  file: 'file:///results/look-1/display.png',
  providerFile: 'file:///results/look-1/provider.png',
  faceless: false,
  createdAt: 3000,
};

describe('result snapshot presentation and actions', () => {
  it('keeps the look, names, cut-outs, shop and target destination after every original piece is deleted', () => {
    const view = resultViewPolicy(result, new Set(), false);
    expect(view.file).toBe(result.file);
    expect(view.pieces.map(piece => [piece.label, piece.cutoutFile])).toEqual([
      ['Saved red jacket', 'file:///results/look-1/target.png'],
      ['Saved blue trousers', 'file:///results/look-1/companion.png'],
    ]);
    expect(view.target.shop).toEqual(result.targetSnapshot.shop);
    expect(view.destination).toEqual({lat: 37.57, lng: 126.99});
    expect(view.destination).not.toEqual(result.companionSnapshots[0].walkTo);
    expect(view.canChangePieces).toBe(false);
  });

  it('restores change-pieces eligibility only when both the owner and the live target allow it', () => {
    expect(resultViewPolicy(result, new Set(['target']), true).canChangePieces).toBe(true);
    expect(resultViewPolicy(result, new Set(['target']), false).canChangePieces).toBe(false);
    expect(resultViewPolicy(result, new Set(['companion']), true).canChangePieces).toBe(false);
    expect(resultViewPolicy(result, null, true).canChangePieces).toBe(false);
  });


  it('gates export by the feature flag, independently of original-piece deletion', () => {
    expect(resultViewPolicy(result, new Set(['target']), true, false).canDownload).toBe(false);
    expect(resultViewPolicy(result, new Set(), false, false).canDownload).toBe(false);
    expect(resultViewPolicy(result, new Set(), false, true).canDownload).toBe(true);
  });
});

describe('fixed target and companion eligibility', () => {
  it('does not allow companions before a shop target has been selected', () => {
    expect(companionEligibility({targetPieceId: null, companionPieceIds: []}, 'wardrobe-piece')).toBe('no_target');
    expect(companionEligibility({targetPieceId: null, companionPieceIds: []}, 'shop-piece')).toBe('no_target');
  });

  it.each([0, 1, 4])('allows another companion with %i already selected', count => {
    const draft = {targetPieceId: 'target', companionPieceIds: Array.from({length: count}, (_, index) => `piece-${index}`)};
    expect(companionEligibility(draft, 'another-piece')).toBe('available');
    expect(companionEligibility(draft, 'target')).toBe('target');
  });

  it.each([5, 6])('blocks an additional companion when %i are selected without replacing any', count => {
    const ids = Object.freeze(Array.from({length: count}, (_, index) => `piece-${index}`));
    const draft = Object.freeze({targetPieceId: 'target', companionPieceIds: ids});
    expect(companionEligibility(draft, 'another-piece')).toBe('limit');
    expect(draft.companionPieceIds).toEqual(ids);
    expect(companionEligibility(draft, 'piece-0')).toBe('selected');
    expect(companionEligibility(draft, 'target')).toBe('target');
  });

  it('recognizes an existing companion instead of adding it twice', () => {
    expect(companionEligibility({targetPieceId: 'target', companionPieceIds: ['wardrobe-piece']}, 'wardrobe-piece')).toBe('selected');
  });
});
