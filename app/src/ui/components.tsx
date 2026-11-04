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
import {Thumbnail as AstryxThumbnail} from '@astryxdesign/core/Thumbnail';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useUi} from './state';
import {useImageUrl} from './images';
import {ImageIcon} from './icons';
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
    <Text type="large" weight="semibold" hasTabularNumbers style={{color: onHero ? 'var(--color-on-hero)' : undefined}}>{value}</Text>
    <Text type="supporting" size="xsm" style={{color: onHero ? 'color-mix(in srgb, var(--color-on-hero) 72%, transparent)' : undefined}}>{label}</Text>
  </VStack>;
}

/** Image from a saved FileRef, cropped to fill its box. */
export function Media({file, label, width, height, ratio, radius = 'var(--radius-element)', fit = 'cover'}: {file?: string | null; label: string; width?: string; height?: string; ratio?: string; radius?: string; fit?: 'cover' | 'contain'}) {
  const image = useImageUrl(file ?? undefined);
  return <VStack align="center" justify="center" width={width ?? '100%'} height={height} style={{aspectRatio: ratio, flexShrink: 0, overflow: 'hidden', borderRadius: radius, background: 'var(--color-background-muted)', color: 'var(--color-text-secondary)'}}>
    {image?.url ? <img src={image.url} alt={label} style={{width: '100%', height: '100%', objectFit: fit, display: 'block'}}/> : <Icon icon={ImageIcon} size="md"/>}
  </VStack>;
}

const rowStyle: CSSProperties = {height: 'auto', minHeight: 'var(--spacing-12)', paddingBlock: 'var(--spacing-3)', paddingInline: 'var(--spacing-3)', borderRadius: 'var(--radius-container)', background: 'var(--color-background-card)', boxShadow: 'var(--shadow-low)', textAlign: 'start', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', alignItems: 'center', fontWeight: 'var(--font-weight-normal)'};

/**
 * A full-width, card-like row that is one button. `label` stays the accessible name;
 * `title`/`meta` are what sighted users see.
 */
export function RowButton({label, title, meta, start, end, onClick, isDisabled, flat = false, pressed}: {label: string; title?: ReactNode; meta?: ReactNode; start?: ReactNode; end?: ReactNode; onClick: () => void; isDisabled?: boolean; flat?: boolean; pressed?: boolean}) {
  const selected: CSSProperties = pressed ? {boxShadow: '0 0 0 calc(var(--spacing-1) / 2) var(--color-accent)', background: 'color-mix(in srgb, var(--color-accent-muted) 45%, var(--color-background-card))'} : {};
  return <Button label={label} variant="ghost" width="100%" onClick={onClick} isDisabled={isDisabled} aria-pressed={pressed} style={flat ? {...rowStyle, background: 'transparent', boxShadow: 'none', paddingInline: 0} : {...rowStyle, ...selected}}>
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
  return <Button label={label} variant="ghost" width="100%" onClick={onClick} style={{...rowStyle, padding: 'var(--spacing-2)', alignItems: 'stretch'}}>
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
  return <Card padding={6} variant="muted" style={{borderRadius: 'var(--radius-container)', boxShadow: 'none', border: 'thin dashed var(--color-border)'}}>
    <VStack gap={3} align="center" style={{textAlign: 'center'}}>
      <IconTile icon={icon} tone="muted" size="lg"/>
      <Heading level={3}>{title}</Heading>
      {children}
    </VStack>
  </Card>;
}

export function Problem({message, retry}: {message: string; retry?: () => void}) {
  return <HStack role="alert" gap={3} vAlign="start" paddingInline={4} paddingBlock={3} style={{background: 'var(--color-error-muted)', color: 'var(--color-on-error-muted)', borderRadius: 'var(--radius-container)'}}>
    <Icon icon="warning" size="md" color="inherit" style={{flexShrink: 0}}/>
    <VStack gap={3} style={{flex: 1, minWidth: 0}}>
      <Text color="inherit">{message}</Text>
      {retry && <Button label="Try again" variant="secondary" size="sm" onClick={retry} style={{alignSelf: 'flex-start'}}/>}
    </VStack>
  </HStack>;
}

export function Loading({label = 'Loading…'}: {label?: string}) {
  return <HStack gap={2} vAlign="center" paddingBlock={2}><Spinner size="md" aria-label={label}/><Text type="supporting">{label}</Text></HStack>;
}

export function PhotoView({file, label}: {file: string; label: string}) {
  const image = useImageUrl(file);
  if (image?.failed) return <Problem message="This saved image could not be opened."/>;
  if (!image?.url) return <VStack align="center" justify="center" width="100%" height="30dvh" style={{background: 'var(--color-background-muted)', borderRadius: 'var(--radius-container)'}}><Loading/></VStack>;
  return <VStack align="center" width="100%" style={{background: 'var(--color-background-muted)', borderRadius: 'var(--radius-container)', overflow: 'hidden', boxShadow: 'var(--shadow-low)'}}>
    <img src={image.url} alt={label} style={{width: '100%', maxHeight: '60dvh', objectFit: 'contain', display: 'block'}}/>
  </VStack>;
}

export function Action({label, run, variant = 'primary', disabled = false, icon, size, width, style}: {label: string; run: () => Promise<unknown>; variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'; disabled?: boolean; icon?: ReactNode; size?: 'sm' | 'md' | 'lg'; width?: string; style?: CSSProperties}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  return <><Button label={label} variant={variant} icon={icon} size={size} width={width} style={style} isDisabled={disabled || busy} isLoading={busy} onClick={() => {if (pending.current || disabled) return; pending.current = true; setBusy(true); setError(null); void run().catch((cause: unknown) => {const code = typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : ''; setError(code === 'offline' ? 'You’re offline. Connect and try again.' : 'That didn’t work. Please try again.');}).finally(() => {pending.current = false; setBusy(false);});}}/>{error && <Problem message={error}/>}</>;
}

export function Confirm({title, description, action, onConfirm, tone = 'danger', style, icon}: {title: string; description: string; action: string; onConfirm: () => Promise<unknown>; tone?: 'danger' | 'plain'; style?: CSSProperties; icon?: ReactNode}) {
  const {showSheet} = useUi();
  return <Button label={action} variant="ghost" icon={icon} style={{...(tone === 'danger' ? {color: 'var(--color-text-error)'} : {}), ...style}} onClick={() => showSheet({title, content: <VStack gap={4}><Text>{description}</Text><Action label={action} variant="destructive" run={async () => {await onConfirm(); showSheet(null);}}/><Button label="Cancel" variant="secondary" onClick={() => showSheet(null)}/></VStack>})}/>;
}

export function EditFields({label, category, onSave}: {label: string; category?: string; onSave: (label: string, category: string) => Promise<unknown>}) {
  const [name, setName] = useState(label); const [kind, setKind] = useState(category ?? ''); const {showSheet, say} = useUi();
  return <VStack gap={4}>{category === undefined && <Text type="supporting">Anything that helps you find it again.</Text>}<TextInput label={category === undefined ? 'Note' : 'Name'} placeholder={category === undefined ? 'e.g. cash only, army jackets at the back' : undefined} value={name} onChange={setName}/>{category !== undefined && <TextInput label="Category" value={kind} onChange={setKind}/>}<Action label="Save" disabled={!name.trim()} run={async () => {await onSave(name.trim(), kind.trim()); showSheet(null); say(category === undefined ? 'Note saved' : 'Changes saved');}}/><Button label="Cancel" variant="secondary" onClick={() => showSheet(null)}/></VStack>;
}
