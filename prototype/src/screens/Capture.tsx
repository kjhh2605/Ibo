import { useEffect, useState } from 'react'
import { ArrowLeft, LocateFixed, Store, X } from 'lucide-react'
import { CAMERA_ROLL, STOREFRONT_SAMPLE } from '../data'
import { useNav, useStore } from '../state'
import { I, NoteSheet } from '../ui'

export function Capture() {
  const { pop } = useNav()
  const { shopping, shop, photo, photosOf, tripPhotos, startShop, capturePhoto, saveStorefront, shopBanner, dismissShopBanner, say } = useStore()
  const [flash, setFlash] = useState(0)
  const [storefront, setStorefront] = useState(false)
  const [noting, setNoting] = useState(false)
  const current = shopping.shop ? shop(shopping.shop) : undefined
  const view = storefront ? STOREFRONT_SAMPLE.src : photo(CAMERA_ROLL[shopping.captured % CAMERA_ROLL.length])?.src
  const tripShots = shopping.trip ? tripPhotos(shopping.trip) : []
  const last = tripShots[tripShots.length - 1]?.src

  useEffect(() => {
    setStorefront(false)
    setNoting(false)
  }, [shopping.shop])

  const shoot = () => {
    setFlash((n) => n + 1)
    if (storefront) {
      saveStorefront()
      setStorefront(false)
      say('Storefront saved')
      return
    }
    capturePhoto()
  }

  if (!current) return null

  return (
    <div className="sf-camera">
      <img className="sf-camera__view" src={view} alt="" draggable={false} key={view} />
      <span className="sf-camera__flash" key={flash} data-go={flash > 0 || undefined} />
      <div className="sf-camera__top">
        <button type="button" className="sf-iconbtn sf-iconbtn--glass" aria-label="Back" onClick={pop}><I icon={ArrowLeft} /></button>
        <div className="sf-camera__pill">
          <span className="sf-rec" />
          {storefront ? `${current.name} · storefront` : `${current.name} · ${photosOf(current.id).length} new`}
          <span className="sf-camera__gps"><I icon={LocateFixed} size={14} /> ±12 m</span>
        </div>
        <span className="sf-camera__spacer" />
      </div>
      {storefront ? (
        <div className="sf-camera__hint">Fit the whole shop front in the frame <button type="button" onClick={() => setStorefront(false)}>Cancel</button></div>
      ) : shopBanner === current.id && (
        <div className="sf-camera__banner">
          <button type="button" className="sf-iconbtn sf-camera__banner-close" aria-label="Dismiss shop banner" onClick={dismissShopBanner}><I icon={X} size={18} /></button>
          <div className="sf-camera__banner-title">{current.name} started</div>
          <div className="sf-camera__banner-text">This spot is saved.</div>
          <div className="sf-camera__banner-actions">
            <button type="button" className="sf-link" onClick={() => setStorefront(true)}>Storefront photo</button>
            <button type="button" className="sf-link" onClick={() => setNoting(true)}>Add note</button>
          </div>
        </div>
      )}
      <div className="sf-camera__bottom">
        <div className="sf-camera__last">{last && <img src={last} alt="" key={last} />}</div>
        <button type="button" className="sf-shutter" aria-label={storefront ? 'Take storefront photo' : 'Take photo'} onClick={shoot} data-store={storefront || undefined}><span /></button>
        <button type="button" className="sf-camera__newshop" onClick={startShop} disabled={storefront}><I icon={Store} size={20} />New shop</button>
      </div>
      {noting && <NoteSheet shop={current} onClose={() => setNoting(false)} />}
    </div>
  )
}
