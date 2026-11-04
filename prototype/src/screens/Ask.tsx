import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronDown, ChevronRight, Mic } from 'lucide-react'
import { Button, Check, Collapse } from '../kit'
import { answer, EXAMPLE_QUERIES } from '../data'
import { useNav, useStore } from '../state'
import { I, Offline, Screen, Shot, TopBar } from '../ui'

export function Ask({ query: initial }: { query?: string }) {
  const { push } = useNav()
  const { photo, shop, trip, trips, shops, photos, demo } = useStore()
  const [text, setText] = useState(initial ?? '')
  const [asked, setAsked] = useState<string | null>(demo.offline ? null : initial ?? null)
  const [done, setDone] = useState(0)
  const [listening, setListening] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const found = asked ? answer(asked) : null
  const matches = found?.photos.flatMap((id) => {
    const ph = photo(id)
    return ph ? [ph] : []
  }) ?? []
  const target = found ? shop(found.shop) : undefined
  const steps = [
    { title: 'Read your trips', detail: `${trips.length} trips · ${shops.length} shops · ${photos.length} photos, including shop notes` },
    { title: target ? `Narrowed to ${target.name}` : 'Checked your shop summaries', detail: target ? `${trip(target.trip)?.date} · ${target.description ?? 'No storefront description'}` : 'Looked across all your trips' },
    { title: 'Searched its photos', detail: `${matches.length} close matches${found ? ` for “${found.concept}”` : ''}` },
    { title: matches.length ? 'Outlined the items' : 'Finished searching', detail: matches.length ? 'Pick the one you meant' : 'No matching photos found' },
  ]
  const complete = done >= steps.length

  useEffect(() => {
    if (demo.offline) {
      setAsked(null)
      setListening(false)
      return
    }
    if (!asked || done >= 4) return
    const id = window.setTimeout(() => setDone((d) => d + 1), done === 0 ? 700 : 900)
    return () => window.clearTimeout(id)
  }, [asked, done, demo.offline])

  useEffect(() => {
    if (!listening || demo.offline) return
    const id = window.setTimeout(() => {
      setListening(false)
      setText(EXAMPLE_QUERIES[0])
      setAsked(EXAMPLE_QUERIES[0])
      setDone(0)
      setExpanded(false)
      setShowAll(false)
    }, 2000)
    return () => window.clearTimeout(id)
  }, [listening, demo.offline])

  const submit = (q = text) => {
    if (!q.trim()) return input.current?.focus()
    setText(q)
    setListening(false)
    setExpanded(false)
    setShowAll(false)
    setDone(0)
    setAsked(demo.offline ? null : q.trim())
  }

  return (
    <Screen
      bar={<TopBar title="Find it" sub="Search across all your trips" />}
      foot={
        <form className="sf-composer" onSubmit={(e) => { e.preventDefault(); submit() }}>
          <input ref={input} aria-label="Describe the item" value={listening ? '' : text} placeholder={listening ? 'Listening…' : 'e.g. the jacket at the blue tarp stall'} onChange={(e) => setText(e.target.value)} data-listening={listening || undefined} />
          <button type="button" className="sf-iconbtn" data-tone={listening ? 'filled' : undefined} aria-label={listening ? 'Stop listening' : 'Speak'} onClick={() => { if (!demo.offline) setListening((l) => !l) }}>
            <I icon={Mic} size={20} />
          </button>
          <button type="submit" className="sf-iconbtn" data-tone="filled" aria-label="Find"><I icon={ArrowUp} size={20} /></button>
        </form>
      }
    >
      {demo.offline ? (
        <div className="sf-pad">
          <Offline text="Finding photos needs a connection. Your saved trips are still available." onRetry={() => submit(text || EXAMPLE_QUERIES[0])} />
          <Button onClick={() => push({ name: 'trips' })}>Browse your trips</Button>
        </div>
      ) : listening ? (
        <div className="sf-pad" role="status"><div className="sf-query">Listening…</div><div className="sf-fineprint">Describe what you remember. Search starts automatically when you finish speaking.</div></div>
      ) : !asked ? (
        <div className="sf-pad">
          <div className="sf-hint">Try one of these</div>
          <div className="sf-suggest">{EXAMPLE_QUERIES.map((q) => <button key={q} type="button" className="sf-suggest__item" onClick={() => submit(q)}>{q}</button>)}</div>
          <div className="sf-fineprint">Your words and shop summaries from all trips, including your notes, are sent to find the photo. Photos of you and location coordinates are never part of this search.</div>
        </div>
      ) : (
        <div className="sf-pad">
          <div className="sf-query">{asked}</div>
          {complete && <button type="button" className="sf-suggest__item" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>{matches.length ? `${matches.length} photos found` : 'No matching photos'} · {expanded ? 'Hide steps' : 'Show steps'} <I icon={ChevronDown} size={16} /></button>}
          {(!complete || expanded) && <div className="sf-steps">{steps.map((s, i) => (
            <Collapse key={i} open={i <= done} reveal="drop">
              <div className="sf-step" data-done={i < done || undefined}>
                <Check on={i < done} pending={i === done} size={18} />
                <div><div className="sf-step__title">{s.title}</div><div className="sf-step__detail">{s.detail}</div></div>
              </div>
            </Collapse>
          ))}</div>}
          {complete && (matches.length ? (
            <div className="sf-results">
              {(showAll ? matches : matches.slice(0, 3)).map((ph, i) => {
                const top = ph.candidates[0]
                return <button key={ph.id} type="button" className="sf-result" onClick={() => push({ name: 'pick', photoId: ph.id, mode: 'shop', concept: found!.concept })}>
                  <div className="sf-result__shot"><Shot photo={ph} candidates={top ? [top] : []} selected={top?.id} /></div>
                  <div className="sf-result__body"><div className="sf-result__title">{i === 0 ? 'Best match' : `Match ${i + 1}`}</div><div className="sf-result__meta">{shop(ph.shop)?.name} · {trip(ph.trip)?.date} · {ph.time} · {ph.candidates.length} items</div></div>
                  <I icon={ChevronRight} size={20} className="sf-chev" />
                </button>
              })}
              {!showAll && matches.length > 3 && <Button onClick={() => setShowAll(true)}>Show all ({matches.length})</Button>}
            </div>
          ) : (
            <div className="sf-results">
              <div className="sf-hint">We couldn’t find that item in your trips.</div>
              <div className="sf-fineprint">Try a color, a type of clothing, or something you remember about the shop.</div>
              <Button onClick={() => { setAsked(null); setText(''); input.current?.focus() }}>Ask again</Button>
              <Button onClick={() => push({ name: 'trips' })}>Browse your trips</Button>
            </div>
          ))}
        </div>
      )}
    </Screen>
  )
}
