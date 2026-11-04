"""Rewrites window.BURSTS in comp/photos.js from the capture metadata in comp/assets/shots/meta*.json."""
import glob, json, os, re
VIDEO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
bursts = {}
for m in sorted(glob.glob(os.path.join(VIDEO, 'comp/assets/shots/meta*.json'))):
    for k, v in json.load(open(m))['bursts'].items():
        if os.path.isdir(os.path.join(VIDEO, 'comp/assets/shots', k)): bursts[k] = [x['f'] for x in v['frames']]
p = os.path.join(VIDEO, 'comp/photos.js'); s = open(p).read()
s = re.sub(r'window\.BURSTS=.*?;\n', 'window.BURSTS=' + json.dumps(bursts) + ';\n', s, flags=re.S)
open(p, 'w').write(s); print('bursts:', ', '.join(f'{k}({len(v)})' for k, v in bursts.items()))
