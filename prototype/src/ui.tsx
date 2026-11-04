import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { ArrowLeft, MapPin, type LucideIcon } from 'lucide-react'
import { Button, Spinner } from './kit'
import type { Box, Candidate, Img, Piece, Shop } from './data'
import { useNav, useStore } from './state'

/** One icon size and stroke for the whole app. */
export function I({ icon: Glyph, size = 22, className, style }: { icon: LucideIcon; size?: number; className?: string; style?: CSSProperties }) {
  return <Glyph size={size} strokeWidth={1.75} className={className} style={style} aria-hidden />
}

export function IconButton({ icon, label, onClick, tone }: { icon: LucideIcon; label: string; onClick?: () => void; tone?: 'filled' | 'tonal' }) {
  return (
    <button type="button" className="sf-iconbtn" data-tone={tone} aria-label={label} title={label} onClick={onClick}>
      <I icon={icon} />
    </button>
  )
}

export function TopBar({ title, sub, actions, back = true, onBack }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: boolean; onBack?: () => void }) {
  const { pop } = useNav()
  return (
    <div className="sf-topbar">
      {back && <IconButton icon={ArrowLeft} label="Back" onClick={onBack ?? pop} />}
      <div className="sf-topbar__title" data-back={back || undefined}>
        {title && <div className="sf-topbar__name">{title}</div>}
        {sub && <div className="sf-topbar__sub">{sub}</div>}
      </div>
      {actions && <div className="sf-topbar__actions">{actions}</div>}
    </div>
  )
}

/** A screen: a top bar, a scrolling body, and an optional action area pinned to the bottom. */
export function Screen({ bar, foot, children, dark, className }: { bar?: ReactNode; foot?: ReactNode; children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div className={`sf-screen${className ? ` ${className}` : ''}`} data-dark={dark || undefined}>
      {bar}
      <div className="sf-screen__body">{children}</div>
      {foot && <div className="sf-screen__foot">{foot}</div>}
    </div>
  )
}

export function Section({ title, action, children, flush }: { title: ReactNode; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className="sf-section" data-flush={flush || undefined}>
      <div className="sf-section__head">
        <div className="sf-section__title">{title}</div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className="sf-link" onClick={onClick}>
      {children}
    </button>
  )
}

/** A bottom sheet over the current screen, kept mounted so it slides both ways. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const { hush } = useStore()
  useEffect(() => {
    if (open) hush()
  }, [open, hush])
  return (
    <div className="sf-sheet" data-open={open || undefined} aria-hidden={!open}>
      <div className="sf-sheet__scrim" onClick={onClose} />
      <div className="sf-sheet__panel" role="dialog" aria-label={label}>
        <span className="sf-sheet__grip" aria-hidden />
        {children}
      </div>
    </div>
  )
}

/**
 * A tall bottom sheet (about three quarters of the screen) with its own scrolling body.
 * Drag the top part down to put it away; a short drag springs back.
 */
export function Drawer({ open, onClose, label, title, meta, children }: { open: boolean; onClose: () => void; label: string; title: ReactNode; meta?: ReactNode; children: ReactNode }) {
  const { hush } = useStore()
  const [drag, setDrag] = useState<{ dy: number; height: number } | null>(null)
  const grab = useRef<{ y: number; scale: number; height: number } | null>(null)
  useEffect(() => {
    if (open) hush()
  }, [open, hush])

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (!open || e.button !== 0) return
    const panel = e.currentTarget.parentElement
    if (!panel) return
    // The phone may be scaled on stage, so convert screen pixels to the panel's own.
    grab.current = { y: e.clientY, scale: panel.getBoundingClientRect().height / panel.offsetHeight || 1, height: panel.offsetHeight }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ dy: 0, height: panel.offsetHeight })
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const g = grab.current
    if (g) setDrag({ dy: Math.max(0, (e.clientY - g.y) / g.scale), height: g.height })
  }
  const up = () => {
    grab.current = null
    if (drag && drag.dy > Math.min(120, drag.height * 0.25)) onClose()
    setDrag(null)
  }

  const dragging = drag !== null && drag.dy > 0
  return (
    <div className="sf-sheet sf-drawer" data-open={open || undefined} aria-hidden={!open}>
      <div className="sf-sheet__scrim" onClick={onClose} style={drag && dragging ? { opacity: 1 - drag.dy / drag.height, transition: 'none' } : undefined} />
      <div className="sf-sheet__panel" role="dialog" aria-label={label} style={drag && dragging ? { transform: `translateY(${drag.dy}px)`, transition: 'none' } : undefined}>
        <div className="sf-drawer__head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="sf-sheet__grip" aria-hidden />
          <div className="sf-sheet__title">{title}</div>
          {meta && <div className="sf-drawer__meta">{meta}</div>}
        </div>
        <div className="sf-drawer__body">{children}</div>
      </div>
    </div>
  )
}

export function NoteSheet({ shop, onClose }: { shop: Shop; onClose: () => void }) {
  const { saveNote, say } = useStore()
  const [note, setNote] = useState(shop.note ?? '')
  return (
    <Sheet open onClose={onClose} label={`Note for ${shop.name}`}>
      <div className="sf-sheet__title">Note for {shop.name}</div>
      <div className="sf-sheet__text">Anything that helps you find it again.</div>
      <input className="sf-note-input" aria-label={`Note for ${shop.name}`} placeholder="e.g. cash only, army jackets at the back" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
      <div className="sf-sheet__actions">
        <Button size="large" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="large" data-disabled={!note.trim() || undefined} aria-disabled={!note.trim()} onClick={() => {
          if (!note.trim()) return
          saveNote(shop.id, note.trim())
          onClose()
          say('Note saved')
        }}>Save</Button>
      </div>
    </Sheet>
  )
}

export function LocationPermission({ onAllow, onDeny }: { onAllow: () => void; onDeny: () => void }) {
  return (
    <SystemPermission title="Allow Street Fitting to access this device's location?">
      <button type="button" onClick={onAllow}>While using the app</button>
      <button type="button" onClick={onAllow}>Only this time</button>
      <button type="button" onClick={onDeny}>Don't allow</button>
    </SystemPermission>
  )
}

export function SystemPermission({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="sf-permission">
      <div className="sf-permission__card" role="dialog" aria-modal="true" aria-label={title}>
        <I icon={MapPin} size={28} />
        <div className="sf-permission__title">{title}</div>
        <div className="sf-permission__choices">{children}</div>
      </div>
    </div>
  )
}

export function ShopImage({ shop, height = 160, thumb = false }: { shop: Shop; height?: number; thumb?: boolean }) {
  if (shop.storefront) return thumb
    ? <Thumb src={shop.storefront.src} size={height} />
    : <Storefront {...shop.storefront} height={height} />
  return <div className="sf-storefront sf-storefront--empty" data-thumb={thumb || undefined} style={{ height, width: thumb ? height : undefined }}>No storefront photo</div>
}

/** The storefront description, or where it is in Spark's queue. Offline it waits instead of spinning. */
export function ShopDescription({ shop }: { shop: Shop }) {
  const { demo } = useStore()
  if (shop.descriptionState === 'pending') return demo.offline
    ? <span className="sf-inline" data-state="queued">Will describe when you’re back online</span>
    : <span className="sf-inline"><Spinner size={12} /> Describing the storefront…</span>
  if (shop.descriptionState === 'failed') return <span className="sf-inline" data-state="failed">Couldn’t describe the storefront</span>
  return <>{shop.description}</>
}

/** In place of a result that needs the network. Local data stays usable around it. */
export function Offline({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div className="sf-offline" role="status">
      <div className="sf-offline__title">You’re offline</div>
      <div className="sf-offline__text">{text}</div>
      {onRetry && <Button size="medium" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

/** Confirmation before deleting something. One shape for trips, photos, pieces and looks. */
export function ConfirmSheet({ open, title, text, action = 'Delete', onConfirm, onClose }: { open: boolean; title: string; text: string; action?: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <div className="sf-sheet__title">{title}</div>
      <div className="sf-sheet__text">{text}</div>
      <div className="sf-sheet__actions">
        <Button size="large" onClick={onClose}>Cancel</Button>
        <Button variant="primary" size="large" className="sf-danger" onClick={() => {
          onConfirm()
          onClose()
        }}>{action}</Button>
      </div>
    </Sheet>
  )
}

/** The part of a photo inside `box`, fitted into a w × h tile. */
export function Crop({ src, w, h, box, width, height, fill = 0.88, className }: { src: string; w: number; h: number; box: Box; width: number; height: number; fill?: number; className?: string }) {
  const [bx, by, bw, bh] = box
  const rw = (bw / 100) * w
  const rh = (bh / 100) * h
  const s = Math.min(width / rw, height / rh) * fill
  return (
    <div className={`sf-crop${className ? ` ${className}` : ''}`} style={{ width, height }}>
      <div className="sf-crop__cut" style={{ width: rw * s, height: rh * s }}>
        <img src={src} alt="" draggable={false} style={{ width: w * s, height: h * s, left: -(bx / 100) * w * s, top: -(by / 100) * h * s }} />
      </div>
    </div>
  )
}

export function PieceTile({ piece, size = 112, onClick, selected, children }: { piece: Piece; size?: number; onClick?: () => void; selected?: boolean; children?: ReactNode }) {
  return (
    <button type="button" className="sf-piece" data-selected={selected || undefined} onClick={onClick} style={{ width: size }}>
      <Crop src={piece.src} w={piece.w} h={piece.h} box={piece.box} width={size} height={size} />
      <span className="sf-piece__label">{piece.label}</span>
      {children}
    </button>
  )
}

/**
 * A photo at its own proportions with candidate outlines over it. The selected
 * candidate stays lit and the rest of the photo dims around it.
 */
export function Shot({
  photo,
  candidates,
  selected,
  onSelect,
  onTap,
  tap,
}: {
  photo: Img
  candidates: Candidate[]
  selected?: string
  onSelect?: (id: string) => void
  onTap?: (x: number, y: number) => void
  tap?: { x: number; y: number } | null
}) {
  const click = (e: MouseEvent<HTMLDivElement>) => {
    if (!onTap) return
    const r = e.currentTarget.getBoundingClientRect()
    onTap(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100)
  }
  return (
    <div className="sf-shot" style={{ aspectRatio: `${photo.w} / ${photo.h}` }} onClick={click} data-tapping={onTap ? '' : undefined}>
      <img src={photo.src} alt="" draggable={false} />
      {candidates.map((c, i) => {
        const [x, y, w, h] = c.box
        const on = c.id === selected
        return (
          <button
            key={c.id}
            type="button"
            className="sf-shot__box"
            data-on={on || undefined}
            data-dim={selected && !on ? '' : undefined}
            style={{ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` }}
            onClick={(e) => {
              if (onTap) return
              e.stopPropagation()
              onSelect?.(c.id)
            }}
            aria-label={c.label}
          >
            <span className="sf-shot__tag">{i + 1}</span>
          </button>
        )
      })}
      {tap && <span className="sf-shot__tap" style={{ left: `${tap.x}%`, top: `${tap.y}%` }} />}
    </div>
  )
}

export function Storefront({ src, w, h, height = 160, className }: { src: string; w: number; h: number; height?: number; className?: string }) {
  return (
    <div className={`sf-storefront${className ? ` ${className}` : ''}`} style={{ height }}>
      <img src={src} alt="" draggable={false} data-w={w} data-h={h} />
    </div>
  )
}

export function Thumb({ src, size = 48, round }: { src: string; size?: number; round?: boolean }) {
  return <img className="sf-thumb" src={src} alt="" draggable={false} style={{ width: size, height: size, borderRadius: round ? size / 2 : undefined }} />
}
