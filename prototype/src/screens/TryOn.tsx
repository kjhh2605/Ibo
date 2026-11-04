import { useEffect, useState } from 'react'
import { Camera, ChevronRight, CloudUpload, Footprints, ImagePlus, Lock, ScanFace, Smartphone } from 'lucide-react'
import { Button, Card, Check, Row, Segmented, Spinner, States } from '../kit'
import { shop, type Piece } from '../data'
import { MAX_PIECES, useNav, useStore } from '../state'
import { Crop, I, PieceTile, Screen, Section, Sheet, TopBar } from '../ui'

type Slot = 'top' | 'bottom' | 'feet' | 'full'

const slotOf = (p: Piece): Slot => {
  const l = p.label.toLowerCase()
  if (/dress/.test(l)) return 'full'
  if (/jean|skirt|trouser|pant/.test(l)) return 'bottom'
  if (/flat|shoe|boot|sneaker/.test(l)) return 'feet'
  return 'top'
}

const SLOT_BOX: Record<Slot, { top: number; height: number; width: number }> = {
  top: { top: 20, height: 34, width: 64 },
  full: { top: 20, height: 58, width: 62 },
  bottom: { top: 50, height: 38, width: 46 },
  feet: { top: 87, height: 10, width: 40 },
}

/**
 * Stand-in for the person photo. There is no real photo or generated image
 * in the prototype: the figure is a placeholder, `masked` shows the head area
 * held back on the phone, and `wearing` lays the picked pieces where they go.
 */
export function Person({ width, height, masked, wearing = [], label }: { width: number; height: number; masked?: boolean; wearing?: Piece[]; label?: string }) {
  const order: Slot[] = ['feet', 'bottom', 'full', 'top']
  const bySlot = new Map<Slot, Piece>()
  wearing.forEach((p) => bySlot.set(slotOf(p), p))
  return (
    <div className="sf-person" style={{ width, height }}>
      <span className="sf-person__head" data-masked={masked || undefined}>
        {masked && <I icon={Lock} size={18} />}
      </span>
      <span className="sf-person__body" />
      {order.map((slot) => {
        const p = bySlot.get(slot)
        if (!p) return null
        const b = SLOT_BOX[slot]
        return (
          <span key={slot} className="sf-person__piece" style={{ top: `${b.top}%`, left: `${(100 - b.width) / 2}%`, width: `${b.width}%`, height: `${b.height}%` }}>
            <Crop src={p.src} w={p.w} h={p.h} box={p.box} width={(b.width / 100) * width} height={(b.height / 100) * height} fill={1} />
          </span>
        )
      })}
      {label && <span className="sf-person__label">{label}</span>}
    </div>
  )
}

export function Outfit({ seed }: { seed?: string }) {
  const { push } = useNav()
  const { saved, wardrobe, outfit, setOutfit, piece, say } = useStore()
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    if (seed) setOutfit((ids) => (ids.includes(seed) ? ids : [seed, ...ids].slice(0, MAX_PIECES)))
  }, [seed, setOutfit])

  const toggle = (id: string) =>
    setOutfit((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id)
      if (ids.length >= MAX_PIECES) {
        say(`Up to ${MAX_PIECES} pieces at once`)
        return ids
      }
      return [...ids, id]
    })

  const picked = outfit.map(piece).filter(Boolean) as Piece[]

  return (
    <Screen
      bar={<TopBar title="Try on" sub="Pick what to wear together" />}
      foot={
        <div className="sf-foot-row">
          <div className="sf-foot-note">
            {picked.length} of {MAX_PIECES} pieces
          </div>
          <Button variant="primary" size="large" className="sf-grow" onClick={() => push({ name: 'send' })} data-disabled={!picked.length || undefined}>
            Continue
          </Button>
        </div>
      }
    >
      <div className="sf-pad">
        <Card pad="medium" gap={12} className="sf-me">
          <Person width={84} height={120} />
          <div className="sf-me__body">
            <div className="sf-me__title">Your photo</div>
            <div className="sf-me__text">Full-body, taken Oct 30. Kept on this phone.</div>
            <Button size="medium" onClick={() => setChanging(true)}>
              Change
            </Button>
          </div>
        </Card>
      </div>

      <Section title="Wearing">
        <div className="sf-strip">
          {picked.length === 0 && <div className="sf-empty">Nothing yet. Pick from below.</div>}
          {picked.map((p) => (
            <PieceTile key={p.id} piece={p} size={92} onClick={() => toggle(p.id)} selected>
              <span className="sf-piece__x" aria-hidden>
                ×
              </span>
            </PieceTile>
          ))}
        </div>
      </Section>

      <Section title="Saved from shops">
        <div className="sf-grid">
          {saved.map((p) => (
            <PieceTile key={p.id} piece={p} size={116} onClick={() => toggle(p.id)} selected={outfit.includes(p.id)}>
              <Check on={outfit.includes(p.id)} size={20} className="sf-piece__check" />
            </PieceTile>
          ))}
        </div>
      </Section>

      <Section title="Your wardrobe">
        <div className="sf-grid sf-grid--last">
          {wardrobe.map((p) => (
            <PieceTile key={p.id} piece={p} size={116} onClick={() => toggle(p.id)} selected={outfit.includes(p.id)}>
              <Check on={outfit.includes(p.id)} size={20} className="sf-piece__check" />
            </PieceTile>
          ))}
        </div>
      </Section>

      <Sheet open={changing} onClose={() => setChanging(false)} label="Change your photo">
        <div className="sf-sheet__title">Change your photo</div>
        <div className="sf-sheet__text">Stand facing the camera, arms a little away from your body. The photo never leaves this phone with your face in it.</div>
        <div className="sf-sheet__list">
          <Row className="sf-row" lead={<span className="sf-tile"><I icon={Camera} /></span>} title="Take a photo" onClick={() => { setChanging(false); say('Prototype: camera not connected') }} />
          <Row className="sf-row" lead={<span className="sf-tile"><I icon={ImagePlus} /></span>} title="Choose from gallery" onClick={() => { setChanging(false); say('Prototype: gallery not connected') }} />
        </div>
      </Sheet>
    </Screen>
  )
}

type Phase = 'idle' | 'sending' | 'generating' | 'restoring'

export function Send() {
  const { popTo } = useNav()
  const { outfit, piece, addResult } = useStore()
  const [phase, setPhase] = useState<Phase>('idle')
  const picked = outfit.map(piece).filter(Boolean) as Piece[]

  useEffect(() => {
    if (phase === 'idle') return
    const next: Record<Exclude<Phase, 'idle'>, () => void> = {
      sending: () => setPhase('generating'),
      generating: () => setPhase('restoring'),
      restoring: () => {
        const id = `r${Date.now()}`
        addResult({ id, pieces: picked, at: 'Just now' })
        setPhase('idle')
        // The result takes the send step's place, so back returns to the outfit
        popTo('outfit', { name: 'result', resultId: id })
      },
    }
    const t = window.setTimeout(next[phase], phase === 'generating' ? 2200 : 1000)
    return () => window.clearTimeout(t)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen
      bar={<TopBar title="Before sending" sub="This is exactly what leaves your phone" />}
      foot={
        <Button variant="primary" size="large" className="sf-grow" onClick={() => phase === 'idle' && setPhase('sending')} data-busy={phase !== 'idle' || undefined}>
          <States
            value={phase}
            states={{
              idle: 'Generate',
              sending: (
                <span className="sf-inline">
                  <Spinner size={16} /> Sending without your face…
                </span>
              ),
              generating: (
                <span className="sf-inline">
                  <Spinner size={16} /> Generating the look…
                </span>
              ),
              restoring: (
                <span className="sf-inline">
                  <Spinner size={16} /> Putting your face back…
                </span>
              ),
            }}
          />
        </Button>
      }
    >
      <div className="sf-pad">
        <div className="sf-send">
          <Person width={150} height={220} masked label="Face and hair held back" />
          <div className="sf-send__pieces">
            {picked.map((p) => (
              <div key={p.id} className="sf-send__piece">
                <Crop src={p.src} w={p.w} h={p.h} box={p.box} width={56} height={56} />
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        <Card pad="small" gap={0} className="sf-boundary">
          <Row className="sf-row" lead={<span className="sf-tile"><I icon={Smartphone} /></span>} title="Stays on this phone" subtitle="Your face and hair, and the original photo" />
          <Row className="sf-row" lead={<span className="sf-tile"><I icon={CloudUpload} /></span>} title="Sent once, not stored" subtitle="The photo above and the pieces, to Meta’s image model through our relay" />
          <Row className="sf-row" lead={<span className="sf-tile"><I icon={ScanFace} /></span>} title="Put back on this phone" subtitle="Your face goes back onto the result here" />
        </Card>
      </div>
    </Screen>
  )
}

export function Result({ resultId }: { resultId: string }) {
  const { push, popTo, stack } = useNav()
  const { results } = useStore()
  const [view, setView] = useState(0)
  const r = results.find((x) => x.id === resultId)
  if (!r) return null
  const shops = [...new Set(r.pieces.map((p) => p.shop).filter(Boolean) as number[])]
  const toOutfit = () => (stack.some((e) => e.name === 'outfit') ? popTo('outfit') : push({ name: 'outfit' }))
  const count = `${r.pieces.length} ${r.pieces.length === 1 ? 'piece' : 'pieces'}`

  return (
    <Screen
      bar={<TopBar title="Your look" sub={`${count} · ${r.at}`} />}
      foot={
        <div className="sf-foot-row">
          <Button size="large" onClick={toOutfit}>
            Change pieces
          </Button>
          {shops[0] && (
            <Button variant="primary" size="large" className="sf-grow" icon={<I icon={Footprints} size={18} />} onClick={() => push({ name: 'walk', shop: shops[0] })}>
              Walk to {shop(shops[0]).name}
            </Button>
          )}
        </div>
      }
    >
      <div className="sf-pad">
        <div className="sf-result-view">
          <Person width={300} height={420} wearing={view === 0 ? r.pieces : []} label={view === 0 ? 'Generated look (placeholder)' : 'Your photo'} />
        </div>
        <div className="sf-center" onClick={(e) => {
          const t = (e.target as HTMLElement).closest('[data-target]')?.getAttribute('data-target')
          if (t) setView(t === 'look' ? 0 : 1)
        }}>
          <Segmented items={['Look', 'Original']} value={view} targets={['look', 'original']} cursor="pointer" className="sf-seg" />
        </div>
        <div className="sf-hint">Wearing</div>
        <Card pad="small" gap={0} className="sf-boundary">
          {r.pieces.map((p) => (
            <Row
              key={p.id}
              className="sf-row"
              lead={<Crop src={p.src} w={p.w} h={p.h} box={p.box} width={44} height={44} className="sf-crop--tile" />}
              title={p.label}
              subtitle={p.shop ? `${shop(p.shop).name} · ${shop(p.shop).distance}` : 'Your wardrobe'}
              onClick={() => push({ name: 'item', pieceId: p.id })}
            >
              <I icon={ChevronRight} size={20} className="sf-chev" />
            </Row>
          ))}
        </Card>
        <div className="sf-fineprint">Only shown in this app. Sharing comes later.</div>
      </div>
    </Screen>
  )
}

export function Results() {
  const { push } = useNav()
  const { results } = useStore()
  return (
    <Screen bar={<TopBar title="Try-ons" sub="Kept on this phone" />}>
      <div className="sf-pad">
        {results.length === 0 ? (
          <div className="sf-emptystate">
            <div className="sf-emptystate__title">No looks yet</div>
            <div className="sf-emptystate__text">Open something you saved and tap Try it on.</div>
          </div>
        ) : (
          <div className="sf-grid sf-grid--looks">
            {results.map((r) => (
              <button key={r.id} type="button" className="sf-look" onClick={() => push({ name: 'result', resultId: r.id })}>
                <Person width={170} height={238} wearing={r.pieces} />
                <span className="sf-look__label">
                  {r.pieces.length} {r.pieces.length === 1 ? 'piece' : 'pieces'} · {r.at}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Screen>
  )
}
