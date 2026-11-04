import { useState } from 'react'
import { Camera, ChevronRight, Search, Shirt, ShieldCheck, Images, Store, Square } from 'lucide-react'
import { Badge, Button, Card, Row } from '../kit'
import { useNav, useStore } from '../state'
import { I, IconButton, LocationPermission, PieceTile, Screen, Section, Sheet, ShopDescription, ShopImage, SystemPermission, TextLink } from '../ui'

export function Home() {
  const { push } = useNav()
  const { shopping, startShopping, endShopping, trips, shopsOf, shop, photosOf, tripPhotos, saved, wardrobe, results, say, locationAllowed, setLocationAllowed, notificationsAllowed, setNotificationsAllowed } = useStore()
  const recent = trips[0]
  const recentShops = recent ? shopsOf(recent.id) : []
  const current = shopping.shop ? shop(shopping.shop) : undefined
  const currentPhotos = shopping.trip ? tripPhotos(shopping.trip).length : 0
  const currentShops = shopping.trip ? shopsOf(shopping.trip).length : 0
  const [ending, setEnding] = useState(false)
  const [permission, setPermission] = useState<'location' | 'notifications' | null>(null)
  const [denied, setDenied] = useState(false)

  const begin = (notifications: boolean) => {
    setPermission(null)
    startShopping()
    say(notifications ? 'Shopping mode on · recording your location' : 'Shopping mode on · no notification card')
  }
  const start = () => {
    if (!locationAllowed) setPermission('location')
    else begin(notificationsAllowed)
  }
  const end = () => {
    setEnding(false)
    endShopping()
    say('Trail deleted · shop spots kept')
  }

  return (
    <Screen
      bar={
        <div className="sf-topbar sf-topbar--home">
          <div className="sf-wordmark">Street Fitting</div>
          <div className="sf-topbar__actions">
            <IconButton icon={ShieldCheck} label="Privacy" onClick={() => push({ name: 'privacy' })} />
          </div>
        </div>
      }
    >
      <div className="sf-pad">
        <Card pad="large" gap={14} className="sf-mode" data-on={shopping.on || undefined}>
          {shopping.on ? (
            <>
              <div className="sf-mode__head">
                <Badge tone="danger" dot>
                  Recording
                </Badge>
                <span className="sf-mode__time">{shopping.minutes} min</span>
              </div>
              <div className="sf-mode__title">{current?.name ?? 'Shopping trip'}</div>
              <div className="sf-mode__meta">
                {currentPhotos} photos this trip · location on while this is on
              </div>
              <div className="sf-mode__actions">
                <Button variant="primary" size="large" icon={<I icon={Camera} size={20} />} onClick={() => push({ name: 'capture' })}>
                  Take photo
                </Button>
                <Button size="large" icon={<I icon={Square} size={18} />} onClick={() => setEnding(true)}>
                  End
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="sf-mode__title">Shopping mode</div>
              <div className="sf-mode__meta">Snap anything you like. We remember which shop it was in, so you can find it and walk back later.</div>
              <div className="sf-mode__actions">
                <Button variant="primary" size="large" icon={<I icon={Store} size={20} />} onClick={start}>
                  Start shopping
                </Button>
              </div>
            </>
          )}
        </Card>

        <button type="button" className="sf-ask" onClick={() => push({ name: 'ask' })}>
          <I icon={Search} />
          <span className="sf-ask__text">Find something you saw…</span>
        </button>
      </div>

      <Section title={recent ? `${recent.date} · ${recentShops.length} shops` : 'Your trips'} action={<TextLink onClick={() => push({ name: 'trips' })}>All trips</TextLink>}>
        <div className="sf-list">
          {!recentShops.length && <div className="sf-hint">No shops yet. Start shopping to keep your finds together.</div>}
          {recentShops.map((s) => (
            <Row
              key={s.id}
              className="sf-row"
              lead={<ShopImage shop={s} height={52} thumb />}
              title={s.name}
              meta={s.time}
              subtitle={<>{photosOf(s.id).length} photos{s.descriptionState !== 'none' ? <> · <ShopDescription shop={s} /></> : null}</>}
              onClick={() => push({ name: 'trip', tripId: s.trip, shopId: s.id })}
            >
              <I icon={ChevronRight} size={20} className="sf-chev" />
            </Row>
          ))}
        </div>
      </Section>

      <Section title="Saved" action={saved.length > 0 ? <span className="sf-count">{saved.length}</span> : undefined}>
        <div className="sf-strip">
          {saved.map((p) => (
            <PieceTile key={p.id} piece={p} size={124} onClick={() => push({ name: 'item', pieceId: p.id })} />
          ))}
          <button type="button" className="sf-strip__add" onClick={() => push({ name: 'ask' })}>
            <I icon={Search} />
            <span>Find another</span>
          </button>
        </div>
      </Section>

      <div className="sf-pad sf-pad--last">
        <Card pad="small" gap={0} className="sf-links">
          <Row className="sf-row" lead={<span className="sf-tile"><I icon={Shirt} /></span>} title="Wardrobe" subtitle={`${wardrobe.length} pieces you own`} onClick={() => push({ name: 'wardrobe' })}>
            <I icon={ChevronRight} size={20} className="sf-chev" />
          </Row>
          <Row
            className="sf-row"
            lead={<span className="sf-tile"><I icon={Images} /></span>}
            title="Try-ons"
            subtitle={results.length ? `${results.length} looks, kept on this phone` : 'No looks yet'}
            onClick={() => push({ name: 'results' })}
          >
            <I icon={ChevronRight} size={20} className="sf-chev" />
          </Row>
        </Card>
      </div>

      <Sheet open={ending} onClose={() => setEnding(false)} label="End shopping mode">
        <div className="sf-sheet__title">End shopping mode?</div>
        <div className="sf-sheet__text">
          {currentShops} shops, {currentPhotos} photos. Your step-by-step location trail is deleted now. Each shop’s spot and its photos stay on this phone.
        </div>
        <div className="sf-sheet__actions">
          <Button size="large" onClick={() => setEnding(false)}>
            Keep going
          </Button>
          <Button variant="primary" size="large" onClick={end}>
            End
          </Button>
        </div>
      </Sheet>
      {permission === 'location' && <LocationPermission onAllow={() => {
        setLocationAllowed(true)
        setPermission('notifications')
      }} onDeny={() => {
        setPermission(null)
        setDenied(true)
      }} />}
      {permission === 'notifications' && (
        <SystemPermission title="Allow Street Fitting to send you notifications?">
          <button type="button" onClick={() => {
            setNotificationsAllowed(true)
            begin(true)
          }}>Allow</button>
          <button type="button" onClick={() => {
            setNotificationsAllowed(false)
            begin(false)
          }}>Don't allow</button>
        </SystemPermission>
      )}
      <Sheet open={denied} onClose={() => setDenied(false)} label="Shopping mode needs your location">
        <div className="sf-sheet__title">Shopping mode needs your location</div>
        <div className="sf-sheet__text">It's how each shop gets pinned so you can walk back to it. Shopping mode can't start without it.</div>
        <div className="sf-sheet__actions">
          <Button size="large" onClick={() => setDenied(false)}>Not now</Button>
          <Button variant="primary" size="large" onClick={() => {
            setDenied(false)
            say('Prototype: settings not connected')
          }}>Open settings</Button>
        </div>
      </Sheet>
    </Screen>
  )
}
