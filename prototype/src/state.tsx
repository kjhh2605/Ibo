import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { SAVED_START, WARDROBE_START, type Piece } from './data'

// ---------------------------------------------------------------------------
// Navigation: one stack, pushed from the home screen. No tabs.

export type Route =
  | { name: 'home' }
  | { name: 'capture' }
  | { name: 'ask'; query?: string }
  | { name: 'pick'; photoId: string; mode: 'shop' | 'wardrobe'; concept?: string }
  | { name: 'item'; pieceId: string }
  | { name: 'outfit'; seed?: string }
  | { name: 'send' }
  | { name: 'result'; resultId: string }
  | { name: 'results' }
  | { name: 'walk'; shop: number }
  | { name: 'wardrobe' }
  | { name: 'trip' }
  | { name: 'visit'; shop: number }
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
  ask: 'Find it',
  pick: 'Pick the item',
  item: 'Item',
  outfit: 'Try on',
  send: 'Before sending',
  result: 'Result',
  results: 'Try-ons',
  walk: 'Walk back',
  wardrobe: 'Wardrobe',
  trip: 'Today’s trip',
  visit: 'Shop',
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

export type Result = { id: string; pieces: Piece[]; at: string }

type Shopping = { on: boolean; minutes: number; shop: number; photos: number; captured: number }

type Store = {
  shopping: Shopping
  setShopping: (f: (s: Shopping) => Shopping) => void
  saved: Piece[]
  save: (p: Piece) => void
  wardrobe: Piece[]
  addToWardrobe: (p: Piece) => void
  outfit: string[]
  setOutfit: (f: (ids: string[]) => string[]) => void
  results: Result[]
  addResult: (r: Result) => void
  piece: (id: string) => Piece | undefined
  toast: { text: string; show: boolean } | null
  say: (text: string) => void
  /** Fades the toast early, when a sheet opens over where it sits. */
  hush: () => void
}

const StoreContext = createContext<Store | null>(null)
export const useStore = () => useContext(StoreContext)!

export const MAX_PIECES = 9

export function StoreProvider({ children }: { children: ReactNode }) {
  const [shopping, setShoppingState] = useState<Shopping>({ on: false, minutes: 0, shop: 3, photos: 8, captured: 0 })
  const [saved, setSaved] = useState<Piece[]>(SAVED_START)
  const [wardrobe, setWardrobe] = useState<Piece[]>(WARDROBE_START)
  const [outfit, setOutfitState] = useState<string[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [toast, setToast] = useState<{ text: string; show: boolean } | null>(null)
  const toastTimer = useRef<number>()

  // The toast keeps its text while it fades out, so it never empties mid-fade
  const say = useCallback((text: string) => {
    window.clearTimeout(toastTimer.current)
    setToast({ text, show: true })
    toastTimer.current = window.setTimeout(() => setToast((t) => t && { ...t, show: false }), 2600)
  }, [])
  const hush = useCallback(() => setToast((t) => t && { ...t, show: false }), [])

  const value = useMemo<Store>(
    () => ({
      shopping,
      setShopping: (f) => setShoppingState(f),
      saved,
      save: (p) => setSaved((s) => (s.some((x) => x.id === p.id) ? s : [p, ...s])),
      wardrobe,
      addToWardrobe: (p) => setWardrobe((w) => (w.some((x) => x.id === p.id) ? w : [...w, p])),
      outfit,
      setOutfit: (f) => setOutfitState(f),
      results,
      addResult: (r) => setResults((rs) => [r, ...rs]),
      piece: (id) => [...saved, ...wardrobe].find((x) => x.id === id),
      toast,
      say,
      hush,
    }),
    [shopping, saved, wardrobe, outfit, results, toast, say, hush],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
