import {deferred} from '../deferred';
import type {Feature, FeatureCollection, Geometry} from 'geojson';
import {Map as GLMap, setWorkerUrl} from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import type {ExpressionSpecification, GeoJSONSource, MapOptions} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {EventSource} from './events';
import {splitRoute} from './geometry';
import {WalkError} from './types';
import type {MapAPI, MapUpdate, Point} from './types';
// Vite prebundling relocates MapLibre's default relative worker URL; ship the worker as an asset.
setWorkerUrl(workerUrl);

export const MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const empty: FeatureCollection = {type: 'FeatureCollection', features: []};
const sourceId = 'sf-walk';

type MapFactory = (options: MapOptions) => Promise<GLMap>;

export class WalkMap extends EventSource<{ready: Record<string, never>; error: {code: 'map_unavailable'}}> implements MapAPI {
  private map: GLMap | null = null;
  private pending: MapUpdate | null = null;
  private ready = false;
  private fitted = false;
  private destination: Point | null = null;
  private generation = 0;
  private rejectMount: (() => void) | null = null;
  private factory: MapFactory;
  private resizeObserver: ResizeObserver | null = null;

  constructor(factory: MapFactory = async options => new GLMap(options)) {
    super();
    this.factory = factory;
  }

  async mount({element}: {element: HTMLElement}): Promise<void> {
    const pending = this.pending;
    await this.unmount();
    const generation = ++this.generation;
    this.pending = pending;
    try {
      const map = await this.factory({container: element, style: MAP_STYLE, ...(this.pending ? {center: [this.pending.destination.lng, this.pending.destination.lat] as [number, number]} : {}), zoom: 15, bearing: 0, pitch: 0, attributionControl: {compact: false}, dragRotate: false, pitchWithRotate: false, touchPitch: false, maxPitch: 0});
      if (generation !== this.generation) { map.remove(); return; }
      this.map = map;
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      map.on('error', () => { this.emit('error', {code: 'map_unavailable'}); });
      const {promise, resolve, reject} = deferred<void>();
      const timeout = window.setTimeout(() => finish(false), 30000);
      const finish = (success: boolean) => {
        window.clearTimeout(timeout);
        map.off('load', loaded);
        map.off('error', failed);
        this.rejectMount = null;
        if (success) resolve(); else reject(new WalkError('map_unavailable'));
      };
      const loaded = () => finish(true);
      const failed = () => finish(false);
      this.rejectMount = failed;
      map.once('load', loaded);
      map.once('error', failed);
      await promise;
      if (generation !== this.generation) return;
      // OpenFreeMap labels expose English names; never replace labels with an invented translation.
      for (const layer of map.getStyle().layers) {
        if (layer.type === 'symbol' && layer.layout?.['text-field']) map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:en'], ['get', 'name']]);
      }
      map.addSource(sourceId, {type: 'geojson', data: empty, attribution: '<a href="https://openfreemap.org/">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'});
      const theme = getComputedStyle(element);
      const accent = theme.getPropertyValue('--color-accent').trim() || theme.color;
      const ink = theme.getPropertyValue('--color-ink').trim() || theme.color;
      const surface = theme.getPropertyValue('--color-background-surface').trim() || theme.backgroundColor;
      map.addLayer({id: 'sf-route', type: 'line', source: sourceId, filter: ['==', ['get', 'kind'], 'route'], paint: {'line-color': accent, 'line-width': 5}});
      map.addLayer({id: 'sf-passed', type: 'line', source: sourceId, filter: ['==', ['get', 'kind'], 'passed'], paint: {'line-color': ink, 'line-width': 3, 'line-dasharray': [1, 2]}});
      // WebMercator metres per pixel at the marker latitude, scaled by zoom.
      const radius = ['interpolate', ['exponential', 2], ['zoom'], 0, ['/', ['get', 'radiusM'], ['*', 78271.516964, ['get', 'cosLat']]], 22, ['/', ['*', ['get', 'radiusM'], 4194304], ['*', 78271.516964, ['get', 'cosLat']]]] as const;
      map.addLayer({id: 'sf-accuracy', type: 'circle', source: sourceId, filter: ['==', ['get', 'kind'], 'accuracy'], paint: {'circle-color': accent, 'circle-opacity': 0.12, 'circle-radius': radius as unknown as ExpressionSpecification}});
      map.addLayer({id: 'sf-destination', type: 'circle', source: sourceId, filter: ['==', ['get', 'kind'], 'destination'], paint: {'circle-color': ink, 'circle-radius': 9, 'circle-stroke-color': surface, 'circle-stroke-width': 3}});
      map.addLayer({id: 'sf-current', type: 'circle', source: sourceId, filter: ['==', ['get', 'kind'], 'current'], paint: {'circle-color': accent, 'circle-radius': 6, 'circle-stroke-color': surface, 'circle-stroke-width': 2}});
      this.ready = true;
      this.resizeObserver = new ResizeObserver(() => map.resize());
      this.resizeObserver.observe(element);
      if (this.pending) await this.update(this.pending);
      this.emit('ready', {});
    } catch {
      if (generation !== this.generation) return;
      this.emit('error', {code: 'map_unavailable'});
      await this.unmount();
      throw new WalkError('map_unavailable');
    }
  }

  async update(input: MapUpdate): Promise<void> {
    // A mounted map belongs to one destination. Re-mount to begin a different walk.
    if (this.destination && (input.destination.lat !== this.destination.lat || input.destination.lng !== this.destination.lng)) throw new WalkError('destination_immutable', false);
    this.destination = {...input.destination};
    this.pending = structuredClone(input);
    const map = this.map;
    if (!map || !this.ready) return;
    const features: Feature<Geometry>[] = [{type: 'Feature', properties: {kind: 'destination'}, geometry: {type: 'Point', coordinates: [input.destination.lng, input.destination.lat]}}];
    if (input.fix) {
      const coordinates = [input.fix.lng, input.fix.lat];
      features.push({type: 'Feature', properties: {kind: 'current'}, geometry: {type: 'Point', coordinates}});
      features.push({type: 'Feature', properties: {kind: 'accuracy', radiusM: input.fix.accuracyM, cosLat: Math.max(0.01, Math.cos(input.fix.lat * Math.PI / 180))}, geometry: {type: 'Point', coordinates}});
    }
    if (input.route) {
      const split = splitRoute(input.route, input.progressM ?? 0);
      for (const [kind, coordinates] of [['route', split.remaining], ['passed', split.passed]] as const) {
        if (coordinates.length >= 2) features.push({type: 'Feature', properties: {kind}, geometry: {type: 'LineString', coordinates}});
      }
    }
    (map.getSource(sourceId) as GeoJSONSource).setData({type: 'FeatureCollection', features});
    if (!this.fitted && input.fix) {
      const coordinates = [[input.fix.lng, input.fix.lat], [input.destination.lng, input.destination.lat], ...(input.route?.geometry.coordinates ?? [])];
      const lngs = coordinates.map(value => value[0]);
      const lats = coordinates.map(value => value[1]);
      map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {padding: 48, maxZoom: 17, duration: 0});
      this.fitted = true;
    }
  }

  async unmount(): Promise<void> {
    ++this.generation;
    this.rejectMount?.();
    this.rejectMount = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.map?.remove();
    this.map = null;
    this.ready = false;
    this.fitted = false;
    this.destination = null;
    this.pending = null;
  }
}
