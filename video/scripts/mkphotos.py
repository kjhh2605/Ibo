import json, subprocess, glob, os
rows = {r[0].replace('File:',''): r for r in json.load(open('dongmyo/rows.json'))}
os.makedirs('comp/assets/dm', exist_ok=True)
out = []
for f in sorted(glob.glob('dongmyo/*.jpg')):
    if os.path.getsize(f) < 50000: continue
    base = os.path.basename(f); dst = f'comp/assets/dm/{base}'
    subprocess.run(['ffmpeg','-loglevel','error','-y','-i',f,'-vf','scale=1400:1400:force_original_aspect_ratio=decrease','-q:v','3',dst], check=True)
    w,h = map(int, subprocess.run(['ffprobe','-v','error','-show_entries','stream=width,height','-of','csv=p=0',dst],capture_output=True,text=True).stdout.strip().split(','))
    title = [k for k in rows if k.lower().replace(' ','-').replace('.jpg','')+'.jpg'==base]
    t = title[0] if title else base
    out.append({'key': base.replace('dongmyo-flea-market-','').replace('.jpg',''), 'src': f'assets/dm/{base}', 'credit': f'“{t.replace(".jpg","")}” by Seefooddiet, CC BY-SA 4.0, via Wikimedia Commons', 'portrait': h > w})
bursts = {}
for m in ['shots/meta.json','shots/meta2.json','shots/meta3.json']:
    for k,v in json.load(open(m))['bursts'].items(): bursts[k] = [x['f'] for x in v['frames']]
open('comp/photos.js','w').write('window.PHOTOS='+json.dumps(out,ensure_ascii=False)+';\nwindow.BURSTS='+json.dumps(bursts)+';\n')
print(len(out), [o['portrait'] for o in out])
