import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUp, CornerUpLeft, CornerUpRight, MapPin } from 'lucide-react'
import { Button, Spinner } from '../kit'
import { ROUTE_STEPS, shop } from '../data'
import { useNav } from '../state'
import { I, Storefront } from '../ui'

// The route in map units (the map is drawn at the screen's 412pt width)
const ROUTE: [number, number][] = [
  [206, 660],
  [206, 540],
  [118, 540],
  [118, 372],
  [262, 372],
  [262, 286],
]
// Where the walker stands at each step
const AT = [0, 1, 3, 4, 5]
const TURNS = [ArrowUp, CornerUpLeft, CornerUpRight, CornerUpLeft]
const REMAINING = ['410 m · 6 min', '330 m · 5 min', '180 m · 3 min', '60 m · 1 min', '']

export function Walk({ shop: n }: { shop: number }) {
  const { pop } = useNav()
  const s = shop(n)
  const [step, setStep] = useState(0)
  const [rerouting, setRerouting] = useState(false)
  const arrived = step >= ROUTE_STEPS.length
  const [x, y] = ROUTE[AT[step]]
  const walked = ROUTE.slice(0, AT[step] + 1)
  const ahead = ROUTE.slice(AT[step])

  useEffect(() => {
    if (!rerouting) return
    const id = window.setTimeout(() => setRerouting(false), 1400)
    return () => window.clearTimeout(id)
  }, [rerouting])

  const pts = (p: [number, number][]) => p.map(([a, b]) => `${a},${b}`).join(' ')

  return (
    <div className="sf-walk">
      <svg className="sf-map" viewBox="0 0 412 867" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect width="412" height="867" className="sf-map__ground" />
        <path d="M250 430 h150 v120 h-150z" className="sf-map__park" />
        <path d="M150 400 h80 v120 h-80z M150 200 h80 v150 h-80z M20 200 h80 v150 h-80z M290 160 h110 v100 h-110z M20 580 h160 v200 h-160z M240 580 h160 v200 h-160z" className="sf-map__block" />
        <g className="sf-map__road">
          <path d="M0 540 H412" />
          <path d="M206 540 V867" />
          <path d="M118 120 V540" />
          <path d="M0 372 H412" />
          <path d="M262 160 V372" />
        </g>
        <g className="sf-map__lane">
          <path d="M0 180 H412" />
          <path d="M300 372 V540" />
          <path d="M40 540 V867" />
        </g>
        <text x="300" y="532" className="sf-map__label">Jong-ro</text>
        <text x="16" y="364" className="sf-map__label">Market lane</text>
        <text x="270" y="496" className="sf-map__label sf-map__label--park">Park</text>
        <text x="132" y="620" className="sf-map__label">Exit 3</text>

        <polyline points={pts(walked)} className="sf-map__walked" />
        <polyline points={pts(ahead)} className="sf-map__casing" />
        <polyline points={pts(ahead)} className="sf-map__route" />

        <g transform={`translate(${ROUTE[ROUTE.length - 1][0]} ${ROUTE[ROUTE.length - 1][1]})`}>
          <circle r="34" className="sf-map__radius" />
          <circle r="7" className="sf-map__dest" />
        </g>
        <g className="sf-map__me" style={{ transform: `translate(${x}px, ${y}px)` }}>
          <circle r="16" className="sf-map__me-halo" />
          <circle r="8" className="sf-map__me-dot" />
        </g>
      </svg>

      <div className="sf-walk__top">
        <button type="button" className="sf-iconbtn sf-iconbtn--float" aria-label="Back" onClick={pop}>
          <I icon={ArrowLeft} />
        </button>
        {!arrived && (
          <div className="sf-turn" data-reroute={rerouting || undefined}>
            {rerouting ? (
              <span className="sf-inline">
                <Spinner size={18} /> Off route. Finding a new way…
              </span>
            ) : (
              <>
                <I icon={TURNS[step]} size={28} />
                <div>
                  <div className="sf-turn__dist">{ROUTE_STEPS[step].dist}</div>
                  <div className="sf-turn__text">{ROUTE_STEPS[step].text}</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="sf-demo">
        <span>Demo</span>
        <button type="button" onClick={() => setStep((v) => Math.min(ROUTE_STEPS.length, v + 1))} disabled={arrived}>
          Walk a step
        </button>
        <button type="button" onClick={() => setRerouting(true)} disabled={arrived}>
          Go off route
        </button>
      </div>

      <div className="sf-walk__card" data-arrived={arrived || undefined}>
        {arrived ? (
          <>
            <div className="sf-walk__title">You’re at {s.name}</div>
            <div className="sf-walk__text">Look for this shop front. Stalls here sit close together, so trust the photo over the pin.</div>
            <Storefront src={s.storefront.src} w={s.storefront.w} h={s.storefront.h} height={190} />
            <div className="sf-walk__desc">“{s.description}”</div>
            <Button variant="primary" size="large" className="sf-grow" onClick={pop}>
              Done
            </Button>
          </>
        ) : (
          <div className="sf-walk__row">
            <img className="sf-thumb" src={s.storefront.src} alt="" style={{ width: 52, height: 52 }} />
            <div className="sf-walk__body">
              <div className="sf-walk__title">{s.name}</div>
              <div className="sf-walk__text">
                <I icon={MapPin} size={14} /> {REMAINING[step]} · where you took the photo
              </div>
            </div>
            <Button size="large" onClick={pop}>
              End
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
