// Fixed sample data. Nothing here comes from a model, a camera or GPS:
// the prototype only shows how the screens connect.

export type Box = [x: number, y: number, w: number, h: number] // percent of the photo

export type Candidate = { id: string; label: string; score: number; box: Box }

export type Img = { src: string; w: number; h: number }

export type Spot = { latitude: number; longitude: number }

/** One run of shopping mode. A new one starts every time shopping mode is turned on. */
export type Trip = {
  id: string
  date: string
  start: string
  end?: string
  recording: boolean
}

export type DescriptionState = 'none' | 'pending' | 'done' | 'failed'

export type Shop = {
  id: string
  trip: string
  /** Counts from 1 inside its trip. */
  n: number
  name: string
  time: string
  startedAt: number
  spot: Spot
  storefront?: Img
  description?: string
  descriptionState: DescriptionState
  note?: string
  distance: string
  walk: string
}

export type Photo = Img & {
  id: string
  trip: string
  shop: string
  time: string
  /** Where the photo was taken. A piece cut from it walks back here. */
  spot: Spot
  candidates: Candidate[]
}

/** What a piece keeps about its shop, so it can still be walked back to after the trip is deleted. */
export type Place = {
  shopName: string
  tripDate: string
  storefront?: Img
  description?: string
  note?: string
  distance: string
  walk: string
}

export type Piece = Img & {
  id: string
  label: string
  box: Box
  from: 'shop' | 'wardrobe'
  /** Cleared when the trip is deleted. */
  trip?: string
  /** Cleared when the trip is deleted. */
  shop?: string
  /** Cleared when the original photo is deleted. */
  photoId?: string
  /** Shop pieces only: where the photo was taken. Never changes, not even when the trip is deleted. */
  walkTo?: Spot
  /** Shop pieces only: the shop as it was when the piece was saved. */
  place?: Place
  /** The name Spark is still working out. Until it lands, `label` is the placeholder. */
  naming?: string
}

/** A generated look. It keeps copies of its pieces, so deleting a piece never breaks it. */
export type Result = {
  id: string
  target: Piece
  companions: Piece[]
  at: string
  /** The face check failed, so the look is shown without the face put back. */
  faceless: boolean
}

const p = (file: string) => `/photos/${file}`

export const TODAY = 'Wed, Nov 4'

/** Newest first. */
export const TRIPS: Trip[] = [
  { id: 'nov1', date: 'Sun, Nov 1', start: '1:42 PM', end: '3:20 PM', recording: false },
  { id: 'oct24', date: 'Sat, Oct 24', start: '11:05 AM', end: '11:50 AM', recording: false },
]

export const SHOPS: Shop[] = [
  {
    id: 'nov1-1',
    trip: 'nov1',
    n: 1,
    name: 'Shop 1',
    time: '1:42 PM',
    startedAt: new Date('2026-11-01T13:42:00').getTime(),
    spot: { latitude: 37.573, longitude: 127.016 },
    note: 'Cash only',
    storefront: { src: p('i23.jpg'), w: 720, h: 480 },
    description: 'Two-tone corner house, small shop on the ground floor',
    descriptionState: 'done',
    distance: '650 m',
    walk: '9 min',
  },
  {
    id: 'nov1-2',
    trip: 'nov1',
    n: 2,
    name: 'Shop 2',
    time: '2:14 PM',
    startedAt: new Date('2026-11-01T14:14:00').getTime(),
    spot: { latitude: 37.5735, longitude: 127.017 },
    storefront: { src: p('i10.jpg'), w: 720, h: 540 },
    description: 'Outdoor stall, long rail of dresses under a white awning',
    descriptionState: 'done',
    distance: '410 m',
    walk: '6 min',
  },
  {
    id: 'nov1-3',
    trip: 'nov1',
    n: 3,
    name: 'Shop 3',
    time: '2:51 PM',
    startedAt: new Date('2026-11-01T14:51:00').getTime(),
    spot: { latitude: 37.574, longitude: 127.018 },
    storefront: { src: p('i02.jpg'), w: 720, h: 540 },
    description: 'Warehouse rails, coats and knits on white racks',
    descriptionState: 'done',
    distance: '120 m',
    walk: '2 min',
  },
  {
    id: 'oct24-1',
    trip: 'oct24',
    n: 1,
    name: 'Shop 1',
    time: '11:05 AM',
    startedAt: new Date('2026-10-24T11:05:00').getTime(),
    spot: { latitude: 37.5712, longitude: 127.0094 },
    note: 'Weekend flea market',
    descriptionState: 'none',
    distance: '1.4 km',
    walk: '19 min',
  },
]

const near = (s: Spot, dLat: number, dLng: number): Spot => ({ latitude: s.latitude + dLat, longitude: s.longitude + dLng })
const spotOf = (shopId: string) => SHOPS.find((x) => x.id === shopId)!.spot

export const PHOTOS: Photo[] = [
  {
    id: 'rack', src: p('rack.jpg'), w: 1080, h: 810, trip: 'nov1', shop: 'nov1-1', time: '1:44 PM', spot: near(spotOf('nov1-1'), 0.00002, 0.00001),
    candidates: [
      { id: 'red', label: 'Red shirt', score: 0.72, box: [27, 57, 9, 28] },
      { id: 'rail', label: 'Rail of shirts', score: 0.55, box: [16, 50, 66, 40] },
    ],
  },
  {
    id: 'i03', src: p('i03.jpg'), w: 720, h: 540, trip: 'nov1', shop: 'nov1-1', time: '1:47 PM', spot: near(spotOf('nov1-1'), 0.00003, -0.00002),
    candidates: [
      { id: 'stripe', label: 'Striped shirt', score: 0.9, box: [5, 12, 45, 85] },
      { id: 'check', label: 'Check shirt', score: 0.84, box: [52, 12, 42, 85] },
    ],
  },
  {
    id: 'i04', src: p('i04.jpg'), w: 720, h: 540, trip: 'nov1', shop: 'nov1-1', time: '1:49 PM', spot: near(spotOf('nov1-1'), -0.00001, 0.00002),
    candidates: [
      { id: 'lilac', label: 'Lilac striped shirt', score: 0.9, box: [2, 10, 46, 88] },
      { id: 'green', label: 'Green check shirt', score: 0.88, box: [48, 10, 48, 88] },
    ],
  },
  {
    id: 'i05', src: p('i05.jpg'), w: 551, h: 720, trip: 'nov1', shop: 'nov1-2', time: '2:16 PM', spot: near(spotOf('nov1-2'), 0.00002, 0.00002),
    candidates: [
      { id: 'dress', label: 'Red dress', score: 0.95, box: [26, 18, 50, 70] },
      { id: 'skirt', label: 'Pleated skirt', score: 0.47, box: [24, 48, 54, 40] },
    ],
  },
  {
    id: 'i17', src: p('i17.jpg'), w: 650, h: 720, trip: 'nov1', shop: 'nov1-2', time: '2:18 PM', spot: near(spotOf('nov1-2'), -0.00002, 0.00001),
    candidates: [
      { id: 'puffer', label: 'Blue puffer jacket', score: 0.94, box: [12, 8, 76, 87] },
      { id: 'hood', label: 'Hood', score: 0.38, box: [33, 8, 34, 22] },
      { id: 'sleeve', label: 'Sleeve', score: 0.21, box: [12, 35, 22, 55] },
    ],
  },
  {
    id: 'i20', src: p('i20.jpg'), w: 720, h: 720, trip: 'nov1', shop: 'nov1-2', time: '2:24 PM', spot: near(spotOf('nov1-2'), 0.00001, -0.00003),
    candidates: [
      { id: 'zip', label: 'Blue zip jacket', score: 0.91, box: [22, 12, 48, 82] },
      { id: 'collar', label: 'Collar', score: 0.33, box: [38, 10, 22, 14] },
    ],
  },
  {
    id: 'i18', src: p('i18.jpg'), w: 540, h: 720, trip: 'nov1', shop: 'nov1-3', time: '2:53 PM', spot: near(spotOf('nov1-3'), 0.00002, 0.00002),
    candidates: [
      { id: 'navy', label: 'Navy double-breasted jacket', score: 0.89, box: [5, 12, 88, 80] },
    ],
  },
  {
    id: 'i19', src: p('i19.jpg'), w: 720, h: 540, trip: 'nov1', shop: 'nov1-3', time: '3:02 PM', spot: near(spotOf('nov1-3'), -0.00002, 0.00001),
    candidates: [
      { id: 'blazer', label: 'Gray blazer', score: 0.86, box: [48, 10, 38, 72] },
      { id: 'black', label: 'Black jacket', score: 0.81, box: [24, 8, 30, 74] },
    ],
  },
  {
    id: 'i10-rail', src: p('i10.jpg'), w: 720, h: 540, trip: 'oct24', shop: 'oct24-1', time: '11:12 AM', spot: near(spotOf('oct24-1'), 0.00001, 0.00002),
    candidates: [
      { id: 'polka', label: 'Polka dot dress', score: 0.88, box: [6, 12, 10, 50] },
      { id: 'cream', label: 'Cream knit dress', score: 0.83, box: [68, 12, 15, 86] },
      { id: 'coral', label: 'Coral dress', score: 0.64, box: [52, 8, 6, 84] },
    ],
  },
]

/** What the camera "sees" during shopping mode: the next photos it saves, in order. */
export const CAMERA_ROLL = ['rack', 'i03', 'i19']

/** The storefront the camera "sees" when the user takes a storefront photo. */
export const STOREFRONT_SAMPLE: Img = { src: p('i23.jpg'), w: 720, h: 480 }

/** What Spark "says" about a storefront photo taken in the prototype. */
export const STOREFRONT_DESCRIPTION = 'Two-tone house, clothes hung along the balcony'

/** The photo used when adding something to the wardrobe. */
export const WARDROBE_PHOTO: Img & { id: string; candidates: Candidate[] } = {
  id: 'w-i21', src: p('i21.jpg'), w: 482, h: 720,
  candidates: [{ id: 'work', label: 'Navy work jacket', score: 0.92, box: [14, 6, 72, 88] }],
}

export const WARDROBE_START: Piece[] = [
  { id: 'w-jeans', label: 'Light wash jeans', src: p('i24.jpg'), w: 720, h: 480, box: [6, 4, 40, 92], from: 'wardrobe' },
  { id: 'w-flats', label: 'Navy flats', src: p('i25.jpg'), w: 720, h: 331, box: [52, 38, 46, 60], from: 'wardrobe' },
]

/** Placeholder name for a piece Spark has not named yet. */
export const PICKED_ITEM = 'Picked item'

export const placeOf = (s: Shop, t: Trip): Place => ({
  shopName: s.name,
  tripDate: t.date,
  storefront: s.storefront,
  description: s.description,
  note: s.note,
  distance: s.distance,
  walk: s.walk,
})

/**
 * A piece cut from a shop photo. `named` is false for a tap cut-out: it has no
 * concept from the query, so Spark names it later and it shows "Picked item" until then.
 */
export const pieceFrom = (ph: Photo, c: Candidate, s: Shop, t: Trip, named = true): Piece => ({
  id: `${ph.id}:${c.id}`,
  label: named ? c.label : PICKED_ITEM,
  naming: named ? undefined : c.label,
  src: ph.src,
  w: ph.w,
  h: ph.h,
  box: c.box,
  from: 'shop',
  trip: ph.trip,
  shop: ph.shop,
  photoId: ph.id,
  walkTo: ph.spot,
  place: placeOf(s, t),
})

const seedPiece = (photoId: string, candidateId: string) => {
  const ph = PHOTOS.find((x) => x.id === photoId)!
  const s = SHOPS.find((x) => x.id === ph.shop)!
  const t = TRIPS.find((x) => x.id === ph.trip)!
  return pieceFrom(ph, ph.candidates.find((c) => c.id === candidateId)!, s, t)
}

export const SAVED_START: Piece[] = [seedPiece('i05', 'dress')]

export const EXAMPLE_QUERIES = [
  'the blue puffer at the outdoor stall',
  'red dress from the second shop',
  'gray blazer about 20 min ago',
]

/** What the fake agent "finds" for a query: the shop it narrows to and the top photos. */
export function answer(q: string): { shop: string; photos: string[]; concept: string } | null {
  const s = q.toLowerCase()
  if (s.includes('dress') || s.includes('red')) return { shop: 'nov1-2', photos: ['i05', 'i17', 'i20', 'i10-rail'], concept: 'red dress' }
  if (s.includes('blazer') || s.includes('gray') || s.includes('grey') || s.includes('warehouse')) return { shop: 'nov1-3', photos: ['i19', 'i18'], concept: 'gray blazer' }
  if (s.includes('shirt') || s.includes('stripe')) return { shop: 'nov1-1', photos: ['i03', 'i04', 'rack'], concept: 'striped shirt' }
  if (['blue', 'puffer', 'jacket', 'stall', 'tarp'].some((word) => s.includes(word))) return { shop: 'nov1-2', photos: ['i17', 'i20', 'i05'], concept: 'blue puffer jacket' }
  return null
}

export const ROUTE_STEPS = [
  { text: 'Head north on Jong-ro', dist: '80 m' },
  { text: 'Turn left at the subway exit 3', dist: '150 m' },
  { text: 'Turn right into the market lane', dist: '120 m' },
  { text: 'Continue toward your photo spot', dist: '60 m' },
]
