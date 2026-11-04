// Motion primitives. Everything uses the Web Animations API on an element ref, so no stylesheet
// is needed, and every effect is skipped when the person asks for reduced motion.
import {useEffect, useRef, useState} from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {EASE_OUT, EASE_SPRING, reducedMotion} from './easing';
import {VStack} from '@astryxdesign/core/VStack';


/** Fades and lifts its content in once, on mount. `index` staggers siblings (capped so long lists stay quick). */
export function Reveal({children, index = 0, gap, from = 'below', style}: {children: ReactNode; index?: number; gap?: 0 | 1 | 2 | 3 | 4; from?: 'below' | 'scale'; style?: CSSProperties}) {
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const start = from === 'scale' ? 'scale(0.96)' : 'translateY(0.75rem)';
    const animation = element.current?.animate([{opacity: 0, transform: start}, {opacity: 1, transform: 'none'}], {duration: 320, delay: Math.min(index, 8) * 45, easing: EASE_OUT, fill: 'backwards'});
    return () => animation?.cancel();
  }, [index, from]);
  return <VStack ref={element} gap={gap} style={style}>{children}</VStack>;
}

/** Springs its content in on mount (selection checks, badges). */
export function Pop({children}: {children: ReactNode}) {
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const animation = element.current?.animate([{transform: 'scale(0.4)', opacity: 0}, {transform: 'scale(1)', opacity: 1}], {duration: 280, easing: EASE_SPRING});
    return () => animation?.cancel();
  }, []);
  return <VStack as="span" ref={element} align="center" justify="center">{children}</VStack>;
}

/** Endless soft opacity breathing, for "in progress" segments. */
export function Breathe({children, style}: {children?: ReactNode; style?: CSSProperties}) {
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const animation = element.current?.animate([{opacity: 1}, {opacity: 0.45}, {opacity: 1}], {duration: 1400, iterations: Infinity, easing: 'ease-in-out'});
    return () => animation?.cancel();
  }, []);
  return <VStack ref={element} style={style}>{children}</VStack>;
}

/** A light sweep across a bar, for indeterminate progress. */
export function Sweep({style}: {style?: CSSProperties}) {
  const element = useRef<HTMLElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    const animation = element.current?.animate([{transform: 'translateX(-100%)'}, {transform: 'translateX(250%)'}], {duration: 1300, iterations: Infinity, easing: 'ease-in-out'});
    return () => animation?.cancel();
  }, []);
  return <VStack height="100%" style={{position: 'relative', overflow: 'hidden', ...style}}>
    <VStack ref={element} aria-hidden width="40%" height="100%" style={{position: 'absolute', insetBlock: 0, background: 'color-mix(in srgb, var(--color-on-hero) 75%, transparent)', borderRadius: 'var(--radius-full)'}}/>
  </VStack>;
}

/** Counts a number up from its previous value. Non-numbers render as-is. */
export function CountUp({value}: {value: number | string}) {
  const [shown, setShown] = useState(typeof value === 'number' ? 0 : value);
  const from = useRef(0);
  useEffect(() => {
    if (typeof value !== 'number' || reducedMotion()) return;
    const start = from.current; const started = performance.now(); let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 600);
      const next = Math.round(start + (value - start) * (1 - Math.pow(1 - t, 3)));
      setShown(next); from.current = next;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{typeof value !== 'number' || reducedMotion() ? value : shown}</>;
}
