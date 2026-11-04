#!/usr/bin/env python3
"""Import immutable research references and inventory fixture provenance, not approval."""
from pathlib import Path
import hashlib
import json
import mimetypes
import shutil
import wave
from PIL import Image
from build_fixtures import FIX, ROOT, DATE, save_json, digest

OPENAI='https://openai.com/policies/row-terms-of-use/'
APPLE='https://www.apple.com/legal/sla/docs/macOSTahoe.pdf'

def import_research():
 original=Path('/tmp/edgetam-poc');dest=FIX/'research'; copied=[]
 manifest=json.loads((original/'retrieval_r4/manifest.json').read_text())
 metadata={f'research/retrieval/{v["id"]}.jpg':v for v in manifest['images']}
 paths=[('retrieval_r4/'+Path(v['path']).name,'retrieval/'+Path(v['path']).name) for v in manifest['images']]
 paths += [('retrieval_r4/'+name,'retrieval/'+name) for name in ['manifest.json','commons_metadata.json','results.json','image_embeddings.npy','run_retrieval.py']]
 paths += [('images/'+name+'.jpg','tap/'+name+'.jpg') for name in ['rack','shop']]
 paths += [('artifacts/'+name,'tap/'+name) for name in ['edge_results.json','pe_results.json','pe_text_features.npy','rack_masks.npz','shop_masks.npz','expected_masks.bin','expected_scores.bin','expected_pe.bin','rack_input.png','shop_input.png']]
 for source,target in paths:
  src=original/source;out=dest/target;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,out)
  copied.append({'path':str(out.relative_to(FIX)),'source':str(src),'sha256':digest(src),'unaltered':digest(src)==digest(out)})
 save_json(dest/'preservation.json',{'entries':copied,'warning':'Original research results are historical, not M1/app acceptance. Original retrieval manifest lists six queries; results.json contains actual measured query set, preserved unchanged.'})
 save_json(dest/'preprocessing.json',{'edgetam':{'revision':'7711e012a30a2402c4eaab637bdb00a521302c91','input':'RGB 1024 square; original run_edge.py is authoritative; copied reference masks remain original coordinates'},'pe':{'revision':'3e352cca660658d4b5c90f42a7808b11469e4c66','input':'get_image_transform(384) from preserved perception_models; original run_retrieval.py records execution','model':'PE-Core-T16-384'},'sourceScripts':{'edgeSha256':digest(original/'run_edge.py'),'peSha256':digest(original/'run_pe.py'),'preparePeSha256':digest(original/'prepare_pe_inputs.py')},'baselineMutated':False})
 return metadata

def generate():
 metadata=import_research()
 deriv=json.loads((FIX/'source/derivations.json').read_text())
 source_notes={
 'source/contact-sheet.png':{'sourceId':'codex:01a1a6aa-e961-70a0-b262-707d85989410/exec-95309a9e-af8d-4e55-b4f5-cca5fb3776a4','prompt':'Photorealistic synthetic 4x4 contact sheet: three multiple-garment shop interiors (blue jacket, stripes, gray/red), jeans/shoes, three fictional no-writing storefronts, shoes, adult front fullbody long hair and hat, halfbody, obscured neck, multiple adults, cropped head, empty hanger, mannequin. No real people, addresses or logos. Full verbatim command in source/generation.json.'},
 'source/self-four.png':{'sourceId':'codex:01a1a6ac-c0d1-77a0-9704-f90d2ca5a0cd/exec-10431993-5bb2-40c9-bf1d-c79e069d3ffb','prompt':'Photorealistic 2x2 four DIFFERENT fabricated adults head-to-toe front-facing, fitted neutral top/trousers, hands clear, plain gray studio; top left long wavy hair woman, top right brimmed hat man, bottom left long straight hair woman, bottom right different brimmed hat man. No real people/logos/text/borders.'}}
 entries=[]
 image_hashes={digest(p):str(p.relative_to(FIX)) for p in (FIX/'images').rglob('*.png')}
 attribution=json.loads((FIX/'source/research-attribution.json').read_text())
 # Fixture dependencies are content addressed; hashes do not participate in relay request selection.
 for path in sorted(FIX.rglob('*')):
  if not path.is_file() or path.name=='manifest.json' and path.parent==FIX or '__pycache__' in path.parts:continue
  rel=str(path.relative_to(FIX))
  local_only=rel in {'audio/query.wav','voice/normal/01-query.wav'}
  parents=deriv.get(rel,{}).get('parents',[])
  source_type='hand-authored';tool='OMP fixture tooling';version='1';source_id='scripts/e2e/build_fixtures.py';terms='Repository author contribution; no third-party or public-domain license asserted';terms_url='source/generation.json';approved=True
  procedure=deriv.get(rel,{}).get('procedure','Deterministic synthetic fixture authored by OMP; not provider output or model quality evidence')
  if rel.startswith('source/') and path.suffix=='.png':source_type='codex-generated';tool='Codex builtin image_gen.imagegen';version='0.166.0';source_id=source_notes[rel]['sourceId'];procedure=source_notes[rel]['prompt'];terms_url=OPENAI;terms='OpenAI Terms Content: output rights assigned as between user and OpenAI; not CC0/MIT; AI-generated disclosure required'
  elif rel.startswith(('images/','capture/','capture-cases/','masks/')):
   source_type='derived' if parents else 'hand-authored';terms_url=OPENAI if parents else 'source/generation.json';terms='Inherits generated parent terms; AI draft masks not human-reviewed' if parents else terms
  elif local_only:source_type='macos-say';tool='macOS say Samantha + afconvert';terms_url=APPLE;terms='Section2F personal non-commercial only; public redistribution prohibited';approved=False
  elif rel.startswith('research/'):
   source_type='original-research';source_id='preserved /tmp/edgetam-poc';terms_url='source/research-attribution.json';terms='Repository-owner historical experiment outputs/scripts; not OpenAI-generated and not model/GT acceptance evidence. Source image attribution inherited where applicable.'
   if rel in metadata:
    item=metadata[rel];terms=item['license'];terms_url=item['license_url'];source_id=item['source_url'];procedure={'authorHtml':item['author_html'],'originalTitle':item['title'],'transformation':'byte-identical copy'}
   elif '/tap/' in rel:
    original='rack' if 'rack' in path.name else 'shop' if 'shop' in path.name else None
    if original:
     credit=attribution['tap'][original];terms=credit['license'];terms_url=credit['licenseUrl'];source_id=credit['sourceUrl'];procedure={'author':credit['author'],'transformation':'Preserved original research asset; derivative status recorded in research/preservation.json'}
  if rel.startswith('relay/') and '/assets/' in rel:
   found=image_hashes.get(digest(path))
   if found:parents=[found];source_type='derived';terms_url=OPENAI;terms='Inherits synthetic generated parent terms';procedure='Byte-identical synthetic fixture asset, not provider recording'
  entry={'path':rel,'sha256':digest(path),'mimeType':mimetypes.guess_type(path.name)[0] or 'application/octet-stream','bytes':path.stat().st_size,'sourceType':source_type,'generator':{'tool':tool,'version':version,'date':DATE},'sourceId':source_id,'procedure':procedure,'terms':{'url':terms_url,'checkedAt':DATE,'summary':terms,'publicUseApproved':approved},'parents':[{'path':p,'sha256':digest(FIX/p)} for p in parents],'consumers':['S11']+(['S05','S10'] if '/self/' in rel or '/head' in rel else ['S01','S02','S03','S04','S06','S07','S08','S09'])}
  if path.suffix.lower() in {'.png','.jpg','.jpeg'}:
   if rel=='capture-cases/corrupt/01-corrupt.png':entry.update(expectedDecodeFailure=True)
   else:
    with Image.open(path) as im:entry.update(width=im.width,height=im.height,mode=im.mode)
  if path.suffix=='.wav':
   with wave.open(str(path),'rb') as wav:entry.update(samples=wav.getnframes(),sampleRate=wav.getframerate(),channels=wav.getnchannels(),sampleWidth=wav.getsampwidth(),durationS=wav.getnframes()/wav.getframerate())
  entries.append(entry)
 save_json(FIX/'manifest.json',{'schemaVersion':1,'generatedAt':DATE,'humanApprovalClaimed':False,'publicSpeechBlocked':True,'assets':entries})

if __name__=='__main__':generate()
