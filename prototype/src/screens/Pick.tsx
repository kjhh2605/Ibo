import { useState } from 'react'
import { Download, Hand, Trash2, Undo2 } from 'lucide-react'
import { Button } from '../kit'
import { PICKED_ITEM, WARDROBE_PHOTO, type Box, type Candidate } from '../data'
import { MAX_COMPANIONS, useNav, useStore } from '../state'
import { ConfirmSheet, Crop, I, IconButton, Screen, Shot, TopBar } from '../ui'

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

export function Pick({ photoId, mode, concept }: { photoId: string; mode: 'shop' | 'wardrobe' | 'outfit'; concept?: string }) {
  const { push, pop, popTo } = useNav()
  const { photo, shop, trip, pieceOf, save, addToWardrobe, deletePhoto, outfit, setOutfit, say } = useStore()
  const shopPhoto = mode === 'wardrobe' ? undefined : photo(photoId)
  const ph = shopPhoto ?? WARDROBE_PHOTO
  const [tapping, setTapping] = useState(!concept || !ph.candidates.length)
  const [tap, setTap] = useState<{ x: number; y: number } | null>(null)
  const [selected, setSelected] = useState<string | undefined>(concept ? ph.candidates[0]?.id : undefined)
  const [deleting, setDeleting] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const list = tapping ? (tap ? masksAt(tap.x, tap.y, ph.w / ph.h) : []) : [...ph.candidates].sort((a, b) => b.score - a.score)
  const visible = showAll ? list : list.slice(0, 3)
  const chosen = list.find((c) => c.id === selected)

  if (mode !== 'wardrobe' && !shopPhoto) return <Screen bar={<TopBar title="Photo deleted" />}><div className="sf-pad">This photo is no longer in your trips.</div></Screen>

  const use = () => {
    if (!chosen) return
    // A tapped area takes the name of the item it falls on, or what was asked for
    const under = tap && ph.candidates.find(({ box: [x, y, w, h] }) => tap.x >= x && tap.x <= x + w && tap.y >= y && tap.y <= y + h)
    const asked = concept && concept.charAt(0).toUpperCase() + concept.slice(1)
    const named = tapping ? { ...chosen, label: under?.label ?? asked ?? 'Picked item' } : chosen
    if (mode === 'outfit' && outfit.companions.length >= MAX_COMPANIONS) {
      say(`You can add up to ${MAX_COMPANIONS} pieces`)
      return
    }
    if (mode === 'wardrobe') {
      addToWardrobe({
        id: `${ph.id}:${chosen.id}`, src: ph.src, w: ph.w, h: ph.h, box: chosen.box,
        from: 'wardrobe', label: PICKED_ITEM, naming: named.label,
      })
      say('Added to your wardrobe')
      popTo('wardrobe')
      return
    }
    const piece = pieceOf(shopPhoto!, named, !!concept && !tapping)
    save(piece)
    if (mode === 'outfit') {
      setOutfit((o) => ({
        ...o,
        companions: o.companions.includes(piece.id) ? o.companions : [...o.companions, piece.id].slice(0, MAX_COMPANIONS),
      }))
      popTo('outfit')
      say('Saved and added to your outfit')
      return
    }
    push({ name: 'item', pieceId: piece.id })
  }

  const sub = mode === 'wardrobe' ? 'Tap the piece you own' : `${shop(shopPhoto!.shop)?.name} · ${trip(shopPhoto!.trip)?.date} · ${shopPhoto!.time}`

  return (
    <Screen
      bar={<TopBar title={mode === 'wardrobe' ? 'Add to wardrobe' : 'Pick the item'} sub={sub} actions={mode !== 'wardrobe' ? <><IconButton icon={Download} label="Save to gallery" onClick={() => say('Saved to gallery · location removed')} /><IconButton icon={Trash2} label="Delete photo" onClick={() => setDeleting(true)} /></> : undefined} />}
      foot={
        <div className="sf-foot-row">
          {mode !== 'wardrobe' && concept && (
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
            {mode === 'wardrobe' ? 'Add to wardrobe' : mode === 'outfit' ? 'Add to outfit' : 'Use this item'}
          </Button>
        </div>
      }
    >
      <div className="sf-pick">
        <Shot
          photo={ph}
          candidates={visible}
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
          {visible.map((c, i) => (
            <button key={c.id} type="button" className="sf-option" data-on={c.id === selected || undefined} onClick={() => setSelected(c.id)}>
              <span className="sf-option__n">{i + 1}</span>
              <Crop src={ph.src} w={ph.w} h={ph.h} box={c.box} width={52} height={52} />
              <span className="sf-option__label">{c.label}</span>
              <span className="sf-option__score">{Math.round(c.score * 100)}%</span>
            </button>
          ))}
        </div>
        {!showAll && list.length > 3 && <Button onClick={() => setShowAll(true)}>Show all ({list.length})</Button>}
      </div>
      <ConfirmSheet
        open={deleting}
        title="Delete photo?"
        text="This photo will be removed from your trip. Saved items and their walking directions will stay."
        action="Delete photo"
        onClose={() => setDeleting(false)}
        onConfirm={() => { deletePhoto(photoId); pop(); say('Photo deleted') }}
      />
    </Screen>
  )
}
