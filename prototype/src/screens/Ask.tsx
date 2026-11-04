import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronRight, Mic } from 'lucide-react'
import { Check, Collapse } from '../kit'
import { answer, EXAMPLE_QUERIES, photo, shop, SHOPS, PHOTOS } from '../data'
import { useNav, useStore } from '../state'
import { I, Screen, Shot, TopBar } from '../ui'

type Step = { title: string; detail: string }

export function Ask({ query: initial }: { query?: string }) {
  const { push } = useNav()
  const { say } = useStore()
  const [text, setText] = useState(initial ?? '')
  const [asked, setAsked] = useState<string | null>(null)
  const [done, setDone] = useState(0) // steps finished
  const [listening, setListening] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const found = asked ? answer(asked) : null
  const target = found ? shop(found.shop) : null

  const steps: Step[] = found && target
    ? [
        { title: 'Read today’s trip', detail: `${SHOPS.length} shops, ${PHOTOS.length} photos, 1:42–3:02 PM` },
        { title: `Narrowed to ${target.name}`, detail: `${target.time} · “${target.description}”` },
        { title: 'Searched its photos', detail: `${found.photos.length} close matches for “${found.concept}”` },
        { title: 'Outlined the items', detail: 'Pick the one you meant' },
      ]
    : []

  useEffect(() => {
    if (!asked || done >= steps.length) return
    const id = window.setTimeout(() => setDone((d) => d + 1), done === 0 ? 700 : 900)
    return () => window.clearTimeout(id)
  }, [asked, done, steps.length])

  useEffect(() => {
    if (!listening) return
    const id = window.setTimeout(() => {
      setListening(false)
      setText(EXAMPLE_QUERIES[0])
      say('Transcribed · edit it if needed')
    }, 1600)
    return () => window.clearTimeout(id)
  }, [listening, say])

  const submit = (q = text) => {
    if (!q.trim()) return input.current?.focus()
    setText(q)
    setAsked(q)
    setDone(0)
  }

  return (
    <Screen
      bar={<TopBar title="Find it" sub="Describe it the way you remember it" />}
      foot={
        <form
          className="sf-composer"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <input
            ref={input}
            value={listening ? '' : text}
            placeholder={listening ? 'Listening…' : 'e.g. the jacket at the blue tarp stall'}
            onChange={(e) => setText(e.target.value)}
            data-listening={listening || undefined}
          />
          <button type="button" className="sf-iconbtn" data-tone={listening ? 'filled' : undefined} aria-label="Speak" onClick={() => setListening((l) => !l)}>
            <I icon={Mic} size={20} />
          </button>
          <button type="submit" className="sf-iconbtn" data-tone="filled" aria-label="Find">
            <I icon={ArrowUp} size={20} />
          </button>
        </form>
      }
    >
      {!asked && (
        <div className="sf-pad">
          <div className="sf-hint">Try one of these</div>
          <div className="sf-suggest">
            {EXAMPLE_QUERIES.map((q) => (
              <button key={q} type="button" className="sf-suggest__item" onClick={() => submit(q)}>
                {q}
              </button>
            ))}
          </div>
          <div className="sf-fineprint">Your words and a short summary of today’s shops are sent to find the photo. Photos of you are never part of this.</div>
        </div>
      )}

      {asked && (
        <div className="sf-pad">
          <div className="sf-query">{asked}</div>
          <div className="sf-steps">
            {steps.map((s, i) => (
              <Collapse key={s.title} open={i <= done} reveal="drop">
                <div className="sf-step" data-done={i < done || undefined}>
                  <Check on={i < done} pending={i === done} size={18} />
                  <div>
                    <div className="sf-step__title">{s.title}</div>
                    <div className="sf-step__detail">{s.detail}</div>
                  </div>
                </div>
              </Collapse>
            ))}
          </div>

          <Collapse open={!!found && done >= steps.length} reveal="drop">
            <div className="sf-results">
              {found?.photos.map((id, i) => {
                const ph = photo(id)
                const top = ph.candidates[0]
                return (
                  <button key={id} type="button" className="sf-result" onClick={() => push({ name: 'pick', photoId: id, mode: 'shop', concept: found.concept })}>
                    <div className="sf-result__shot">
                      <Shot photo={ph} candidates={[top]} selected={top.id} />
                    </div>
                    <div className="sf-result__body">
                      <div className="sf-result__title">{i === 0 ? 'Best match' : `Match ${i + 1}`}</div>
                      <div className="sf-result__meta">
                        {shop(ph.shop).name} · {ph.time} · {ph.candidates.length} {ph.candidates.length === 1 ? 'item' : 'items'}
                      </div>
                    </div>
                    <I icon={ChevronRight} size={20} className="sf-chev" />
                  </button>
                )
              })}
            </div>
          </Collapse>
        </div>
      )}
    </Screen>
  )
}
