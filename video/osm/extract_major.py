"""Major roads, the Cheonggyecheon stream and subway stations near Dongmyo from a Korea OSM .pbf
(e.g. github.com/lancard/filtered-south-korea-osm, filtered.osm.pbf). Writes video/osm/major.json."""
import json, os, sys
import osmium
VIDEO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S, W, N, E = 37.5660, 127.0060, 37.5800, 127.0280
out = {'ways': [], 'nodes': []}
class H(osmium.SimpleHandler):
    def node(s, n):
        if S <= n.location.lat <= N and W <= n.location.lon <= E and ('railway' in n.tags or 'public_transport' in n.tags or 'name' in n.tags):
            out['nodes'].append({'lat': n.location.lat, 'lon': n.location.lon, 'tags': dict(n.tags)})
    def way(s, w):
        try: pts = [(n.lat, n.lon) for n in w.nodes]
        except Exception: return
        if any(S <= a <= N and W <= b <= E for a, b in pts): out['ways'].append({'tags': dict(w.tags), 'pts': pts})
H().apply_file(sys.argv[1], locations=True)
json.dump(out, open(os.path.join(VIDEO, 'osm/major.json'), 'w')); print(len(out['ways']), 'ways', len(out['nodes']), 'nodes')
