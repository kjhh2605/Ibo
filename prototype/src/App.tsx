import { useEffect, useState } from 'react'
import { Phone, Stage, Toast } from './kit'
import { NavProvider, StoreProvider, TITLES, useNav, useStore, type Entry } from './state'
import { Home } from './screens/Home'
import { Capture } from './screens/Capture'
import { Ask } from './screens/Ask'
import { Pick } from './screens/Pick'
import { Item } from './screens/Item'
import { Outfit, Result, Results, Send } from './screens/TryOn'
import { Walk } from './screens/Walk'
import { Wardrobe } from './screens/Wardrobe'
import { Trip, Visit } from './screens/Trip'
import { Privacy } from './screens/Privacy'

function Route({ e }: { e: Entry }) {
  switch (e.name) {
    case 'home': return <Home />
    case 'capture': return <Capture />
    case 'ask': return <Ask query={e.query} />
    case 'pick': return <Pick photoId={e.photoId} mode={e.mode} concept={e.concept} />
    case 'item': return <Item pieceId={e.pieceId} />
    case 'outfit': return <Outfit seed={e.seed} />
    case 'send': return <Send />
    case 'result': return <Result resultId={e.resultId} />
    case 'results': return <Results />
    case 'walk': return <Walk shop={e.shop} />
    case 'wardrobe': return <Wardrobe />
    case 'trip': return <Trip />
    case 'visit': return <Visit shop={e.shop} />
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
  const { stack, leaving, pop } = useNav()
  const { toast } = useStore()

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') pop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pop])

  const layers = leaving ? [...stack, leaving] : stack
  return (
    <div className="sf-app">
      {layers.map((e) => {
        const i = stack.indexOf(e)
        const pos = e === leaving ? 'leaving' : i === stack.length - 1 ? 'top' : i === stack.length - 2 ? 'under' : 'deep'
        return <Layer key={e.key} e={e} pos={pos} />
      })}
      <div className="sf-toaster">
        <Toast show={!!toast?.show}>{toast?.text ?? ''}</Toast>
      </div>
    </div>
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

function Host({ onReset }: { onReset: () => void }) {
  const { stack } = useNav()
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
