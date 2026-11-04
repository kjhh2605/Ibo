// Garment categories for saved pieces and the try-on mannequin.
// `unknown` means "not classified yet" (naming pending or failed); `other` means
// Spark or the user said it is not a mannequin garment (shoes, bags, dresses...).
export const GARMENT_SLOTS = ['outer', 'top', 'bottom'] as const;
export type GarmentSlot = typeof GARMENT_SLOTS[number];
export const PIECE_CATEGORIES = [...GARMENT_SLOTS, 'other', 'unknown'] as const;
export type PieceCategory = typeof PIECE_CATEGORIES[number];

export const slotNames: Record<GarmentSlot, string> = {outer: 'Outer', top: 'Top', bottom: 'Bottom'};
export const categoryNames: Record<PieceCategory, string> = {...slotNames, other: 'Other', unknown: 'Not sorted'};
export const slotExamples: Record<GarmentSlot, string> = {
  outer: 'Jacket, coat or blazer',
  top: 'Shirt, T-shirt, sweater or hoodie',
  bottom: 'Trousers, jeans, skirt or shorts',
};

export function isGarmentSlot(value: unknown): value is GarmentSlot {
  return typeof value === 'string' && (GARMENT_SLOTS as readonly string[]).includes(value);
}
export function isPieceCategory(value: unknown): value is PieceCategory {
  return typeof value === 'string' && (PIECE_CATEGORIES as readonly string[]).includes(value);
}

// Pieces saved before categories were fixed carry Spark's free-form noun phrase.
// Outer words win so "shirt jacket" is an outer layer, not a top.
const legacy: [GarmentSlot, RegExp][] = [
  ['outer', /\b(outer\w*|jackets?|coats?|blazers?|parkas?|anoraks?|trench\w*|cardigans?|windbreakers?|vests?|gilets?|puffers?|bombers?)\b/],
  ['bottom', /\b(bottoms?|pants|trousers|jeans|denims?|skirts?|shorts|slacks|leggings|chinos|joggers|culottes)\b/],
  ['top', /\b(tops?|shirts?|t-shirts?|tees?|blouses?|sweaters?|jumpers?|hoodies?|sweatshirts?|knit\w*|polos?|tanks?|camis?|turtlenecks?|pullovers?)\b/],
];
/** The category a stored value means today; never throws on legacy free text. */
export function pieceCategory(value: string): PieceCategory {
  const text = value.trim().toLowerCase();
  if (isPieceCategory(text)) return text;
  if (!text) return 'unknown';
  return legacy.find(([, pattern]) => pattern.test(text))?.[0] ?? 'other';
}
/** The mannequin slot a piece can fill, or null when it must be sorted first. */
export function slotOf(piece: {category: string}): GarmentSlot | null {
  const category = pieceCategory(piece.category);
  return isGarmentSlot(category) ? category : null;
}

/** What the generated look shows for an empty slot (mirrors relay `outfit_prompt`). */
export function emptySlotRule(slot: GarmentSlot, filled: ReadonlySet<GarmentSlot>): string {
  if (slot !== 'outer') return slot === 'top' ? 'Empty: you keep your own top' : 'Empty: you keep your own bottoms';
  return filled.has('top') ? 'Empty: any jacket in your photo is taken off so your top shows' : 'Empty: your photo stays as it is';
}
