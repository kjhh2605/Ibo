import { Footprints, Image, MapPin, Shirt } from 'lucide-react'
import { Button, Card } from '../kit'
import { photo, shop } from '../data'
import { useNav, useStore } from '../state'
import { Crop, I, Screen, Storefront, TopBar } from '../ui'

export function Item({ pieceId }: { pieceId: string }) {
  const { push } = useNav()
  const { piece } = useStore()
  const p = piece(pieceId)
  if (!p) return null
  const s = p.shop ? shop(p.shop) : null
  const ph = p.photoId ? photo(p.photoId) : null

  return (
    <Screen
      bar={<TopBar title={p.label} sub={s && ph ? `${s.name} · ${ph.time}` : 'In your wardrobe'} />}
      foot={
        <div className="sf-foot-row">
          {s && (
            <Button size="large" icon={<I icon={Footprints} size={18} />} onClick={() => push({ name: 'walk', shop: s.n })}>
              Walk back
            </Button>
          )}
          <Button variant="primary" size="large" className="sf-grow" icon={<I icon={Shirt} size={18} />} onClick={() => push({ name: 'outfit', seed: p.id })}>
            Try it on
          </Button>
        </div>
      }
    >
      <div className="sf-pad">
        <div className="sf-hero-piece">
          <Crop src={p.src} w={p.w} h={p.h} box={p.box} width={364} height={340} fill={0.92} />
        </div>

        {s && ph && (
          <Card pad="medium" gap={12} className="sf-shopcard">
            <Storefront src={s.storefront.src} w={s.storefront.w} h={s.storefront.h} height={148} />
            <div className="sf-shopcard__row">
              <div>
                <div className="sf-shopcard__name">{s.name}</div>
                <div className="sf-shopcard__desc">“{s.description}”</div>
              </div>
            </div>
            <div className="sf-facts">
              <span className="sf-fact">
                <I icon={MapPin} size={16} /> {s.distance} · {s.walk} walk
              </span>
              <button type="button" className="sf-fact sf-fact--link" onClick={() => push({ name: 'pick', photoId: ph.id, mode: 'shop' })}>
                <I icon={Image} size={16} /> Original photo
              </button>
            </div>
          </Card>
        )}
      </div>
    </Screen>
  )
}
