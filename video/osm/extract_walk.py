"""Stream the Seoul walk GraphML and keep only edges near Dongmyo."""
import os as _os
VIDEO = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))); REPO = _os.path.dirname(VIDEO); WORK = _os.path.join(VIDEO, '.work')
import json
import re
import xml.etree.ElementTree as ET

S, W, N, E = 37.5660, 127.0060, 37.5800, 127.0280
NS = '{http://graphml.graphdrawing.org/xmlns}'
KEYS = {}
nodes = {}
edges = []
for ev, el in ET.iterparse(__import__('sys').argv[1] if len(__import__('sys').argv) > 1 else _os.path.join(WORK, 'osm/seoul_walk.graphml'), events=('end',)):
    tag = el.tag.replace(NS, '')
    if tag == 'key':
        KEYS[el.get('id')] = el.get('attr.name')
    elif tag == 'node':
        d = {KEYS.get(c.get('key')): c.text for c in el}
        try:
            x, y = float(d['x']), float(d['y'])
        except (KeyError, TypeError, ValueError):
            el.clear(); continue
        if S <= y <= N and W <= x <= E:
            nodes[el.get('id')] = (y, x)
        el.clear()
    elif tag == 'edge':
        u, v = el.get('source'), el.get('target')
        if u in nodes or v in nodes:
            d = {KEYS.get(c.get('key')): c.text for c in el}
            geom = d.get('geometry')
            if geom:
                pts = [(float(b), float(a)) for a, b in re.findall(r'(-?\d+\.\d+) (-?\d+\.\d+)', geom)]
            elif u in nodes and v in nodes:
                pts = [nodes[u], nodes[v]]
            else:
                el.clear(); continue
            edges.append({'u': u, 'v': v, 'pts': pts, 'name': d.get('name'), 'highway': d.get('highway'), 'len': d.get('length')})
        el.clear()
json.dump({'nodes': nodes, 'edges': edges}, open(_os.path.join(VIDEO, 'osm/walk.json'), 'w'))
print(len(nodes), len(edges))
from collections import Counter
print(Counter(e['highway'] for e in edges).most_common(15))
print(Counter(e['name'] for e in edges if e['name']).most_common(40))
