import { useEffect, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import { ArrowLeft, type LucideIcon } from 'lucide-react'
import type { Box, Candidate, Photo, Piece } from './data'
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
  photo: Photo
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
