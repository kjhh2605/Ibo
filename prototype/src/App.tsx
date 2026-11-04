import { useEffect, useRef, useState } from 'react'
import { Shirt } from 'lucide-react'
import { I } from './ui'
import { Phone, Stage, Toast } from './kit'
import { NavProvider, StoreProvider, TITLES, useNav, useStore, type Demo, type Entry } from './state'
import { Home } from './screens/Home'
import { Capture } from './screens/Capture'
import { Ask } from './screens/Ask'
import { Pick } from './screens/Pick'
import { Item } from './screens/Item'
import { Outfit, Result, Results } from './screens/TryOn'
import { Walk } from './screens/Walk'
import { Wardrobe } from './screens/Wardrobe'
import { Trip, Trips } from './screens/Trip'
import { Privacy } from './screens/Privacy'

function Route({ e }: { e: Entry }) {
  switch (e.name) {
    case 'home': return <Home />
    case 'capture': return <Capture />
    case 'trips': return <Trips forOutfit={e.forOutfit} />
    case 'trip': return <Trip tripId={e.tripId} shopId={e.shopId} forOutfit={e.forOutfit} />
    case 'ask': return <Ask query={e.query} />
    case 'pick': return <Pick photoId={e.photoId} mode={e.mode} concept={e.concept} />
    case 'item': return <Item pieceId={e.pieceId} />
    case 'outfit': return <Outfit seed={e.seed} />
    case 'result': return <Result resultId={e.resultId} />
    case 'results': return <Results />
    case 'walk': return <Walk pieceId={e.pieceId} resultId={e.resultId} />
    case 'wardrobe': return <Wardrobe />
    case 'privacy': return <Privacy />
  }
}

/** A screen in the stack. It slides in only when first pushed, never when uncovered again. */
function Layer({ e, pos }: { e: Entry; pos: string }) {
  const [fresh, setFresh] = useState(e.key !== 0)
  return (
    <div className="sf-layer" data-pos={pos} data-fresh={fresh || undefined} onAnimationEnd={(ev) => ev.target === ev.currentTarget && setFresh(false)}>
      <Route e={e} />
    </div>
  )
}

/** The stack, drawn as layers: the top slides in from the right, the one under it eases left. */
function Screens() {
  const { stack, leaving, pop, push, popTo } = useNav()
  const { toast, shopping, notificationsAllowed, startShop, shop, tripPhotos } = useStore()
  const current = shopping.shop ? shop(shopping.shop) : undefined
  const [notifications, setNotifications] = useState(false)
  const gestureY = useRef(0)
  const openCamera = (newShop: boolean) => {
    setNotifications(false)
    if (newShop) startShop()
    if (stack[stack.length - 1].name !== 'capture') push({ name: 'capture' })
  }

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return
      if (notifications) setNotifications(false)
      else pop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pop, notifications])

  const layers = leaving ? [...stack, leaving] : stack
  return (
    <>
    <button type="button" className="sf-notification-hotspot" aria-label="Open notifications" onClick={() => setNotifications(true)} onPointerDown={(e) => {
      gestureY.current = e.clientY
      e.currentTarget.setPointerCapture(e.pointerId)
    }} onPointerMove={(e) => {
      if (e.buttons && e.clientY - gestureY.current > 12) setNotifications(true)
    }} />
    <div className="sf-app">
      {layers.map((e) => {
        const i = stack.indexOf(e)
        const pos = e === leaving ? 'leaving' : i === stack.length - 1 ? 'top' : i === stack.length - 2 ? 'under' : 'deep'
        return <Layer key={e.key} e={e} pos={pos} />
      })}
      <div className="sf-toaster">
        <Toast show={!!toast?.show}>{toast?.text ?? ''}</Toast>
      </div>
      {notifications && (
        <div className="sf-notifications" role="dialog" aria-modal="true" aria-label="Notifications">
          <button type="button" className="sf-notifications__scrim" aria-label="Close notifications" onClick={() => setNotifications(false)} />
          <div className="sf-notifications__panel" onPointerDown={(e) => { gestureY.current = e.clientY }} onPointerUp={(e) => {
            if (gestureY.current - e.clientY > 32) setNotifications(false)
          }}>
            <div className="sf-notifications__time">2:51</div>
            <div className="sf-notifications__date">Wednesday, November 4</div>
            {shopping.on && notificationsAllowed ? (
              <div className="sf-notification-card">
                <button type="button" className="sf-notification-card__body" onClick={() => {
                  setNotifications(false)
                  popTo('home')
                }}>
                  <span className="sf-notification-card__app"><I icon={Shirt} size={18} /> Street Fitting <span>Recording</span></span>
                  <strong>Shopping mode · {current?.name}</strong>
                  <span>{shopping.trip ? tripPhotos(shopping.trip).length : 0} photos · {shopping.minutes} min</span>
                </button>
                <div className="sf-notification-card__actions">
                  <button type="button" onClick={() => openCamera(false)}>Take photo</button>
                  <button type="button" onClick={() => openCamera(true)}>New shop</button>
                </div>
              </div>
            ) : <div className="sf-notifications__empty">No notifications</div>}
            <button type="button" className="sf-notifications__handle" aria-label="Close notifications" onClick={() => setNotifications(false)} />
          </div>
        </div>
      )}
    </div>
    </>
  )
}

function Device() {
  const { stack } = useNav()
  // The camera is the one dark screen: the status bar turns light over it
  const dark = stack[stack.length - 1].name === 'capture'
  return (
    <Stage width={480} height={1000} unframed className="look-sf">
      {() => (
        <Phone width={440} frame="android" time="2:51" dark={dark} className="sf-phone">
          <Screens />
        </Phone>
      )}
    </Stage>
  )
}

const DEMO_SWITCHES: { key: keyof Demo; label: string }[] = [
  { key: 'offline', label: 'Offline' },
  { key: 'maskFails', label: 'Masking fails' },
  { key: 'faceFails', label: 'Face check fails' },
]

function Host({ onReset }: { onReset: () => void }) {
  const { stack } = useNav()
  const { demo, setDemo } = useStore()
  return (
    <header className="host__bar">
      <div className="host__title">
        Street Fitting <span>clickable prototype · no real features</span>
      </div>
      <nav className="host__crumbs" aria-label="Depth">
        {stack.map((e, i) => (
          <span key={e.key} data-current={i === stack.length - 1 || undefined}>
            {TITLES[e.name]}
          </span>
        ))}
      </nav>
      <div className="host__actions">
        <span className="host__keys">Esc = back</span>
        <span className="host__hint">Tap the status bar to pull down notifications</span>
        <span className="host__demo" role="group" aria-label="Simulate">
          {DEMO_SWITCHES.map((s) => (
            <label key={s.key} data-on={demo[s.key] || undefined}>
              <input type="checkbox" checked={demo[s.key]} onChange={(e) => setDemo((d) => ({ ...d, [s.key]: e.target.checked }))} />
              {s.label}
            </label>
          ))}
        </span>
        <button type="button" onClick={onReset}>
          Reset
        </button>
      </div>
    </header>
  )
}

export default function App() {
  const [run, setRun] = useState(0)
  return (
    <StoreProvider key={`s${run}`}>
      <NavProvider key={`n${run}`}>
        <div className="host">
          <Host onReset={() => setRun((n) => n + 1)} />
          <main className="host__stage">
            <Device />
          </main>
          <footer className="host__foot">
            Sample photos from Wikimedia Commons under CC licenses, see <a href="/photos/CREDITS.md">credits</a>. Try-on images are placeholders.
          </footer>
        </div>
      </NavProvider>
    </StoreProvider>
  )
}
