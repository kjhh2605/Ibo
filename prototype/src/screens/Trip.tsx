import { ChevronRight, Footprints, Search } from 'lucide-react'
import { Button, Row } from '../kit'
import { photosOf, shop, SHOPS } from '../data'
import { useNav } from '../state'
import { I, Screen, Section, Storefront, Thumb, TopBar } from '../ui'

export function Trip() {
  const { push } = useNav()
  return (
    <Screen bar={<TopBar title="Today’s trip" sub="1:42–3:02 PM · 3 shops" />}>
      <div className="sf-pad">
        <div className="sf-timeline">
          {SHOPS.map((s, i) => (
            <div key={s.n} className="sf-timeline__item">
              <div className="sf-timeline__rail" data-last={i === SHOPS.length - 1 || undefined}>
                <span className="sf-timeline__n">{s.n}</span>
              </div>
              <button type="button" className="sf-timeline__card" onClick={() => push({ name: 'visit', shop: s.n })}>
                <Storefront src={s.storefront.src} w={s.storefront.w} h={s.storefront.h} height={120} />
                <span className="sf-timeline__head">
                  <span className="sf-timeline__name">{s.name}</span>
                  <span className="sf-timeline__time">{s.time}</span>
                </span>
                <span className="sf-timeline__desc">“{s.description}”</span>
                <span className="sf-timeline__strip">
                  {photosOf(s.n).map((p) => (
                    <Thumb key={p.id} src={p.src} size={44} />
                  ))}
                </span>
              </button>
            </div>
          ))}
        </div>
        <div className="sf-fineprint">Your location trail was deleted when shopping mode ended. Only each shop’s spot is kept.</div>
      </div>
    </Screen>
  )
}

export function Visit({ shop: n }: { shop: number }) {
  const { push } = useNav()
  const s = shop(n)
  const photos = photosOf(n)
  return (
    <Screen
      bar={<TopBar title={s.name} sub={`${s.time} · ${photos.length} photos`} />}
      foot={
        <div className="sf-foot-row">
          <Button size="large" icon={<I icon={Search} size={18} />} onClick={() => push({ name: 'ask' })}>
            Find it
          </Button>
          <Button variant="primary" size="large" className="sf-grow" icon={<I icon={Footprints} size={18} />} onClick={() => push({ name: 'walk', shop: n })}>
            Walk back · {s.walk}
          </Button>
        </div>
      }
    >
      <div className="sf-pad">
        <Storefront src={s.storefront.src} w={s.storefront.w} h={s.storefront.h} height={196} />
        <div className="sf-caption">“{s.description}”</div>
      </div>
      <Section title="Photos">
        <div className="sf-list">
          {photos.map((p) => (
            <Row
              key={p.id}
              className="sf-row"
              lead={<Thumb src={p.src} size={64} />}
              title={p.candidates.map((c) => c.label).slice(0, 2).join(', ')}
              subtitle={`${p.time} · tap to pick an item`}
              onClick={() => push({ name: 'pick', photoId: p.id, mode: 'shop' })}
            >
              <I icon={ChevronRight} size={20} className="sf-chev" />
            </Row>
          ))}
        </div>
      </Section>
    </Screen>
  )
}
