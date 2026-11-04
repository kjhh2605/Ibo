// Shared motion constants and helpers (no components, so React Fast Refresh stays happy).
import {useState} from 'react';
import type {CSSProperties, PointerEvent} from 'react';

export const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
export const EASE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export function reducedMotion() {
  return typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Last navigation, so entrance effects can stay quiet when a person returns to a screen they already saw. */
export const navigation = {direction: 'push' as 'push' | 'back', at: 0};
export function markNavigation(direction: 'push' | 'back') { navigation.direction = direction; navigation.at = performance.now(); }
export function returning() { return navigation.direction === 'back' && performance.now() - navigation.at < 800; }

/** Pointer handlers that give a pressable surface a quick squeeze. */
export const pressFeedback = {
  onPointerDown(event: PointerEvent<HTMLElement>) {
    if (reducedMotion()) return;
    event.currentTarget.animate([{transform: 'scale(1)'}, {transform: 'scale(0.97)'}], {duration: 120, easing: EASE_OUT, fill: 'forwards'});
  },
  onPointerUp(event: PointerEvent<HTMLElement>) { release(event.currentTarget); },
  onPointerLeave(event: PointerEvent<HTMLElement>) { release(event.currentTarget); },
  onPointerCancel(event: PointerEvent<HTMLElement>) { release(event.currentTarget); },
};
function release(element: HTMLElement) {
  if (reducedMotion()) return;
  for (const animation of element.getAnimations()) animation.cancel();
  element.animate([{transform: 'scale(0.97)'}, {transform: 'scale(1)'}], {duration: 260, easing: EASE_SPRING});
}

/** Fades an image in once its bytes have decoded. */
export function useFadeIn() {
  const [loaded, setLoaded] = useState(false);
  const style: CSSProperties = reducedMotion() ? {} : {opacity: loaded ? 1 : 0, transform: loaded ? 'none' : 'scale(1.02)', transition: `opacity 360ms ${EASE_OUT}, transform 480ms ${EASE_OUT}`};
  return {style, onLoad: () => setLoaded(true)};
}
