import { useState } from 'react'
import { Hand, Undo2 } from 'lucide-react'
import { Button } from '../kit'
import { photo, pieceFrom, shop, WARDROBE_PHOTO, type Box, type Candidate } from '../data'
import { useNav, useStore } from '../state'
import { Crop, I, Screen, Shot, TopBar } from '../ui'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Three nested areas around a tap, the way a tap model returns small, medium and large masks. */
function masksAt(x: number, y: number, ratio: number): Candidate[] {
  const sizes: [string, number, number][] = [
    ['Small area', 14, 0.71],
    ['Medium area', 28, 0.86],
    ['Large area', 48, 0.64],
  ]
  return sizes
    .map(([label, w, score], i) => {
      const h = Math.min(96, w * ratio * 1.3)
      const box: Box = [clamp(x - w / 2, 0, 100 - w), clamp(y - h / 2, 0, 100 - h), w, h]
      return { id: `m${i}`, label, score, box }
    })
    .sort((a, b) => b.score - a.score)
}

export function Pick({ photoId, mode, concept }: { photoId: string; mode: 'shop' | 'wardrobe'; concept?: string }) {
  const { push, popTo } = useNav()
  const { save, addToWardrobe, say } = useStore()
  const ph = mode === 'wardrobe' ? WARDROBE_PHOTO : photo(photoId)
  const [tapping, setTapping] = useState(mode === 'wardrobe')
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null)
  const list = tapping ? (tap ? masksAt(tap.x, tap.y, ph.w / ph.h) : []) : ph.candidates
  const [selected, setSelected] = useState<string | undefined>(mode === 'shop' ? ph.candidates[0]?.id : undefined)
  const chosen = list.find((c) => c.id === selected)

  const use = () => {
    if (!chosen) return
    // A tapped area takes the name of the item it falls on, or what was asked for
    const under = tap && ph.candidates.find(({ box: [x, y, w, h] }) => tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h)
    const asked = concept && concept.charAt(0).toUpperCase() + concept.slice(1)
    const named = tapping ? { ...chosen, label: under?.label ?? asked ?? 'Picked item' } : chosen
    const piece = pieceFrom(ph, named)
    if (mode === 'wardrobe') {
      addToWardrobe(piece)
      say('Added to your wardrobe')
      popTo('wardrobe')
      return
    }
    save(piece)
    push({ name: 'item', pieceId: piece.id })
  }

  const sub = mode === 'wardrobe' ? 'Tap the piece you own' : `${shop(ph.shop).name} · ${ph.time}`

  return (
    <Screen
      bar={<TopBar title={mode === 'wardrobe' ? 'Add to wardrobe' : 'Pick the item'} sub={sub} />}
      foot={
        <div className="sf-foot-row">
          {mode === 'shop' && (
            <Button
              size="large"
              icon={<I icon={tapping ? Undo2 : Hand} size={18} />}
              onClick={() => {
                setTapping((t) => !t)
                setTap(null)
                setSelected(tapping ? ph.candidates[0]?.id : undefined)
              }}
            >
              {tapping ? 'Show matches' : 'Not here? Tap it'}
            </Button>
          )}
          <Button variant="primary" size="large" className="sf-grow" onClick={use} data-disabled={!chosen || undefined}>
            {mode === 'wardrobe' ? 'Add to wardrobe' : 'Use this item'}
          </Button>
        </div>
      }
    >
      <div className="sf-pick">
        <Shot
          photo={ph}
          candidates={list}
          selected={selected}
          onSelect={setSelected}
          tap={tapping ? tap : null}
          onTap={
            tapping
              ? (x, y) => {
                  setTap({ x, y })
                  setSelected('m1')
                }
              : undefined
          }
        />
        {tapping && !tap && <div className="sf-pick__hint">Tap the item in the photo</div>}
      </div>

      <div className="sf-pad">
        {list.length > 0 && (
          <div className="sf-hint">{tapping ? 'Which area?' : `Found ${list.length} ${list.length === 1 ? 'item' : 'items'}, best first`}</div>
        )}
        <div className="sf-options">
          {list.map((c, i) => (
            <button key={c.id} type="button" className="sf-option" data-on={c.id === selected || undefined} onClick={() => setSelected(c.id)}>
              <span className="sf-option__n">{i + 1}</span>
              <Crop src={ph.src} w={ph.w} h={ph.h} box={c.box} width={52} height={52} />
              <span className="sf-option__label">{c.label}</span>
              <span className="sf-option__score">{Math.round(c.score * 100)}%</span>
            </button>
          ))}
        </div>
      </div>
    </Screen>
  )
}
