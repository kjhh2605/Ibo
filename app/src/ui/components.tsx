import {useEffect, useRef, useState} from 'react';
import type {ComponentProps, ComponentType, CSSProperties, ReactNode, SVGProps} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Card} from '@astryxdesign/core/Card';
import {Icon} from '@astryxdesign/core/Icon';
import {Spinner} from '@astryxdesign/core/Spinner';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Grid} from '@astryxdesign/core/Grid';
import {Thumbnail as AstryxThumbnail} from '@astryxdesign/core/Thumbnail';
import {TextInput} from '@astryxdesign/core/TextInput';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {categoryNames, pieceCategory} from '../category';
import type {PieceCategory} from '../category';
import {useUi} from './state';
import {useImageUrl} from './images';
import {ImageIcon} from './icons';
import {CountUp, Pop, Reveal} from './motion';
import {pressFeedback, useFadeIn} from './easing';
export {Reveal, Pop};
export {Button, VStack, HStack, Heading, Text, TextInput, Card, Icon};

type Glyph = ComponentType<SVGProps<SVGSVGElement>> | 'search' | 'microphone' | 'info' | 'check' | 'warning' | 'clock' | 'calendar' | 'chevronRight';
type Tone = 'accent' | 'hero' | 'muted' | 'success' | 'warning';

export function Thumbnail({src, ...props}: ComponentProps<typeof AstryxThumbnail>) {
  const image = useImageUrl(src);
  return <AstryxThumbnail {...props} src={image?.url}/>;
}

/** Rounded square holding one icon. Used to give rows and empty states a quiet visual anchor. */
export function IconTile({icon, tone = 'accent', size = 'md'}: {icon: Glyph; tone?: Tone; size?: 'sm' | 'md' | 'lg'}) {
  const box = size === 'lg' ? 'var(--spacing-12)' : size === 'sm' ? 'var(--spacing-8)' : 'var(--spacing-10)';
  const colors: Record<Tone, CSSProperties> = {
    accent: {background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)'},
    hero: {background: 'var(--color-hero)', color: 'var(--color-on-hero)'},
    muted: {background: 'var(--color-background-muted)', color: 'var(--color-text-secondary)'},
    success: {background: 'var(--color-success-muted)', color: 'var(--color-on-success-muted)'},
    warning: {background: 'var(--color-warning-muted)', color: 'var(--color-on-warning-muted)'},
  };
  return <VStack aria-hidden align="center" justify="center" width={box} height={box} style={{...colors[tone], flexShrink: 0, borderRadius: 'var(--radius-element)'}}><Icon icon={icon} size={size === 'lg' ? 'lg' : 'md'}/></VStack>;
}

/** Small uppercase label above a heading. */
export function Eyebrow({children, color}: {children: ReactNode; color?: string}) {
  return <Text type="label" size="xsm" weight="semibold" style={{letterSpacing: '0.08em', textTransform: 'uppercase', color: color ?? 'var(--color-text-secondary)'}}>{children}</Text>;
}

/** Rounded status chip (dot + text). Decorative state, not a button. */
export function Chip({children, tone = 'muted', live = false}: {children: ReactNode; tone?: 'muted' | 'accent' | 'success' | 'onHero'; live?: boolean}) {
  const colors = {
    muted: {background: 'var(--color-background-muted)', color: 'var(--color-text-secondary)'},
    accent: {background: 'var(--color-accent-muted)', color: 'var(--color-text-accent)'},
    success: {background: 'var(--color-success-muted)', color: 'var(--color-on-success-muted)'},
    onHero: {background: 'color-mix(in srgb, var(--color-on-hero) 16%, transparent)', color: 'var(--color-on-hero)'},
  }[tone];
  return <HStack as="span" gap={1.5} vAlign="center" paddingInline={3} paddingBlock={1} style={{...colors, borderRadius: 'var(--radius-full)', alignSelf: 'flex-start', width: 'fit-content'}}>
    {live && <LiveDot/>}
    <Text type="label" size="xsm" weight="semibold" color="inherit">{children}</Text>
  </HStack>;
}

function LiveDot() {
  const dot = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = dot.current?.animate([{opacity: 1}, {opacity: 0.35}, {opacity: 1}], {duration: 1600, iterations: Infinity, easing: 'ease-in-out'});
    return () => animation?.cancel();
  }, []);
  return <VStack as="span" ref={dot} aria-hidden width="var(--spacing-2)" height="var(--spacing-2)" style={{borderRadius: 'var(--radius-full)', background: 'currentColor'}}/>;
}

/** Number + caption pair used in stat rows. */
export function Stat({value, label, onHero = false}: {value: ReactNode; label: string; onHero?: boolean}) {
  return <VStack gap={0.5} style={{flex: 1, minWidth: 0}}>
    <Text type="large" weight="semibold" hasTabularNumbers style={{color: onHero ? 'var(--color-on-hero)' : undefined}}>{typeof value === 'number' ? <CountUp value={value}/> : value}</Text>
    <Text type="supporting" size="xsm" style={{color: onHero ? 'color-mix(in srgb, var(--color-on-hero) 72%, transparent)' : undefined}}>{label}</Text>
  </VStack>;
}

/** Image from a saved FileRef, cropped to fill its box. */
export function Media({file, label, width, height, ratio, radius = 'var(--radius-element)', fit = 'cover'}: {file?: string | null; label: string; width?: string; height?: string; ratio?: string; radius?: string; fit?: 'cover' | 'contain'}) {
  const image = useImageUrl(file ?? undefined);
  const fade = useFadeIn();
  return <VStack align="center" justify="center" width={width ?? '100%'} height={height} style={{aspectRatio: ratio, flexShrink: 0, overflow: 'hidden', borderRadius: radius, background: 'var(--color-background-muted)', color: 'var(--color-text-secondary)', position: 'relative'}}>
    {image?.url ? <img src={image.url} alt={label} onLoad={fade.onLoad} style={{width: '100%', height: '100%', objectFit: fit, display: 'block', ...fade.style}}/> : image?.failed || !file ? <Icon icon={ImageIcon} size="md"/> : <Skeleton radius="none"/>}
  </VStack>;
}

const rowStyle: CSSProperties = {height: 'auto', minHeight: 'var(--spacing-12)', paddingBlock: 'var(--spacing-3)', paddingInline: 'var(--spacing-3)', borderRadius: 'var(--radius-container)', background: 'var(--color-background-card)', boxShadow: 'var(--shadow-low)', textAlign: 'start', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignItems: 'center', fontWeight: 'var(--font-weight-normal)'};

/**
 * A full-width, card-like row that is one button. `label` stays the accessible name;
 * `title`/`meta` are what sighted users see.
 */
export function RowButton({label, title, meta, start, end, onClick, isDisabled, flat = false, pressed}: {label: string; title?: ReactNode; meta?: ReactNode; start?: ReactNode; end?: ReactNode; onClick: () => void; isDisabled?: boolean; flat?: boolean; pressed?: boolean}) {
  const selected: CSSProperties = pressed ? {boxShadow: '0 0 0 calc(var(--spacing-1) / 2) var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent-muted) 45%, var(--color-background-card))'} : {};
  return <Button label={label} variant="ghost" width="100%" onClick={onClick} isDisabled={isDisabled} aria-pressed={pressed} {...pressFeedback} style={flat ? {...rowStyle, background: 'transparent', boxShadow: 'none', paddingInline: 0} : {...rowStyle, ...selected}}>
    <HStack gap={3} vAlign="center" width="100%">
      {start}
      <VStack gap={0.5} style={{flex: 1, minWidth: 0}}>
        <Text type="label" weight="semibold" maxLines={1} hasTruncateTooltip={false}>{title ?? label}</Text>
        {meta && <Text type="supporting" size="sm" display="block">{meta}</Text>}
      </VStack>
      {end ?? <Icon icon="chevronRight" size="sm" color="secondary"/>}
    </HStack>
  </Button>;
}

/** Visual-only tile button for grids (pieces, quick actions). */
export function TileButton({label, onClick, children}: {label: string; onClick: () => void; children: ReactNode}) {
  return <Button label={label} variant="ghost" width="100%" onClick={onClick} {...pressFeedback} style={{...rowStyle, padding: 'var(--spacing-2)', alignItems: 'stretch'}}>
    <VStack gap={2} width="100%">{children}</VStack>
  </Button>;
}

/** Grouped surface for related content on a page. */
export function Panel({children, gap = 4, padding = 4, tone = 'card'}: {children: ReactNode; gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6; padding?: 3 | 4 | 5 | 6; tone?: 'card' | 'muted'}) {
  return <Card padding={padding} variant={tone === 'muted' ? 'muted' : 'default'} style={{borderRadius: 'var(--radius-container)'}}><VStack gap={gap}>{children}</VStack></Card>;
}

export function Section({title, children, eyebrow, action, description}: {title: string; children: ReactNode; eyebrow?: ReactNode; action?: ReactNode; description?: ReactNode}) {
  return <VStack as="section" gap={3}>
    <HStack gap={3} vAlign="end" hAlign="between">
      <VStack gap={1} style={{minWidth: 0}}>{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}<Heading level={2}>{title}</Heading></VStack>
      {action}
    </HStack>
    {description && <Text type="supporting">{description}</Text>}
    {children}
  </VStack>;
}

/** One quiet line of supporting context with an icon. */
export function Hint({children, icon = 'info'}: {children: ReactNode; icon?: Glyph}) {
  return <HStack gap={2} vAlign="start" style={{color: 'var(--color-text-secondary)'}}><Icon icon={icon} size="sm" color="inherit" style={{marginTop: 'calc(var(--spacing-1) / 2)', flexShrink: 0}}/><Text type="supporting" size="sm">{children}</Text></HStack>;
}

export function Empty({title, children, icon = ImageIcon}: {title: string; children?: ReactNode; icon?: Glyph}) {
  return <Reveal from="scale"><Card padding={6} variant="muted" style={{borderRadius: 'var(--radius-container)', boxShadow: 'none', border: 'thin dashed var(--color-border)'}}>
    <VStack gap={3} align="center" style={{textAlign: 'center'}}>
      <IconTile icon={icon} tone="muted" size="lg"/>
      <Heading level={3}>{title}</Heading>
      {children}
    </VStack>
  </Card></Reveal>;
}

export function Problem({message, retry}: {message: string; retry?: () => void}) {
  return <Reveal><HStack role="alert" gap={3} vAlign="start" paddingInline={4} paddingBlock={3} style={{background: 'var(--color-error-muted)', color: 'var(--color-on-error-muted)', borderRadius: 'var(--radius-container)'}}>
    <Icon icon="warning" size="md" color="inherit" style={{flexShrink: 0}}/>
    <VStack gap={3} style={{flex: 1, minWidth: 0}}>
      <Text color="inherit">{message}</Text>
      {retry && <Button label="Try again" variant="secondary" size="sm" onClick={retry} style={{alignSelf: 'flex-start'}}/>}
    </VStack>
  </HStack></Reveal>;
}

export function Loading({label = 'Loading…'}: {label?: string}) {
  return <HStack gap={2} vAlign="center" paddingBlock={2}><Spinner size="md" aria-label={label}/><Text type="supporting">{label}</Text></HStack>;
}

export function PhotoView({file, label}: {file: string; label: string}) {
  const image = useImageUrl(file);
  const fade = useFadeIn();
  if (image?.failed) return <Problem message="Couldn’t open this image."/>;
  if (!image?.url) return <SkeletonPhoto/>;
  return <VStack align="center" width="100%" style={{background: 'var(--color-background-muted)', borderRadius: 'var(--radius-container)', overflow: 'hidden', boxShadow: 'var(--shadow-low)'}}>
    <img src={image.url} alt={label} onLoad={fade.onLoad} style={{width: '100%', maxHeight: '60dvh', objectFit: 'contain', display: 'block', ...fade.style}}/>
  </VStack>;
}

/** `label` is the accessible name; `text` (optional) is shorter visible copy. */
export function Action({label, text, run, variant = 'primary', disabled = false, icon, size, width, style}: {label: string; text?: string; run: () => Promise<unknown>; variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'; disabled?: boolean; icon?: ReactNode; size?: 'sm' | 'md' | 'lg'; width?: string; style?: CSSProperties}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  return <><Button label={label} variant={variant} icon={icon} size={size} width={width} style={style} isDisabled={disabled || busy} isLoading={busy} onClick={() => {if (pending.current || disabled) return; pending.current = true; setBusy(true); setError(null); void run().catch((cause: unknown) => {const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : ''; setError(code === 'offline' ? 'You’re offline. Connect and try again.' : 'That didn’t work. Please try again.');}).finally(() => {pending.current = false; setBusy(false);});}}>{text}</Button>{error && <Problem message={error}/>}</>;
}

export function Confirm({title, description, action, onConfirm, tone = 'danger', style, icon}: {title: string; description: string; action: string; onConfirm: () => Promise<unknown>; tone?: 'danger' | 'plain'; style?: CSSProperties; icon?: ReactNode}) {
  const {showSheet} = useUi();
  return <Button label={action} variant="ghost" icon={icon} style={{...(tone === 'danger' ? {color: 'var(--color-text-error)'} : {}), ...style}} onClick={() => showSheet({title, content: <VStack gap={4}><Text>{description}</Text><Action label={action} variant="destructive" run={async () => {await onConfirm(); showSheet(null);}}/><Button label="Cancel" variant="secondary" onClick={() => showSheet(null)}/></VStack>})}/>;
}

/** Outer / Top / Bottom fill mannequin slots; Other is anything that can't be tried on. */
export function CategoryPicker({value, onChange}: {value: PieceCategory; onChange: (value: PieceCategory) => void}) {
  return <VStack gap={1}><Text type="label" weight="semibold">Kind</Text><SegmentedControl label="Kind of piece" value={value} layout="fill" onChange={next => onChange(pieceCategory(next))}>{(['outer', 'top', 'bottom', 'other'] as const).map(kind => <SegmentedControlItem key={kind} value={kind} label={categoryNames[kind]}/>)}</SegmentedControl>{value === 'other' && <Text type="supporting" size="sm">Only outer layers, tops and bottoms can be tried on.</Text>}</VStack>;
}

export function EditFields({label, category, onSave}: {label: string; category?: string; onSave: (label: string, category: string) => Promise<unknown>}) {
  const [name, setName] = useState(label); const [kind, setKind] = useState<PieceCategory>(pieceCategory(category ?? '')); const {showSheet, say} = useUi();
  return <VStack gap={4}>{category === undefined && <Text type="supporting">Anything that helps you find it again.</Text>}<TextInput label={category === undefined ? 'Note' : 'Name'} placeholder={category === undefined ? 'e.g. cash only, army jackets at the back' : undefined} value={name} onChange={setName}/>{category !== undefined && <CategoryPicker value={kind} onChange={setKind}/>}<Action label="Save" disabled={!name.trim()} run={async () => {await onSave(name.trim(), kind); showSheet(null); say(category === undefined ? 'Note saved' : 'Changes saved');}}/><Button label="Cancel" variant="secondary" onClick={() => showSheet(null)}/></VStack>;
}

/** Keeps a screen's main action within thumb reach at the bottom while the page scrolls. */
export function StickyBar({children}: {children: ReactNode}) {
  return <VStack gap={2} paddingBlock={3} style={{position: 'sticky', bottom: 'calc(-1 * var(--spacing-5))', zIndex: 5, marginInline: 'calc(-1 * var(--spacing-5))', marginBottom: 'calc(-1 * var(--spacing-10))', paddingInline: 'var(--spacing-5)', paddingBottom: 'calc(var(--spacing-5) + var(--spacing-3))', background: 'var(--color-background-surface)', borderTop: 'thin solid var(--color-border)'}}>{children}</VStack>;
}

/* ---------- Skeletons: same footprint as the content they stand in for ---------- */

/** Screen-reader announcement for a skeleton block (the shapes themselves are decorative). */
function Busy({label, children}: {label: string; children: ReactNode}) {
  return <VStack role="status" aria-busy aria-label={label} gap={2}>{children}</VStack>;
}
export function SkeletonText({lines = 2, width = '70%', index = 0}: {lines?: number; width?: string; index?: number}) {
  return <VStack gap={1.5} width="100%">{Array.from({length: lines}, (_, line) => <Skeleton key={line} index={index + line} height="var(--spacing-3)" width={line === lines - 1 && lines > 1 ? '45%' : width} radius="rounded"/>)}</VStack>;
}
export function SkeletonPhoto({height = '36dvh', label = 'Loading photo'}: {height?: string; label?: string}) {
  return <Busy label={label}><VStack width="100%" height={height} style={{borderRadius: 'var(--radius-container)', overflow: 'hidden'}}><Skeleton radius="none"/></VStack></Busy>;
}
/** Card rows with a leading tile and two text lines (trips, shops, pieces, looks). */
export function SkeletonRows({count = 3, media = 'var(--spacing-10)', label = 'Loading…', flat = false}: {count?: number; media?: string; label?: string; flat?: boolean}) {
  return <Busy label={label}>{Array.from({length: count}, (_, index) => <HStack key={index} gap={3} vAlign="center" padding={flat ? 0 : 3} paddingBlock={flat ? 2 : 3} style={flat ? undefined : {background: 'var(--color-background-card)', borderRadius: 'var(--radius-container)', boxShadow: 'var(--shadow-low)'}}>
    <VStack width={media} height={media} style={{flexShrink: 0}}><Skeleton index={index} radius={2}/></VStack>
    <VStack gap={2} style={{flex: 1}}><Skeleton index={index} height="var(--spacing-4)" width="55%" radius="rounded"/><Skeleton index={index} height="var(--spacing-3)" width="80%" radius="rounded"/></VStack>
  </HStack>)}</Busy>;
}
/** Square tiles in a grid (saved pieces, garment photos). */
export function SkeletonGrid({count = 4, columns = 2, captions = true, label = 'Loading…'}: {count?: number; columns?: number; captions?: boolean; label?: string}) {
  return <Busy label={label}><Grid columns={columns} gap={captions ? 3 : 2}>{Array.from({length: count}, (_, index) => <VStack key={index} gap={2} padding={captions ? 2 : 0} style={captions ? {background: 'var(--color-background-card)', borderRadius: 'var(--radius-container)', boxShadow: 'var(--shadow-low)'} : undefined}>
    <VStack width="100%" style={{aspectRatio: '1'}}><Skeleton index={index} radius={2}/></VStack>
    {captions && <VStack gap={1.5} paddingInline={1}><Skeleton index={index} height="var(--spacing-3)" width="70%" radius="rounded"/><Skeleton index={index} height="var(--spacing-2)" width="45%" radius="rounded"/></VStack>}
  </VStack>)}</Grid></Busy>;
}
/** A card with a header row, a photo and an action (search results, shop sections). */
export function SkeletonCard({index = 0, photo = '30dvh', label = 'Loading…'}: {index?: number; photo?: string; label?: string}) {
  return <Busy label={label}><VStack gap={3} padding={3} style={{background: 'var(--color-background-card)', borderRadius: 'var(--radius-container)', boxShadow: 'var(--shadow-low)'}}>
    <HStack gap={3} vAlign="center"><VStack width="var(--spacing-8)" height="var(--spacing-8)" style={{flexShrink: 0}}><Skeleton index={index} radius={2}/></VStack><VStack gap={2} style={{flex: 1}}><Skeleton index={index} height="var(--spacing-3)" width="40%" radius="rounded"/><Skeleton index={index} height="var(--spacing-2)" width="65%" radius="rounded"/></VStack></HStack>
    <VStack width="100%" height={photo}><Skeleton index={index} radius={2}/></VStack>
    <Skeleton index={index} height="var(--spacing-9)" radius="rounded"/>
  </VStack></Busy>;
}
