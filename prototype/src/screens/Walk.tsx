import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUp, ArrowUpRight, CornerUpLeft, CornerUpRight, MapPin } from 'lucide-react'
import { Button, Spinner } from '../kit'
import { ROUTE_STEPS } from '../data'
import { useNav, useStore } from '../state'
import { I, Offline, ShopDescription, Storefront, Thumb } from '../ui'

// The route in map units (the map is drawn at the screen's 412pt width)
const ROUTE: [number, number][] = [
  [206, 660],
  [206, 540],
  [118, 540],
  [118, 372],
  [262, 372],
  [250, 310],
  [262, 286],
]
// Where the walker stands at each step
const AT = [0, 1, 3, 4, 5, 6]
const TURNS = [ArrowUp, CornerUpLeft, CornerUpRight, ArrowUp]
const REMAINING = ['410 m · 6 min', '330 m · 5 min', '180 m · 3 min', '60 m · 1 min']

export function Walk({ pieceId, resultId }: { pieceId?: string; resultId?: string }) {
  const { pop } = useNav()
  const { piece, results, shop, trip, demo, say } = useStore()
  const target = resultId ? results.find((r) => r.id === resultId)?.target : pieceId ? piece(pieceId) : undefined
  const liveShop = target?.shop ? shop(target.shop) : undefined
  const place = target?.place
  const shopName = liveShop?.name ?? place?.shopName ?? 'Saved photo spot'
  const tripDate = (liveShop ? trip(liveShop.trip)?.date : undefined) ?? place?.tripDate
  const storefront = liveShop ? liveShop.storefront : place?.storefront
  const note = liveShop ? liveShop.note : place?.note
  const description = liveShop ? liveShop.description : place?.description
  const destination = target?.walkTo
  const [step, setStep] = useState(0)
  const [rerouting, setRerouting] = useState(false)
  const finalSegment = step === ROUTE_STEPS.length
  const arrived = step > ROUTE_STEPS.length
  const canGuide = !!destination && !demo.offline
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
    <div className="sf-walk" data-state={demo.offline ? 'offline' : arrived ? 'arrived' : finalSegment ? 'final-segment' : rerouting ? 'rerouting' : 'walking'}>
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

        {canGuide && (
          <>
            <polyline points={pts(walked)} className="sf-map__walked" />
            {!finalSegment && !arrived && <>
              <polyline points={pts(ahead)} className="sf-map__casing" />
              <polyline points={pts(ahead)} className="sf-map__route" />
            </>}
          </>
        )}

        {destination && <g transform={`translate(${ROUTE[ROUTE.length - 1][0]} ${ROUTE[ROUTE.length - 1][1]})`}>
          <circle r="34" className="sf-map__radius" />
          <circle r="7" className="sf-map__dest" />
        </g>}
        {canGuide && <g className="sf-map__me" style={{ transform: `translate(${x}px, ${y}px)` }}>
          <circle r="16" className="sf-map__me-halo" />
          <circle r="8" className="sf-map__me-dot" />
        </g>}
      </svg>

      <div className="sf-walk__top">
        <button type="button" className="sf-iconbtn sf-iconbtn--float" aria-label="Back" onClick={pop}>
          <I icon={ArrowLeft} />
        </button>
        <div style={{ flex: 1, display: 'grid', gap: 8 }}>
          <div style={{ padding: '12px 16px', borderRadius: 20, background: 'var(--ss-raised)' }}>
            <div className="sf-walk__title">{target?.label ?? 'Destination unavailable'}</div>
            <div className="sf-walk__text">{shopName}{tripDate ? ` · ${tripDate}` : ''}</div>
            {destination && <div style={{ fontSize: 11, color: 'var(--ss-text)', marginTop: 4 }}>Photo spot · {destination.latitude.toFixed(5)}, {destination.longitude.toFixed(5)} · Fixed pin</div>}
          </div>
        {!arrived && canGuide && (
          <div className="sf-turn" data-reroute={rerouting || undefined}>
            {rerouting ? (
              <span className="sf-inline">
                <Spinner size={18} /> Off route. Finding a new way…
              </span>
            ) : finalSegment ? (
              <>
                <I icon={ArrowUpRight} size={32} />
                <div>
                  <div className="sf-turn__dist">18 m · Northeast</div>
                  <div className="sf-turn__text">Final segment · straight-line distance to your photo spot</div>
                </div>
              </>
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
      </div>

      <div className="sf-demo" style={{ top: 326, right: 12 }}>
        <span>Demo</span>
        <button type="button" onClick={() => setStep((v) => Math.min(ROUTE_STEPS.length + 1, v + 1))} disabled={arrived || !canGuide || rerouting}>
          Walk a step
        </button>
        <button type="button" onClick={() => setRerouting(true)} disabled={arrived || !canGuide || rerouting}>
          Go off route
        </button>
      </div>

      <div className="sf-walk__card" data-arrived={arrived || undefined}>
        {demo.offline ? (
          <>
            <Offline text="The walking route can’t load. Your saved destination is still here." onRetry={() => say('Still offline. Reconnect, then try again.')} />
            <div className="sf-walk__title">{shopName}</div>
            <div className="sf-walk__text">Saved photo spot · {tripDate}</div>
            {note && <div className="sf-walk__desc">{note}</div>}
          </>
        ) : !destination ? (
          <>
            <div className="sf-walk__title">No saved photo location</div>
            <div className="sf-walk__text">Walking guidance needs the location where this item was photographed.</div>
            <Button onClick={pop}>Back</Button>
          </>
        ) : arrived ? (
          <>
            <div className="sf-walk__title">You’re at {shopName}</div>
            <div className="sf-walk__text">{storefront ? 'Look for this shop front. Stalls here sit close together, so trust the photo over the pin.' : 'You’re near the photo spot. Check the note and the shaded pin area to find the shop.'}</div>
            {storefront ? <Storefront {...storefront} height={190} /> : (
              <div style={{ padding: 20, borderRadius: 16, background: 'var(--ss-well)' }}>
                <div className="sf-walk__title">No storefront photo</div>
                <p className="sf-walk__desc">{note || description || 'No note or storefront description saved. Use the photo spot and nearby signs to confirm the shop.'}</p>
                <div className="sf-walk__text"><I icon={MapPin} size={16} /> Photo spot · within the shaded area</div>
              </div>
            )}
            {storefront && <div className="sf-walk__desc">{note || (liveShop ? <ShopDescription shop={liveShop} /> : description)}</div>}
            <Button variant="primary" size="large" className="sf-grow" onClick={pop}>
              Done
            </Button>
          </>
        ) : (
          <div className="sf-walk__row">
            {storefront && <Thumb src={storefront.src} size={52} />}
            <div className="sf-walk__body">
              <div className="sf-walk__title">{shopName}</div>
              <div className="sf-walk__text">
                <I icon={MapPin} size={14} /> {finalSegment ? '18 m straight line' : REMAINING[step]} · where you took the photo
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
