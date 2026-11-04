import {describe, expect, it} from 'vitest';
import {emptySlotRule, pieceCategory, slotOf} from './category';

describe('piece categories', () => {
  it.each([
    ['outer', 'outer'], ['top', 'top'], ['bottom', 'bottom'], ['other', 'other'], ['unknown', 'unknown'], ['', 'unknown'],
    ['Denim jacket', 'outer'], ['shirt jacket', 'outer'], ['trench coat', 'outer'], ['outerwear', 'outer'],
    ['T-shirt', 'top'], ['knit sweater', 'top'], ['hoodie', 'top'],
    ['pants', 'bottom'], ['wide jeans', 'bottom'], ['pleated skirt', 'bottom'],
    ['sneakers', 'other'], ['tote bag', 'other'],
  ])('reads stored %j as %s', (stored, expected) => {
    expect(pieceCategory(stored)).toBe(expected);
  });
  it('fills a slot only with outer, top or bottom', () => {
    expect(slotOf({category: 'jacket'})).toBe('outer');
    expect(slotOf({category: 'other'})).toBeNull();
    expect(slotOf({category: 'unknown'})).toBeNull();
  });
  it('explains empty slots the way the relay prompt renders them', () => {
    expect(emptySlotRule('top', new Set())).toMatch(/keep your own top/);
    expect(emptySlotRule('bottom', new Set(['top']))).toMatch(/keep your own bottoms/);
    expect(emptySlotRule('outer', new Set(['top']))).toMatch(/taken off/);
    expect(emptySlotRule('outer', new Set(['bottom']))).toMatch(/stays as it is/);
  });
});
