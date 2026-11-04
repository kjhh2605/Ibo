import { useEffect, useState } from 'react'
import { Camera, ChevronRight, Mic, Search, Shirt, ShieldCheck, Images, Store, Square } from 'lucide-react'
import { Badge, Button, Card, Row } from '../kit'
import { SHOPS, photosOf } from '../data'
import { useNav, useStore } from '../state'
import { I, IconButton, PieceTile, Screen, Section, Sheet, TextLink, Thumb } from '../ui'

export function Home() {
  const { push } = useNav()
  const { shopping, setShopping, saved, wardrobe, results, say } = useStore()
  const [ending, setEnding] = useState(false)

  // The recording clock ticks a minute every few seconds so the card reads as live
  useEffect(() => {
    if (!shopping.on) return
    const id = window.setInterval(() => setShopping((s) => ({ ...s, minutes: s.minutes + 1 })), 4000)
    return () => window.clearInterval(id)
  }, [shopping.on, setShopping])

  const start = () => {
    setShopping((s) => ({ ...s, on: true, minutes: 0, captured: 0 }))
    say('Shopping mode on · recording your location')
  }
  const end = () => {
    setEnding(false)
    setShopping((s) => ({ ...s, on: false }))
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
              <div className="sf-mode__title">Shop {shopping.shop}</div>
              <div className="sf-mode__meta">
                {shopping.photos} photos today · location on while this is on
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
          <span className="sf-ask__mic">
            <I icon={Mic} size={20} />
          </span>
        </button>
      </div>

      <Section title="Today · 3 shops" action={<TextLink onClick={() => push({ name: 'trip' })}>See trip</TextLink>}>
        <div className="sf-list">
          {SHOPS.map((s) => (
            <Row
              key={s.n}
              className="sf-row"
              lead={<Thumb src={s.storefront.src} size={52} />}
              title={s.name}
              meta={s.time}
              subtitle={`${photosOf(s.n).length} photos · ${s.description}`}
              onClick={() => push({ name: 'visit', shop: s.n })}
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
          {shopping.shop} shops, {shopping.photos} photos. Your step-by-step location trail is deleted now. Each shop’s spot and its photos stay on this phone.
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
    </Screen>
  )
}
