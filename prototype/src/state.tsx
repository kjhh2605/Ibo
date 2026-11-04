import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CAMERA_ROLL, PHOTOS, SAVED_START, SHOPS, STOREFRONT_DESCRIPTION, STOREFRONT_SAMPLE, TODAY, TRIPS, WARDROBE_START, pieceFrom,
  type Candidate, type Photo, type Piece, type Result, type Shop, type Trip,
} from './data'

// ---------------------------------------------------------------------------
// Navigation: one stack, pushed from the home screen. No tabs.

export type Route =
  | { name: 'home' }
  | { name: 'capture' }
  /** `forOutfit`: picking a companion piece for the try-on, not browsing. */
  | { name: 'trips'; forOutfit?: boolean }
  /** `shopId`: scroll to that shop inside the trip. */
  | { name: 'trip'; tripId: string; shopId?: string; forOutfit?: boolean }
  | { name: 'ask'; query?: string }
  /** `outfit`: cut a companion piece straight from a trip photo, save it and return to the try-on. */
  | { name: 'pick'; photoId: string; mode: 'shop' | 'wardrobe' | 'outfit'; concept?: string }
  | { name: 'item'; pieceId: string }
  | { name: 'outfit'; seed?: string }
  | { name: 'result'; resultId: string }
  | { name: 'results' }
  /** Walk to where a saved piece was photographed, or to a result's target piece (its snapshot). */
  | { name: 'walk'; pieceId?: string; resultId?: string }
  | { name: 'wardrobe' }
  | { name: 'privacy' }

export type Entry = Route & { key: number }

type Nav = {
  stack: Entry[]
  leaving: Entry | null
  push: (r: Route) => void
  pop: () => void
  /** Pop back to the first entry with this name, then push `then` if given. */
  popTo: (name: Route['name'], then?: Route) => void
}

const NavContext = createContext<Nav | null>(null)
export const useNav = () => useContext(NavContext)!

export const TITLES: Record<Route['name'], string> = {
  home: 'Home',
  capture: 'Camera',
  trips: 'All trips',
  trip: 'Trip',
  ask: 'Find it',
  pick: 'Pick the item',
  item: 'Item',
  outfit: 'Try on',
  result: 'Your look',
  results: 'Try-ons',
  walk: 'Walk back',
  wardrobe: 'Wardrobe',
  privacy: 'Privacy',
}

const SLIDE_MS = 360

export function NavProvider({ children }: { children: ReactNode }) {
  const key = useRef(1)
  const [stack, setStack] = useState<Entry[]>([{ name: 'home', key: 0 }])
  const [leaving, setLeaving] = useState<Entry | null>(null)
  const timer = useRef<number>()

  const leave = useCallback((e: Entry | null) => {
    window.clearTimeout(timer.current)
    setLeaving(e)
    if (e) timer.current = window.setTimeout(() => setLeaving(null), SLIDE_MS)
  }, [])

  const push = useCallback((r: Route) => setStack((s) => [...s, { ...r, key: key.current++ } as Entry]), [])
  const pop = useCallback(() => {
    setStack((s) => {
      if (s.length < 2) return s
      leave(s[s.length - 1])
      return s.slice(0, -1)
    })
  }, [leave])
  const popTo = useCallback(
    (name: Route['name'], then?: Route) => {
      setStack((s) => {
        const at = s.findIndex((e) => e.name === name)
        const base = at < 0 ? s.slice(0, 1) : s.slice(0, at + 1)
        if (then) return [...base, { ...then, key: key.current++ } as Entry]
        leave(s[s.length - 1])
        return base
      })
    },
    [leave],
  )

  const value = useMemo(() => ({ stack, leaving, push, pop, popTo }), [stack, leaving, push, pop, popTo])
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

// ---------------------------------------------------------------------------
// App state: what the user has done in this session of the prototype.

/** `captured` counts shutter presses this session; it only rotates the fake viewfinder. */
export type Shopping = { on: boolean; minutes: number; trip: string | null; shop: string | null; captured: number }

/** The one full-body photo used for try-ons. `checking`: the face/hair mask is being made on the phone. */
export type SelfPhoto = { state: 'ready' | 'checking' | 'failed'; taken: string }

/** Simulation switches in the host bar, outside the phone. Not product UI. */
export type Demo = { offline: boolean; maskFails: boolean; faceFails: boolean }

/** The try-on: one shop piece to try, and up to MAX_COMPANIONS pieces worn with it. */
export type Outfit = { target: string | null; companions: string[] }

export const MAX_COMPANIONS = 5

const SPARK_MS = 1800

const clock = (t: number) => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

type Store = {
  shopping: Shopping
  /** Creates a new trip and its Shop 1 at the current spot. */
  startShopping: () => void
  /** Ends the trip: the location trail goes, shops and photos stay. */
  endShopping: () => void
  locationAllowed: boolean
  setLocationAllowed: (allowed: boolean) => void
  notificationsAllowed: boolean
  setNotificationsAllowed: (allowed: boolean) => void

  /** Newest first. */
  trips: Trip[]
  shops: Shop[]
  photos: Photo[]
  trip: (id: string) => Trip | undefined
  shop: (id: string) => Shop | undefined
  photo: (id: string) => Photo | undefined
  /** Shops of a trip, in visit order. */
  shopsOf: (tripId: string) => Shop[]
  /** Photos of a shop, oldest first. */
  photosOf: (shopId: string) => Photo[]
  /** Photos of a whole trip. */
  tripPhotos: (tripId: string) => Photo[]
  startShop: () => void
  capturePhoto: () => void
  saveStorefront: () => void
  saveNote: (shopId: string, note: string) => void
  shopBanner: string | null
  dismissShopBanner: () => void
  /** Deletes the trip, its shops and photos. Saved pieces keep their cut-out and walk-back spot. */
  deleteTrip: (id: string) => void
  /** Deletes one photo. Pieces cut from it stay, without "Original photo". */
  deletePhoto: (id: string) => void

  saved: Piece[]
  save: (p: Piece) => void
  wardrobe: Piece[]
  addToWardrobe: (p: Piece) => void
  /** Removes a saved or wardrobe piece. Results keep their own copy. */
  deletePiece: (id: string) => void
  renamePiece: (id: string, label: string) => void
  piece: (id: string) => Piece | undefined
  /** A shop piece from a photo and candidate. `named` false: a tap cut-out that Spark names later. */
  pieceOf: (ph: Photo, c: Candidate, named?: boolean) => Piece

  outfit: Outfit
  setOutfit: (f: (o: Outfit) => Outfit) => void
  self: SelfPhoto
  setSelf: (s: SelfPhoto) => void
  results: Result[]
  addResult: (r: Result) => void
  deleteResult: (id: string) => void

  demo: Demo
  setDemo: (f: (d: Demo) => Demo) => void

  toast: { text: string; show: boolean } | null
  say: (text: string) => void
  /** Fades the toast early, when a sheet opens over where it sits. */
  hush: () => void
}

const StoreContext = createContext<Store | null>(null)
export const useStore = () => useContext(StoreContext)!

export function StoreProvider({ children }: { children: ReactNode }) {
  const [shopping, setShopping] = useState<Shopping>({ on: false, minutes: 0, trip: null, shop: null, captured: 0 })
  const [locationAllowed, setLocationAllowed] = useState(false)
  const [notificationsAllowed, setNotificationsAllowed] = useState(false)
  const [trips, setTrips] = useState<Trip[]>(TRIPS)
  const [shops, setShops] = useState<Shop[]>(SHOPS)
  const [photos, setPhotos] = useState<Photo[]>(PHOTOS)
  const [shopBanner, setShopBanner] = useState<string | null>(null)
  const [saved, setSaved] = useState<Piece[]>(SAVED_START)
  const [wardrobe, setWardrobe] = useState<Piece[]>(WARDROBE_START)
  const [outfit, setOutfitState] = useState<Outfit>({ target: null, companions: [] })
  const [self, setSelf] = useState<SelfPhoto>({ state: 'ready', taken: 'Oct 30' })
  const [results, setResults] = useState<Result[]>([])
  const [demo, setDemoState] = useState<Demo>({ offline: false, maskFails: false, faceFails: false })
  const [toast, setToast] = useState<{ text: string; show: boolean } | null>(null)
  const toastTimer = useRef<number>()

  useEffect(() => {
    if (!shopping.on) return
    const id = window.setInterval(() => setShopping((s) => ({ ...s, minutes: s.minutes + 1 })), 4000)
    return () => window.clearInterval(id)
  }, [shopping.on])

  // Background Spark work: storefront descriptions and piece names. Offline, it waits in the queue.
  const describing = shops.some((s) => s.descriptionState === 'pending')
  useEffect(() => {
    if (!describing || demo.offline) return
    const id = window.setTimeout(() => setShops((ss) => ss.map((s) => s.descriptionState === 'pending'
      ? { ...s, descriptionState: 'done', description: STOREFRONT_DESCRIPTION }
      : s)), SPARK_MS)
    return () => window.clearTimeout(id)
  }, [describing, demo.offline, shops])

  const naming = saved.some((p) => p.naming) || wardrobe.some((p) => p.naming)
  useEffect(() => {
    if (!naming || demo.offline) return
    const named = (ps: Piece[]) => ps.map((p) => p.naming ? { ...p, label: p.naming, naming: undefined } : p)
    const id = window.setTimeout(() => {
      setSaved(named)
      setWardrobe(named)
    }, SPARK_MS)
    return () => window.clearTimeout(id)
  }, [naming, demo.offline, saved, wardrobe])

  const newShop = (tripId: string, n: number): Shop => {
    const startedAt = Date.now()
    return {
      id: `${tripId}-${n}`, trip: tripId, n, name: `Shop ${n}`, startedAt, time: clock(startedAt),
      spot: { latitude: 37.5745 + n * 0.0002, longitude: 127.0185 + n * 0.0002 },
      descriptionState: 'none', distance: '120 m', walk: '2 min',
    }
  }

  const startShopping = () => {
    const at = Date.now()
    const id = `t${at}`
    const first = newShop(id, 1)
    setTrips((ts) => [{ id, date: TODAY, start: clock(at), recording: true }, ...ts])
    setShops((ss) => [...ss, first])
    setShopping({ on: true, minutes: 0, trip: id, shop: first.id, captured: 0 })
  }
  const endShopping = () => {
    setTrips((ts) => ts.map((t) => t.id === shopping.trip ? { ...t, recording: false, end: clock(Date.now()) } : t))
    setShopping((s) => ({ ...s, on: false, trip: null, shop: null }))
    setShopBanner(null)
  }
  const startShop = () => {
    if (!shopping.trip) return
    const s = newShop(shopping.trip, shops.filter((x) => x.trip === shopping.trip).length + 1)
    setShops((ss) => [...ss, s])
    setShopping((x) => ({ ...x, shop: s.id }))
    setShopBanner(s.id)
  }
  const capturePhoto = () => {
    const current = shops.find((s) => s.id === shopping.shop)
    if (!current) return
    const roll = PHOTOS.find((x) => x.id === CAMERA_ROLL[shopping.captured % CAMERA_ROLL.length])!
    const at = Date.now()
    setPhotos((ps) => [...ps, { ...roll, id: `${roll.id}-${at}`, trip: current.trip, shop: current.id, time: clock(at), spot: current.spot }])
    setShopping((s) => ({ ...s, captured: s.captured + 1 }))
    setShopBanner(null)
  }
  const saveStorefront = () => {
    setShops((ss) => ss.map((s) => s.id === shopping.shop
      ? { ...s, storefront: STOREFRONT_SAMPLE, description: undefined, descriptionState: 'pending' }
      : s))
  }
  const deleteTrip = (id: string) => {
    if (shopping.trip === id) endShopping()
    setTrips((ts) => ts.filter((t) => t.id !== id))
    setShops((ss) => ss.filter((s) => s.trip !== id))
    setPhotos((ps) => ps.filter((p) => p.trip !== id))
    const unlink = (ps: Piece[]) => ps.map((p) => p.trip === id ? { ...p, trip: undefined, shop: undefined, photoId: undefined } : p)
    setSaved(unlink)
  }
  const deletePhoto = (id: string) => {
    setPhotos((ps) => ps.filter((p) => p.id !== id))
    setSaved((ps) => ps.map((p) => p.photoId === id ? { ...p, photoId: undefined } : p))
  }
  const deletePiece = (id: string) => {
    setSaved((ps) => ps.filter((p) => p.id !== id))
    setWardrobe((ps) => ps.filter((p) => p.id !== id))
    setOutfitState((o) => ({ target: o.target === id ? null : o.target, companions: o.companions.filter((x) => x !== id) }))
  }

  // The toast keeps its text while it fades out, so it never empties mid-fade
  const say = useCallback((text: string) => {
    window.clearTimeout(toastTimer.current)
    setToast({ text, show: true })
    toastTimer.current = window.setTimeout(() => setToast((t) => t && { ...t, show: false }), 2600)
  }, [])
  const hush = useCallback(() => setToast((t) => t && { ...t, show: false }), [])
  const setOutfit = useCallback((f: (o: Outfit) => Outfit) => setOutfitState(f), [])
  const setDemo = useCallback((f: (d: Demo) => Demo) => setDemoState(f), [])

  const value: Store = {
    shopping,
    startShopping,
    endShopping,
    locationAllowed,
    setLocationAllowed,
    notificationsAllowed,
    setNotificationsAllowed,
    trips,
    shops,
    photos,
    trip: (id) => trips.find((t) => t.id === id),
    shop: (id) => shops.find((s) => s.id === id),
    photo: (id) => photos.find((p) => p.id === id),
    shopsOf: (tripId) => shops.filter((s) => s.trip === tripId).sort((a, b) => a.n - b.n),
    photosOf: (shopId) => photos.filter((p) => p.shop === shopId),
    tripPhotos: (tripId) => photos.filter((p) => p.trip === tripId),
    startShop,
    capturePhoto,
    saveStorefront,
    saveNote: (shopId, note) => setShops((ss) => ss.map((s) => s.id === shopId ? { ...s, note } : s)),
    shopBanner,
    dismissShopBanner: () => setShopBanner(null),
    deleteTrip,
    deletePhoto,
    saved,
    save: (p) => setSaved((s) => (s.some((x) => x.id === p.id) ? s : [p, ...s])),
    wardrobe,
    addToWardrobe: (p) => setWardrobe((w) => (w.some((x) => x.id === p.id) ? w : [...w, p])),
    deletePiece,
    renamePiece: (id, label) => {
      const rename = (ps: Piece[]) => ps.map((p) => p.id === id ? { ...p, label, naming: undefined } : p)
      setSaved(rename)
      setWardrobe(rename)
    },
    piece: (id) => [...saved, ...wardrobe].find((x) => x.id === id),
    pieceOf: (ph, c, named = true) => pieceFrom(ph, c, shops.find((s) => s.id === ph.shop)!, trips.find((t) => t.id === ph.trip)!, named),
    outfit,
    setOutfit,
    self,
    setSelf,
    results,
    addResult: (r) => setResults((rs) => [r, ...rs]),
    deleteResult: (id) => setResults((rs) => rs.filter((r) => r.id !== id)),
    demo,
    setDemo,
    toast,
    say,
    hush,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
