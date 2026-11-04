import { useEffect, useState } from 'react'
import { Camera, ChevronRight, Footprints, ImagePlus, Lock } from 'lucide-react'
import { Button, Card, Check, Row, Spinner } from '../kit'
import { type Piece } from '../data'
import { MAX_COMPANIONS, useNav, useStore } from '../state'
import { ConfirmSheet, Crop, I, Offline, PieceTile, Screen, Section, Sheet, TopBar } from '../ui'

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

// A silhouette and garment crops stand in for a generated photo in this prototype.
export function Person({ width, height, masked, wearing = [], label }: { width: number; height: number; masked?: boolean; wearing?: Piece[]; label?: string }) {
  const order: Slot[] = ['feet', 'bottom', 'full', 'top']
  const bySlot = new Map<Slot, Piece>()
  wearing.forEach((p) => bySlot.set(slotOf(p), p))
  return <div className="sf-person" style={{ width, height }}>
    <span className="sf-person__head" data-masked={masked || undefined}>{masked && <I icon={Lock} size={18} />}</span>
    <span className="sf-person__body" />
    {order.map((slot) => {
      const p = bySlot.get(slot)
      if (!p) return null
      const b = SLOT_BOX[slot]
      return <span key={slot} className="sf-person__piece" style={{ top: `${b.top}%`, left: `${(100 - b.width) / 2}%`, width: `${b.width}%`, height: `${b.height}%` }}>
        <Crop src={p.src} w={p.w} h={p.h} box={p.box} width={(b.width / 100) * width} height={(b.height / 100) * height} fill={1} />
      </span>
    })}
    {label && <span className="sf-person__label">{label}</span>}
  </div>
}

type Phase = 'idle' | 'sending' | 'generating' | 'restoring'
const PHASE_TEXT = { idle: 'Generate', sending: 'Sending without your face…', generating: 'Generating the look…', restoring: 'Putting your face back…' }

export function Outfit({ seed }: { seed?: string }) {
  const { push, popTo } = useNav()
  const { saved, wardrobe, outfit, setOutfit, piece, say, self, setSelf, demo, addResult } = useStore()
  const [changing, setChanging] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const target = outfit.target ? piece(outfit.target) : undefined
  const companions = outfit.companions.map(piece).filter((p): p is Piece => !!p)
  const busy = phase !== 'idle'
  const ready = target?.from === 'shop' && self.state === 'ready' && !demo.offline && !busy

  useEffect(() => {
    const p = seed ? piece(seed) : undefined
    if (p?.from === 'shop') setOutfit((o) => ({ target: p.id, companions: o.companions.filter((id) => id !== p.id) }))
  }, [seed, setOutfit])

  useEffect(() => {
    if (self.state !== 'checking') return
    const t = window.setTimeout(() => setSelf({ state: demo.maskFails ? 'failed' : 'ready', taken: 'Just now' }), 1500)
    return () => window.clearTimeout(t)
  }, [self.state, demo.maskFails, setSelf])

  useEffect(() => {
    if (phase === 'idle') return
    const t = window.setTimeout(() => {
      if (demo.offline) { setPhase('idle'); return }
      if (phase === 'sending') setPhase('generating')
      else if (phase === 'generating') setPhase('restoring')
      else if (target) {
        const id = `r${Date.now()}`
        addResult({ id, target, companions, at: 'Just now', faceless: demo.faceFails })
        setPhase('idle')
        popTo('outfit', { name: 'result', resultId: id })
      }
    }, phase === 'generating' ? 2200 : 1200)
    return () => window.clearTimeout(t)
  }, [phase, demo.offline])

  const toggle = (p: Piece) => {
    if (busy) return
    if (!target) {
      if (p.from === 'shop') setOutfit((o) => ({ ...o, target: p.id, companions: o.companions.filter((id) => id !== p.id) }))
      else say('Choose a saved shop piece as your target first')
      return
    }
    if (p.id === target.id) return
    if (!outfit.companions.includes(p.id) && outfit.companions.length >= MAX_COMPANIONS) { say('Up to 5 companion pieces. Remove one to add another.'); return }
    setOutfit((o) => ({ ...o, companions: o.companions.includes(p.id) ? o.companions.filter((id) => id !== p.id) : [...o.companions, p.id] }))
  }
  const choosePhoto = () => { setChanging(false); setSelf({ state: 'checking', taken: 'Just now' }) }
  return <Screen bar={<TopBar title="Try on" sub="One shop piece. Your own combination." />} foot={
    <div className="sf-foot-row">
      <div className="sf-foot-note">{companions.length} / 5<br />companions</div>
      <Button variant="primary" size="large" className="sf-grow" data-disabled={!ready || undefined} aria-disabled={!ready} onClick={() => { if (ready) setPhase('sending') }}>
        {busy ? <span className="sf-inline"><Spinner size={16} /> {PHASE_TEXT[phase]}</span> : 'Generate'}
      </Button>
    </div>
  }>
    <div className="sf-pad">
      {demo.offline && <Offline text="You can choose pieces offline. Connect to generate your look." onRetry={() => say('Reconnect, then tap Generate')} />}
      <Card pad="medium" gap={12} className="sf-me">
        <Person width={84} height={120} />
        <div className="sf-me__body">
          <div className="sf-me__title">Your photo</div>
          <div className="sf-me__text">{self.state === 'checking' ? 'Removing face and hair on this phone…' : self.state === 'failed' ? 'We couldn’t safely remove your face and hair. Retake a full-body photo.' : `Full-body · ${self.taken}. Original stays on this phone.`}</div>
          {self.state === 'checking' ? <Spinner size={20} /> : <Button size="medium" data-disabled={busy || undefined} onClick={() => { if (!busy) setChanging(true) }}>{self.state === 'failed' ? 'Retake' : 'Change'}</Button>}
        </div>
      </Card>
      {busy && <div className="sf-tryon-progress" role="status"><Spinner size={20} /><div><strong>{PHASE_TEXT[phase]}</strong><p>Your original photo and face stay on this phone.</p></div></div>}
    </div>
    <Section title="Target · 1 shop piece">
      <div className="sf-strip">{target ? <PieceTile piece={target} size={112} selected><span className="sf-piece__x"><I icon={Lock} size={14} /></span></PieceTile> : <div className="sf-empty">Choose a saved shop piece below to try on.</div>}</div>
    </Section>
    <Section title={`Wear with it · ${companions.length} of 5`}>
      <div className="sf-strip">{!companions.length && <div className="sf-empty">Optional. Add pieces from your wardrobe or a trip.</div>}{companions.map((p) => <PieceTile key={p.id} piece={p} size={92} selected onClick={() => toggle(p)}><span className="sf-piece__x">×</span></PieceTile>)}</div>
      <div className="sf-pad"><Button size="large" data-disabled={busy || undefined} icon={<I icon={ImagePlus} size={18} />} onClick={() => {
        if (busy) return
        if (companions.length >= MAX_COMPANIONS) say('Up to 5 companion pieces. Remove one to add another.')
        else push({ name: 'trips', forOutfit: true })
      }}>From a trip photo</Button></div>
    </Section>
    {[{ title: 'Saved from shops', pieces: saved }, { title: 'Your wardrobe', pieces: wardrobe }].map(({ title, pieces }) => <Section title={title} key={title}>
      <div className="sf-grid sf-grid--last">{pieces.map((p) => {
        const selected = p.id === target?.id || outfit.companions.includes(p.id)
        return <PieceTile key={p.id} piece={p} size={116} onClick={() => toggle(p)} selected={selected}><Check on={selected} size={20} className="sf-piece__check" /></PieceTile>
      })}{!pieces.length && <div className="sf-empty">No pieces yet.</div>}</div>
    </Section>)}
    <Sheet open={changing} onClose={() => setChanging(false)} label="Change your photo">
      <div className="sf-sheet__title">Change your photo</div>
      <div className="sf-sheet__text">Stand facing the camera, arms a little away from your body. This replaces your previous photo. Face and hair are removed automatically before sending.</div>
      <div className="sf-sheet__list"><Row className="sf-row" lead={<I icon={Camera} />} title="Take a photo" onClick={choosePhoto} /><Row className="sf-row" lead={<I icon={ImagePlus} />} title="Choose from gallery" onClick={choosePhoto} /></div>
    </Sheet>
  </Screen>
}

export function Result({ resultId }: { resultId: string }) {
  const { push, pop, popTo, stack } = useNav()
  const { results, piece, setOutfit, deleteResult } = useStore()
  const [deleting, setDeleting] = useState(false)
  const r = results.find((x) => x.id === resultId)
  if (!r) return null
  const pieces = [r.target, ...r.companions]
  const canChange = !!piece(r.target.id)
  const change = () => {
    if (!canChange) return
    setOutfit(() => ({ target: r.target.id, companions: r.companions.filter((p) => !!piece(p.id)).map((p) => p.id) }))
    if (stack.some((e) => e.name === 'outfit')) popTo('outfit')
    else push({ name: 'outfit', seed: r.target.id })
  }
  return <Screen bar={<TopBar title="Your look" sub={`${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'} · ${r.at}`} actions={<Button size="small" onClick={() => setDeleting(true)}>Delete</Button>} />} foot={
    <div className="sf-tryon-actions"><Button size="large" data-disabled={!canChange || undefined} aria-disabled={!canChange} onClick={change}>Change pieces</Button><Button variant="primary" size="large" icon={<I icon={Footprints} size={18} />} onClick={() => push({ name: 'walk', resultId: r.id })}>Walk to {r.target.place?.shopName || 'shop'}</Button></div>
  }>
    <div className="sf-pad">
      <div className="sf-result-view"><Person width={300} height={420} masked={r.faceless} wearing={pieces} label="Generated look (placeholder)" /></div>
      {r.faceless && <div className="sf-tryon-notice">Your face couldn’t be put back cleanly, so this look is shown without it.</div>}
      {!canChange && <div className="sf-tryon-notice">The target piece was deleted. Your look and walk-back location are still saved.</div>}
      <div className="sf-hint">Wearing</div>
      <Card pad="small" gap={0} className="sf-boundary">{pieces.map((p, i) => <Row key={p.id} className="sf-row" lead={<Crop src={p.src} w={p.w} h={p.h} box={p.box} width={44} height={44} className="sf-crop--tile" />} title={p.label} subtitle={`${i === 0 ? 'Target · ' : ''}${p.place?.shopName || 'Your wardrobe'}${!piece(p.id) ? ' · Saved snapshot' : ''}`} onClick={piece(p.id) ? () => push({ name: 'item', pieceId: p.id }) : undefined}>{piece(p.id) && <I icon={ChevronRight} size={20} className="sf-chev" />}</Row>)}</Card>
    </div>
    <ConfirmSheet open={deleting} title="Delete this look?" text="This removes the look from your try-ons. Your saved pieces stay." onClose={() => setDeleting(false)} onConfirm={() => { deleteResult(r.id); setDeleting(false); pop() }} />
  </Screen>
}

export function Results() {
  const { push } = useNav()
  const { results } = useStore()
  return <Screen bar={<TopBar title="Try-ons" sub={`${results.length} looks · kept on this phone`} />}>
    <div className="sf-pad">{!results.length ? <div className="sf-empty"><strong>No looks yet</strong><p>Open something you saved and tap Try it on.</p></div> : <div className="sf-looks-grid">{results.map((r) => <button type="button" className="sf-look-card" key={r.id} onClick={() => push({ name: 'result', resultId: r.id })}><Person width={148} height={210} masked={r.faceless} wearing={[r.target, ...r.companions]} /><strong>{r.target.label}</strong><span>{r.companions.length + 1} pieces · {r.at}</span></button>)}</div>}</div>
  </Screen>
}
