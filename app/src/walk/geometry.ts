import type {Point, RouteResponse} from './types';

const R = 6371008.8;
const rad = Math.PI / 180;
export const point = (coordinate: number[]): Point => ({lng: coordinate[0], lat: coordinate[1]});
const longitudeDelta = (a: number, b: number) => ((b - a + 540) % 360 - 180) * rad;

export function validPoint(value: unknown): value is Point {
  if (!value || typeof value !== 'object' || !('lat' in value) || !('lng' in value)) return false;
  return typeof value.lat === 'number' && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90 &&
    typeof value.lng === 'number' && Number.isFinite(value.lng) && Math.abs(value.lng) <= 180;
}

export function distance(a: Point, b: Point): number {
  const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(longitudeDelta(a.lng, b.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function bearing(a: Point, b: Point): number {
  const d = longitudeDelta(a.lng, b.lng);
  const y = Math.sin(d) * Math.cos(b.lat * rad);
  const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos(d);
  return (Math.atan2(y, x) / rad + 360) % 360;
}

export function routeLengths(route: RouteResponse): number[] {
  const lengths = [0];
  for (let i = 1; i < route.geometry.coordinates.length; i++) lengths.push(lengths[i - 1] + distance(point(route.geometry.coordinates[i - 1]), point(route.geometry.coordinates[i])));
  return lengths;
}

/** Project in a local tangent plane; segment lengths remain geodesic metres. */
export function project(fix: Point, coordinates: number[][], lengths: number[]): {progressM: number; distanceM: number} {
  let best = {progressM: 0, distanceM: Infinity};
  for (let i = 1; i < coordinates.length; i++) {
    const a = point(coordinates[i - 1]);
    const b = point(coordinates[i]);
    const scale = Math.cos(fix.lat * rad) * R;
    const ax = longitudeDelta(fix.lng, a.lng) * scale;
    const ay = (a.lat - fix.lat) * rad * R;
    const bx = ax + longitudeDelta(a.lng, b.lng) * scale;
    const by = (b.lat - fix.lat) * rad * R;
    const dx = bx - ax;
    const dy = by - ay;
    const denominator = dx * dx + dy * dy;
    const fraction = denominator === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / denominator));
    const separation = Math.hypot(ax + fraction * dx, ay + fraction * dy);
    if (separation < best.distanceM) best = {progressM: lengths[i - 1] + fraction * (lengths[i] - lengths[i - 1]), distanceM: separation};
  }
  return best;
}

export function splitRoute(route: RouteResponse, progressM: number): {passed: number[][]; remaining: number[][]} {
  const coordinates = route.geometry.coordinates;
  const lengths = routeLengths(route);
  for (let i = 1; i < coordinates.length; i++) {
    if (progressM <= lengths[i]) {
      const fraction = Math.max(0, (progressM - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1));
      const a = coordinates[i - 1];
      const b = coordinates[i];
      const split = [a[0] + longitudeDelta(a[0], b[0]) / rad * fraction, a[1] + (b[1] - a[1]) * fraction];
      return {passed: [...coordinates.slice(0, i), split], remaining: [split, ...coordinates.slice(i)]};
    }
  }
  return {passed: coordinates, remaining: []};
}

export function instruction(route: RouteResponse, index: number): string {
  const step = route.steps[index];
  if (!step) return 'Continue toward the destination';
  const modifier = step.maneuver.modifier;
  const direction = modifier && ['left', 'right', 'slight left', 'slight right', 'sharp left', 'sharp right', 'straight', 'uturn'].includes(modifier) ? modifier : null;
  const type = step.maneuver.type;
  const action = type === 'arrive' ? 'Continue to the photographed location' : type === 'depart' ? 'Start walking' : type === 'roundabout' || type === 'rotary' ? 'Follow the roundabout' : direction === 'uturn' ? 'Turn around' : direction && direction !== 'straight' ? `Turn ${direction}` : 'Continue straight';
  return step.name && type !== 'arrive' ? `${action} on ${step.name}` : action;
}
