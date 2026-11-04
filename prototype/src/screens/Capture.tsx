import { useEffect, useState } from 'react'
import { ArrowLeft, LocateFixed, Store } from 'lucide-react'
import { Button, Spinner } from '../kit'
import { CAMERA_ROLL, photo, SHOPS } from '../data'
import { useNav, useStore } from '../state'
import { I, Sheet } from '../ui'

const STOREFRONT = SHOPS[0].storefront.src

export function Capture() {
  const { pop } = useNav()
  const { shopping, setShopping, say } = useStore()
  const [flash, setFlash] = useState(0)
  const [asking, setAsking] = useState(false)
  const [storefront, setStorefront] = useState(false)
  const [describing, setDescribing] = useState<'idle' | 'working' | 'done'>('idle')
  const view = storefront ? STOREFRONT : photo(CAMERA_ROLL[shopping.captured % CAMERA_ROLL.length]).src
  const last = shopping.captured > 0 ? photo(CAMERA_ROLL[(shopping.captured - 1) % CAMERA_ROLL.length]).src : null

  useEffect(() => {
    if (describing !== 'working') return
    const id = window.setTimeout(() => setDescribing('done'), 1800)
    return () => window.clearTimeout(id)
  }, [describing])

  const shoot = () => {
    setFlash((n) => n + 1)
    if (storefront) {
      setStorefront(false)
      setDescribing('working')
      setShopping((s) => ({ ...s, shop: s.shop + 1 }))
      return
    }
    setShopping((s) => ({ ...s, photos: s.photos + 1, captured: s.captured + 1 }))
  }

  return (
    <div className="sf-camera">
      <img className="sf-camera__view" src={view} alt="" draggable={false} key={view} />
      <span className="sf-camera__flash" key={flash} data-go={flash > 0 || undefined} />

      <div className="sf-camera__top">
        <button type="button" className="sf-iconbtn sf-iconbtn--glass" aria-label="Back" onClick={pop}>
          <I icon={ArrowLeft} />
        </button>
        <div className="sf-camera__pill">
          <span className="sf-rec" />
          {storefront ? 'New shop · storefront' : `Shop ${shopping.shop}${shopping.captured ? ` · ${shopping.captured} new` : ''}`}
          <span className="sf-camera__gps">
            <I icon={LocateFixed} size={14} />
            ±12 m
          </span>
        </div>
        <span className="sf-camera__spacer" />
      </div>

      {storefront && <div className="sf-camera__hint">Fit the whole shop front in the frame</div>}

      {describing !== 'idle' && (
        <div className="sf-camera__note" data-done={describing === 'done' || undefined}>
          <img src={STOREFRONT} alt="" />
          <div>
            <div className="sf-camera__note-title">Shop {shopping.shop} started</div>
            <div className="sf-camera__note-text">
              {describing === 'working' ? (
                <span className="sf-inline">
                  <Spinner size={12} /> Describing the storefront…
                </span>
              ) : (
                '“Two-tone house, clothes hung along the balcony”'
              )}
            </div>
          </div>
          {describing === 'done' && (
            <button type="button" className="sf-camera__note-close" onClick={() => setDescribing('idle')}>
              OK
            </button>
          )}
        </div>
      )}

      <div className="sf-camera__bottom">
        <div className="sf-camera__last">{last && <img src={last} alt="" key={last} />}</div>
        <button type="button" className="sf-shutter" aria-label={storefront ? 'Take storefront photo' : 'Take photo'} onClick={shoot} data-store={storefront || undefined}>
          <span />
        </button>
        <button type="button" className="sf-camera__newshop" onClick={() => setAsking(true)} disabled={storefront}>
          <I icon={Store} size={20} />
          New shop
        </button>
      </div>

      <Sheet open={asking} onClose={() => setAsking(false)} label="New shop">
        <div className="sf-sheet__title">In a new shop?</div>
        <div className="sf-sheet__text">Take one photo of the shop front. Market stalls sit close together, and this is what helps you spot the right one when you walk back.</div>
        <div className="sf-sheet__actions">
          <Button
            size="large"
            onClick={() => {
              setAsking(false)
              setShopping((s) => ({ ...s, shop: s.shop + 1 }))
              say(`Shop ${shopping.shop + 1} started · no storefront`)
            }}
          >
            Skip
          </Button>
          <Button
            variant="primary"
            size="large"
            onClick={() => {
              setAsking(false)
              setStorefront(true)
            }}
          >
            Take storefront photo
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
