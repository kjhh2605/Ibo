"""Builds a stylised but geographically real Dongmyo sketch map (SVG) plus pins and on-road walking paths.

Sources: OpenStreetMap contributors (ODbL) via an OSMnx Seoul walk network and a filtered Korea extract.
"""
import os as _os
VIDEO = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))); REPO = _os.path.dirname(VIDEO); WORK = _os.path.join(VIDEO, '.work')
import heapq
import json
import math

walk = json.load(open(_os.path.join(VIDEO, 'osm/walk.json')))
major = json.load(open(_os.path.join(VIDEO, 'osm/major.json')))

# world canvas used by the video camera
WW, WH = 2600, 1600
LAT0, LAT1 = 37.5707, 37.5745
K = math.cos(math.radians(37.5726))
lat_km = (LAT1 - LAT0) * 111.2
lon_span = lat_km * WW / WH / (111.32 * K)
LONC = 127.01780
LON0, LON1 = LONC - lon_span / 2, LONC + lon_span / 2
PXM = WW / (lon_span * 111.32 * K * 1000)  # px per metre


def P(la, lo):
    return ((lo - LON0) / (LON1 - LON0) * WW, (LAT1 - la) / (LAT1 - LAT0) * WH)


DRAW = {'primary': 40, 'primary_link': 20, 'secondary': 32, 'secondary_link': 18, 'tertiary': 25, 'tertiary_link': 16,
        'residential': 17, 'living_street': 16, 'unclassified': 17, 'pedestrian': 16, 'service': 11, 'busway': 0}


def hw(e):
    h = e['highway'] or ''
    if h.startswith('['):
        h = h.strip("[]'").split("'")[0]
    return h


edges = [e for e in walk['edges'] if DRAW.get(hw(e), 0) > 0]
# ---------------- routing graph (only drawn roads) ----------------
coord = {}
adj = {}
for e in edges:
    pts = [P(a, b) for a, b in e['pts']]
    coord[e['u']] = pts[0]
    coord[e['v']] = pts[-1]
    L = sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))
    adj.setdefault(e['u'], []).append((e['v'], L, pts))
    adj.setdefault(e['v'], []).append((e['u'], L, pts[::-1]))


def nearest(x, y):
    return min(coord, key=lambda n: math.dist(coord[n], (x, y)))


def route(a, b):
    dist = {a: 0}; prev = {}
    pq = [(0, a)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == b:
            break
        if d > dist.get(u, 1e18):
            continue
        for v, L, pts in adj.get(u, []):
            nd = d + L
            if nd < dist.get(v, 1e18):
                dist[v] = nd; prev[v] = (u, pts); heapq.heappush(pq, (nd, v))
    path = []; n = b
    while n != a:
        u, pts = prev[n]
        path = pts[1:] + path if path else pts[1:]
        path = pts[:1] + path
        n = u
    # de-duplicate consecutive points
    out = []
    for p in path:
        if not out or math.dist(out[-1], p) > 0.5:
            out.append(p)
    return out


# ---------------- svg ----------------
C = {'ground': '#ECE3D1', 'block': '#E4D8C0', 'road': '#FAF6EF', 'casing': '#D8CAB0', 'major': '#FFFFFF', 'water': '#BFD3D6',
     'waterEdge': '#A9C2C6', 'label': '#8A7A62', 'shrine': '#D9CCB0', 'shrineRoof': '#4A4D50', 'market': 'rgba(52,80,122,0.10)'}
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{WW}" height="{WH}" viewBox="0 0 {WW} {WH}">',
       '<defs><pattern id="mk" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><rect width="22" height="22" fill="rgba(52,80,122,0.07)"/><line x1="0" y1="0" x2="0" y2="22" stroke="rgba(52,80,122,0.13)" stroke-width="8"/></pattern>'
       '<filter id="soft" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="0.6"/></filter></defs>',
       f'<rect width="{WW}" height="{WH}" fill="{C["block"]}"/>']


def poly(pts):
    return ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)


# Cheonggyecheon (stream) + its banks
for w in major['ways']:
    t = w['tags']
    if t.get('waterway') in ('river', 'stream') or t.get('natural') == 'water' or 'water' in t:
        pts = [P(a, b) for a, b in w['pts']]
        svg.append(f'<polyline points="{poly(pts)}" fill="none" stroke="{C["waterEdge"]}" stroke-width="{int(26 * PXM / 2.6 + 30)}" stroke-linecap="round" stroke-linejoin="round"/>')
        svg.append(f'<polyline points="{poly(pts)}" fill="none" stroke="{C["water"]}" stroke-width="{int(26 * PXM / 2.6 + 18)}" stroke-linecap="round" stroke-linejoin="round"/>')
# Dongmyo Shrine compound (from the road block that encloses the heritage coordinate)
SH = (37.572967, 127.018336)
shrine_poly_ll = [(37.57344, 127.01761), (37.57363, 127.01836), (37.57259, 127.01894), (37.57238, 127.01822)]


def order(pts):
    cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
    return sorted(pts, key=lambda p: math.atan2(p[1] - cy, p[0] - cx))


# roads: casing then fill, by class order
layers = sorted(edges, key=lambda e: DRAW[hw(e)])
# flea-market streets: lanes hugging the shrine walls and the alleys west of it
sxm, sym = P(37.572967, 127.018336)
halo = []
for e in layers:
    pts = [P(a, b) for a, b in e['pts']]
    mx = sum(x for x, _ in pts) / len(pts); my = sum(y for _, y in pts) / len(pts)
    if DRAW[hw(e)] <= 25 and math.dist((mx, my), (sxm - 175, sym + 90)) < 530:
        halo.append(f'<polyline points="{poly(pts)}" fill="none" stroke="#34507A" stroke-width="{DRAW[hw(e)] + 22}" stroke-linecap="round" stroke-linejoin="round"/>')
svg.append('<g opacity="0.26">' + ''.join(halo) + '</g>')
for e in layers:
    w = DRAW[hw(e)]
    svg.append(f'<polyline points="{poly([P(a, b) for a, b in e["pts"]])}" fill="none" stroke="{C["casing"]}" stroke-width="{w + 5}" stroke-linecap="round" stroke-linejoin="round"/>')
for e in layers:
    w = DRAW[hw(e)]
    col = C['major'] if w >= 25 else C['road']
    svg.append(f'<polyline points="{poly([P(a, b) for a, b in e["pts"]])}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"/>')

json.dump({'world': [WW, WH], 'bbox': [LAT0, LON0, LAT1, LON1]}, open(_os.path.join(VIDEO, 'osm/frame.json'), 'w'))

# ---- shrine: snap the compound polygon to nearby road corners for a clean fit ----
sp = [P(a, b) for a, b in shrine_poly_ll]
inset = 16
cx = sum(p[0] for p in sp) / 4; cy = sum(p[1] for p in sp) / 4
sp_in = [(cx + (x - cx) * 0.86, cy + (y - cy) * 0.86) for x, y in sp]
svg.append(f'<polygon points="{poly(sp_in)}" fill="#DCD3B9" stroke="#B5A68D" stroke-width="5" stroke-dasharray="2 0"/>')
# trees + roof icon
sx, sy = P(*SH)
for i, (dx, dy) in enumerate([(-80, -160), (75, -130), (-60, 140), (85, 160), (-105, 15), (110, 25)]):
    svg.append(f'<circle cx="{sx + dx:.0f}" cy="{sy + dy:.0f}" r="{22 + i % 3 * 4}" fill="#B9C2A2"/>')
svg.append(f'<g transform="translate({sx:.0f} {sy - 6:.0f})"><path d="M-46 -6 Q0 -40 46 -6 L36 -6 L36 22 L-36 22 L-36 -6Z" fill="{C["shrineRoof"]}"/><rect x="-26" y="2" width="52" height="20" fill="#7E5F42"/><path d="M-56 -4 Q0 -48 56 -4" fill="none" stroke="{C["shrineRoof"]}" stroke-width="8" stroke-linecap="round"/></g>')

# ---------------- labels (English) ----------------
labels = []


def road_label(name_ko, text, frac=0.5, size=26, dy=0):
    segs = [e for e in edges if (e['name'] or '') == name_ko]
    if not segs:
        return
    pts = [P(a, b) for e in segs for a, b in e['pts']]
    pts.sort(key=lambda p: p[0])
    p = pts[int(len(pts) * frac)]
    q = pts[min(len(pts) - 1, int(len(pts) * frac) + max(2, len(pts) // 12))]
    ang = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
    if ang > 90: ang -= 180
    if ang < -90: ang += 180
    labels.append(f'<text x="{p[0]:.0f}" y="{p[1] + dy:.0f}" transform="rotate({ang:.1f} {p[0]:.0f} {p[1] + dy:.0f})" font-family="Outfit" font-weight="700" font-size="{size}" letter-spacing="4" fill="{C["label"]}" text-anchor="middle" dominant-baseline="middle">{text}</text>')


road_label('종로', 'JONG-RO', 0.22, 26)
road_label('종로', 'JONG-RO', 0.80, 26)
jx, jy = P(37.57405, 127.01572)
labels.append(f'<text x="{jx:.0f}" y="{jy:.0f}" transform="rotate(-87 {jx:.0f} {jy:.0f})" font-family="Outfit" font-weight="700" font-size="22" letter-spacing="4" fill="{C["label"]}" text-anchor="middle" dominant-baseline="middle">JIBONG-RO</text>')
road_label('청계천로', 'CHEONGGYECHEON-RO', 0.62, 20, 0)
mlx, mly = P(37.57183, 127.01730)
labels.append(f'<text x="{mlx:.0f}" y="{mly:.0f}" font-family="Outfit" font-weight="700" font-size="24" letter-spacing="3" fill="#34507A" text-anchor="middle" opacity=".75">DONGMYO FLEA MARKET</text>')
labels.append(f'<text x="{sx:.0f}" y="{sy + 58:.0f}" font-family="Outfit" font-weight="700" font-size="25" fill="#4A4D50" text-anchor="middle">Dongmyo Shrine</text>')
# stream label
wx, wy = P(37.57092, 127.02000)
labels.append(f'<text x="{wx:.0f}" y="{wy:.0f}" transform="rotate(-20 {wx:.0f} {wy:.0f})" font-family="Outfit" font-style="italic" font-weight="600" font-size="24" fill="#6F8F95" text-anchor="middle">Cheonggyecheon Stream</text>')
# stations
for la, lo, txt in [(37.57351, 127.01743, 'Dongmyo-ap Stn · Line 1'), (37.57234, 127.01566, 'Dongmyo-ap Stn · Line 6'), (37.57186, 127.01149, 'Dongdaemun Stn')]:
    x, y = P(la, lo)
    if not (0 < x < WW and 0 < y < WH):
        continue
    labels.append(f'<g transform="translate({x:.0f} {y:.0f})"><rect x="-17" y="-17" width="34" height="34" rx="9" fill="#34507A"/><path d="M-8 6 L-8 -6 Q0 -12 8 -6 L8 6 M-9 9 L-5 4 M9 9 L5 4" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>'
                  f'<text x="26" y="8" font-family="Outfit" font-weight="700" font-size="22" fill="#34507A">{txt}</text></g>')
svg += labels
svg.append('</svg>')
open(_os.path.join(VIDEO, 'comp/assets/dongmyo-map.svg'), 'w').write('\n'.join(svg))

# ---------------- pins on real alleys + on-road paths ----------------
def at(la, lo):
    n = nearest(*P(la, lo)); return n


PIN_LL = {  # stall locations: alleys/sidewalks around the shrine walls (market streets)
    'p1': (37.57345, 127.01705),   # Jong-ro sidewalk by the Line 1 exits
    'p2': (37.57291, 127.01790),   # west-wall street of the shrine (the jacket stall)
    'p3': (37.57289, 127.01671),   # Jongno 56-gil alley
    'p4': (37.57314, 127.01921),   # lane east of the shrine
    'p5': (37.57249, 127.01858),   # south-wall street (the shirt stall)
    'p6': (37.57192, 127.01843),   # lane towards Cheonggyecheon
    'p7': (37.57213, 127.01623),   # Jibong-ro side alley
    'p8': (37.57280, 127.02011),   # Nangye-ro 27-gil
}
pins = {k: coord[at(*v)] for k, v in PIN_LL.items()}
start = coord[at(37.57314, 127.01559)]  # arrives from Dongmyo-ap Line 6 / Jong-ro corner
nodes_of = {k: at(*v) for k, v in PIN_LL.items()}
n_start = at(37.57314, 127.01559)
paths = {
    'enter': route(n_start, nodes_of['p2']),           # S1: browse along Jong-ro and down the west wall to the jacket stall
    'away': route(nodes_of['p2'], nodes_of['p6']),      # S2: an hour later, further south
    'toB': route(nodes_of['p6'], nodes_of['p5']),       # S4: to the shirt stall
    'ab': route(nodes_of['p2'], nodes_of['p5']),        # A↔B connector, on roads
    'back': route(nodes_of['p6'], nodes_of['p2']),      # S10: walk back to the jacket stall
}
out = {'world': [WW, WH], 'pins': pins, 'paths': paths, 'shrine': [sx, sy], 'pxPerM': PXM}
open(_os.path.join(VIDEO, 'comp/mapdata.js'), 'w').write('window.MAPDATA=' + json.dumps(out) + ';\n')
print('px/m', round(PXM, 2), {k: (round(v[0]), round(v[1])) for k, v in pins.items()}, {k: len(v) for k, v in paths.items()})
