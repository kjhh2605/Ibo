#!/usr/bin/env python3
"""Import immutable research references and inventory fixture provenance, not approval."""
from pathlib import Path
import json
import mimetypes
import wave
from PIL import Image
from build_fixtures import FIX, DATE, save_json, digest
from import_review import provenance

OPENAI='https://openai.com/policies/row-terms-of-use/'

def generate():
 # Research is an explicit local input, not a prerequisite for inventorying
 # the portable synthetic corpus or a reason to copy private blobs implicitly.
 metadata={}
 research_manifest=FIX/'research/retrieval/manifest.json'
 if research_manifest.exists():
  metadata={f'research/retrieval/{v["id"]}.jpg':v for v in json.loads(research_manifest.read_text())['images']}
 approvals_path=FIX/'review/asset-approval.json'
 approvals=json.loads(approvals_path.read_text()).get('assets',{}) if approvals_path.exists() else {}
 speech_path=FIX/'audio/speech-source.json'
 speech=json.loads(speech_path.read_text()) if speech_path.exists() else {}
 deriv=json.loads((FIX/'source/derivations.json').read_text())
 generation=json.loads((FIX/'source/generation.json').read_text())
 source_notes={entry['path']:entry for entry in generation['outputs']}
 entries=[]
 image_hashes={digest(p):str(p.relative_to(FIX)) for p in (FIX/'images').rglob('*.png')}
 attribution_path=FIX/'source/research-attribution.json'
 attribution=json.loads(attribution_path.read_text()) if attribution_path.exists() else {'tap':{}}
 # Fixture dependencies are content addressed; hashes do not participate in relay request selection.
 for path in sorted(FIX.rglob('*')):
  if not path.is_file() or path.name=='manifest.json' and path.parent==FIX or '__pycache__' in path.parts or path.name=='.DS_Store':continue
  rel=str(path.relative_to(FIX))
  local_only=rel in {'audio/query.wav','voice/normal/01-query.wav'}
  if local_only and not (speech.get('sourceType')=='human-recording' and speech.get('publicUseApproved') is True):continue
  parents=deriv.get(rel,{}).get('parents',[])
  source_type='hand-authored';tool='OMP fixture tooling';version='1';source_id='scripts/e2e/build_fixtures.py';terms='Repository author contribution; no third-party or public-domain license asserted';terms_url='source/generation.json';approved=True
  procedure=deriv.get(rel,{}).get('procedure','Deterministic synthetic fixture authored by OMP; not provider output or model quality evidence')
  if rel.startswith('source/') and path.suffix=='.png':source_type='codex-generated';tool=generation['imageGenerationTool'];version=generation['cliVersion'];source_id=source_notes[rel]['sourceId'];procedure=source_notes[rel]['prompt'];terms_url=generation['termsUrl'];terms='OpenAI-generated output; no CC0/MIT or human review asserted'
  elif rel.startswith(('images/','capture/','capture-cases/','masks/')):
   source_type='derived' if parents else 'hand-authored';terms_url=OPENAI if parents else 'source/generation.json';terms='Inherits generated parent terms; AI draft masks not human-reviewed' if parents else terms
  elif local_only:source_type='human-recording';tool='consenting human recording, canonical PCM conversion';source_id=speech['sourceId'];terms_url=speech['termsUrl'];terms=speech['permission'];approved=speech.get('sha256')==digest(path);procedure=speech
  elif rel.startswith('research/'):
   source_type='original-research';source_id='preserved /tmp/edgetam-poc';terms_url='source/research-attribution.json';terms='Repository-owner historical experiment outputs/scripts; not OpenAI-generated and not model/GT acceptance evidence. Source image attribution inherited where applicable.'
   if rel in metadata:
    item=metadata[rel];terms=item['license'];terms_url=item['license_url'];source_id=item['source_url'];procedure={'authorHtml':item['author_html'],'originalTitle':item['title'],'transformation':'byte-identical copy'}
   elif '/tap/' in rel:
    original='rack' if 'rack' in path.name else 'shop' if 'shop' in path.name else None
    if original:
     credit=attribution['tap'].get(original)
     if credit:terms=credit['license'];terms_url=credit['licenseUrl'];source_id=credit['sourceUrl'];procedure={'author':credit['author'],'transformation':'Preserved original research asset; derivative status recorded in research/preservation.json'}
  if rel.startswith('relay/') and '/assets/' in rel:
   found=image_hashes.get(digest(path))
   if not found:
    found=next((str(p.relative_to(FIX)) for directory in ['masks','audio'] for p in (FIX/directory).rglob('*') if p.is_file() and digest(p)==digest(path)),None)
   if found:parents=[found];source_type='derived';terms_url=OPENAI if not found.startswith('audio/') else 'source/generation.json';terms='Inherits fixture parent terms';procedure='Byte-identical synthetic fixture asset, not provider recording'
   else:source_type='unverified';approved=False;terms='Unmapped relay binary: explicit source provenance required before publication';procedure='No approved source identity; not claimed to be generated or provider-recorded'
  if source_type in {'codex-generated','derived','original-research'} or rel.startswith(('images/','capture/','masks/')):
   approval=approvals.get(rel,{})
   approved=False
   if approval:
    provenance(approval)
    approved=approval.get('sha256')==digest(path) and approval.get('publicUseApproved') is True and bool(approval.get('permission')) and bool(approval.get('termsUrl'))
    if approved:terms_url=approval['termsUrl'];terms=approval['permission']
  if rel.startswith('masks/head/'):
   head=json.loads((FIX/'review/head.json').read_text())
   case=next((c for c in head['cases'] if c.get('groundTruthMask')==rel),None)
   if case and case.get('status')=='human-approved' and case.get('groundTruthSha256')==digest(path):
    source_type='human-annotation';source_id=case['id'];procedure={'annotator':case['annotator'],'annotatedAt':case['annotatedAt'],'reviewer':case['reviewer'],'reviewedAt':case['reviewedAt']}
  entry={'path':rel,'sha256':digest(path),'mimeType':mimetypes.guess_type(path.name)[0] or 'application/octet-stream','bytes':path.stat().st_size,'sourceType':source_type,'generator':{'tool':tool,'version':version,'date':DATE},'sourceId':source_id,'procedure':procedure,'terms':{'url':terms_url,'checkedAt':DATE,'summary':terms,'publicUseApproved':approved},'parents':[{'path':p,'sha256':digest(FIX/p)} for p in parents],'consumers':['S11']+(['S05','S10'] if '/self/' in rel or '/head' in rel else ['S01','S02','S03','S04','S06','S07','S08','S09'])}
  if path.suffix.lower() in {'.png','.jpg','.jpeg'}:
   if rel=='capture-cases/corrupt/01-corrupt.png':entry.update(expectedDecodeFailure=True)
   else:
    with Image.open(path) as im:entry.update(width=im.width,height=im.height,mode=im.mode)
  if path.suffix=='.wav':
   if rel=='voice/corrupt/01-corrupt.wav':entry.update(expectedDecodeFailure=True)
   else:
    with wave.open(str(path),'rb') as wav:entry.update(samples=wav.getnframes(),sampleRate=wav.getframerate(),channels=wav.getnchannels(),sampleWidth=wav.getsampwidth(),durationS=wav.getnframes()/wav.getframerate())
  entries.append(entry)
 head=json.loads((FIX/'review/head.json').read_text())
 save_json(FIX/'manifest.json',{'schemaVersion':1,'generatedAt':DATE,'humanApprovalClaimed':any(c.get('status')=='human-approved' for c in head['cases']),'publicSpeechBlocked':not all(any(e['path']==p and e['terms']['publicUseApproved'] for e in entries) for p in ['audio/query.wav','voice/normal/01-query.wav']),'assets':entries})

if __name__=='__main__':generate()
