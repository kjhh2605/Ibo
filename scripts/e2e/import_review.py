#!/usr/bin/env python3
"""Import an actual human-exported annotation; never synthesizes approval fields."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
from PIL import Image
from build_fixtures import FIX, save_json, digest

def main():
 parser=argparse.ArgumentParser();parser.add_argument('bundle',type=Path);args=parser.parse_args();bundle=json.loads(args.bundle.read_text())
 review=json.loads((FIX/'review/head.json').read_text());case=next(c for c in review['cases'] if c['id']==bundle['id'])
 if bundle.get('humanAttestation') is not True:raise ValueError('Human attestation required; AI drafts cannot be approved')
 for key in ['annotator','annotatedAt','reviewer','reviewedAt']:
  if not isinstance(bundle.get(key),str) or not bundle[key].strip():raise ValueError('Missing '+key)
 if digest(FIX/case['image'])!=bundle['sourceSha256'] or case['sourceSha256']!=bundle['sourceSha256']:raise ValueError('Frozen source changed')
 if (case['expectedPerson'],case['expectedRegistration'])!=(bundle['expectedPerson'],bundle['expectedRegistration']):raise ValueError('Classification change requires explicitly revising frozen case before import')
 if case['expectedRegistration']:
  data=bundle['maskDataUrl'];prefix='data:image/png;base64,'
  if not data.startswith(prefix):raise ValueError('PNG required')
  with Image.open(io.BytesIO(base64.b64decode(data[len(prefix):],validate=True))) as image,Image.open(FIX/case['image']) as source:
   if image.size!=source.size:raise ValueError('GT dimensions differ from original')
   # Canvas anti-aliasing is conservatively rounded outward, preserving every marked head pixel.
   mask=image.convert('L').point(lambda p:255 if p>0 else 0)
   if mask.getextrema()!=(0,255):raise ValueError('Nonempty, non-full-frame binary head annotation required')
   path=FIX/'masks/head'/(case['id']+'.png');path.parent.mkdir(parents=True,exist_ok=True);mask.save(path)
  case['groundTruthMask']=str(path.relative_to(FIX));case['groundTruthSha256']=digest(path)
 for key in ['annotator','annotatedAt','reviewer','reviewedAt']:case[key]=bundle[key]
 case['status']='human-approved';case['reviewBundleSha256']=hashlib.sha256(args.bundle.read_bytes()).hexdigest()
 save_json(FIX/'review/head.json',review)
 print(json.dumps({'id':case['id'],'status':case['status'],'sourceSha256':case['sourceSha256'],'next':'Regenerate manifest; run validate-fixtures --all and head-mask --all. Human approval alone is not model acceptance.'}))
if __name__=='__main__':main()
