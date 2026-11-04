// Fixed sample data. Nothing here comes from a model, a camera or GPS:
// the prototype only shows how the screens connect.

export type Box = [x: number, y: number, w: number, h: number] // percent of the photo

export type Candidate = { id: string; label: string; score: number; box: Box }

export type Photo = {
  id: string
  src: string
  w: number
  h: number
  shop: number
  time: string
  candidates: Candidate[]
}

export type Shop = {
  n: number
  name: string
  time: string
  storefront: { src: string; w: number; h: number }
  description: string
  distance: string
  walk: string
}

const p = (file: string) => `/photos/${file}`

export const SHOPS: Shop[] = [
  {
    n: 1,
    name: 'Shop 1',
    time: '1:42 PM',
    storefront: { src: p('i23.jpg'), w: 720, h: 480 },
    description: 'Two-tone corner house, small shop on the ground floor',
    distance: '650 m',
    walk: '9 min',
  },
  {
    n: 2,
    name: 'Shop 2',
    time: '2:14 PM',
    storefront: { src: p('i10.jpg'), w: 720, h: 540 },
    description: 'Outdoor stall, long rail of dresses under a white awning',
    distance: '410 m',
    walk: '6 min',
  },
  {
    n: 3,
    name: 'Shop 3',
    time: '2:51 PM',
    storefront: { src: p('i02.jpg'), w: 720, h: 540 },
    description: 'Warehouse rails, coats and knits on white racks',
    distance: '120 m',
    walk: '2 min',
  },
]

export const PHOTOS: Photo[] = [
  {
    id: 'rack', src: p('rack.jpg'), w: 1080, h: 810, shop: 1, time: '1:44 PM',
    candidates: [
      { id: 'red', label: 'Red shirt', score: 0.72, box: [27, 57, 9, 28] },
      { id: 'rail', label: 'Rail of shirts', score: 0.55, box: [16, 50, 66, 40] },
    ],
  },
  {
    id: 'i03', src: p('i03.jpg'), w: 720, h: 540, shop: 1, time: '1:47 PM',
    candidates: [
      { id: 'stripe', label: 'Striped shirt', score: 0.9, box: [5, 12, 45, 85] },
      { id: 'check', label: 'Check shirt', score: 0.84, box: [52, 12, 42, 85] },
    ],
  },
  {
    id: 'i04', src: p('i04.jpg'), w: 720, h: 540, shop: 1, time: '1:49 PM',
    candidates: [
      { id: 'lilac', label: 'Lilac striped shirt', score: 0.9, box: [2, 10, 46, 88] },
      { id: 'green', label: 'Green check shirt', score: 0.88, box: [48, 10, 48, 88] },
    ],
  },
  {
    id: 'i05', src: p('i05.jpg'), w: 551, h: 720, shop: 2, time: '2:16 PM',
    candidates: [
      { id: 'dress', label: 'Red dress', score: 0.95, box: [26, 18, 50, 70] },
      { id: 'skirt', label: 'Pleated skirt', score: 0.47, box: [24, 48, 54, 40] },
    ],
  },
  {
    id: 'i17', src: p('i17.jpg'), w: 650, h: 720, shop: 2, time: '2:18 PM',
    candidates: [
      { id: 'puffer', label: 'Blue puffer jacket', score: 0.94, box: [12, 8, 76, 87] },
      { id: 'hood', label: 'Hood', score: 0.38, box: [33, 8, 34, 22] },
      { id: 'sleeve', label: 'Sleeve', score: 0.21, box: [12, 35, 22, 55] },
    ],
  },
  {
    id: 'i20', src: p('i20.jpg'), w: 720, h: 720, shop: 2, time: '2:24 PM',
    candidates: [
      { id: 'zip', label: 'Blue zip jacket', score: 0.91, box: [22, 12, 48, 82] },
      { id: 'collar', label: 'Collar', score: 0.33, box: [38, 10, 22, 14] },
    ],
  },
  {
    id: 'i18', src: p('i18.jpg'), w: 540, h: 720, shop: 3, time: '2:53 PM',
    candidates: [
      { id: 'navy', label: 'Navy double-breasted jacket', score: 0.89, box: [5, 12, 88, 80] },
    ],
  },
  {
    id: 'i19', src: p('i19.jpg'), w: 720, h: 540, shop: 3, time: '3:02 PM',
    candidates: [
      { id: 'blazer', label: 'Gray blazer', score: 0.86, box: [48, 10, 38, 72] },
      { id: 'black', label: 'Black jacket', score: 0.81, box: [24, 8, 30, 74] },
    ],
  },
]

export const photo = (id: string) => PHOTOS.find((x) => x.id === id)!
export const shop = (n: number) => SHOPS.find((x) => x.n === n)!
export const photosOf = (n: number) => PHOTOS.filter((x) => x.shop === n)

/** Where the camera "sees" during shopping mode: the next photos it saves, in order. */
export const CAMERA_ROLL = ['rack', 'i03', 'i19']

/** The photo used when adding something to the wardrobe. */
export const WARDROBE_PHOTO: Photo = {
  id: 'w-i21', src: p('i21.jpg'), w: 482, h: 720, shop: 0, time: '',
  candidates: [{ id: 'work', label: 'Navy work jacket', score: 0.92, box: [14, 6, 72, 88] }],
}

export type Piece = { id: string; label: string; src: string; w: number; h: number; box: Box; from: 'shop' | 'wardrobe'; shop?: number; photoId?: string }

export const WARDROBE_START: Piece[] = [
  { id: 'w-jeans', label: 'Light wash jeans', src: p('i24.jpg'), w: 720, h: 480, box: [6, 4, 40, 92], from: 'wardrobe' },
  { id: 'w-flats', label: 'Navy flats', src: p('i25.jpg'), w: 720, h: 331, box: [52, 38, 46, 60], from: 'wardrobe' },
]

export const pieceFrom = (ph: Photo, c: Candidate): Piece => ({
  id: `${ph.id}:${c.id}`,
  label: c.label,
  src: ph.src,
  w: ph.w,
  h: ph.h,
  box: c.box,
  from: ph.shop ? 'shop' : 'wardrobe',
  shop: ph.shop || undefined,
  photoId: ph.id,
})

export const SAVED_START: Piece[] = [pieceFrom(photo('i05'), photo('i05').candidates[0])]

export const EXAMPLE_QUERIES = [
  'the blue puffer at the outdoor stall',
  'red dress from the second shop',
  'gray blazer about 20 min ago',
]

/** What the fake agent "finds" for a query: the shop it narrows to and the top photos. */
export function answer(q: string): { shop: number; photos: string[]; concept: string } {
  const s = q.toLowerCase()
  if (s.includes('dress') || s.includes('red')) return { shop: 2, photos: ['i05', 'i17', 'i20'], concept: 'red dress' }
  if (s.includes('blazer') || s.includes('gray') || s.includes('grey') || s.includes('warehouse')) return { shop: 3, photos: ['i19', 'i18'], concept: 'gray blazer' }
  if (s.includes('shirt') || s.includes('stripe')) return { shop: 1, photos: ['i03', 'i04', 'rack'], concept: 'striped shirt' }
  return { shop: 2, photos: ['i17', 'i20', 'i05'], concept: 'blue puffer jacket' }
}

export const ROUTE_STEPS = [
  { text: 'Head north on Jong-ro', dist: '80 m' },
  { text: 'Turn left at the subway exit 3', dist: '150 m' },
  { text: 'Turn right into the market lane', dist: '120 m' },
  { text: 'Shop 2 is on your left', dist: '60 m' },
]
