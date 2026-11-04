#!/usr/bin/env python3
"""Rebuild deterministic local derivatives. Never invokes inference or invents GT approval."""
from pathlib import Path
import argparse
import hashlib
import json
import math
import copy
import os
import shutil
import struct
import wave
from datetime import datetime, timedelta, timezone
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
FIX = Path(os.environ.get('SF_FIXTURES_DIR', ROOT / 'verification/fixtures')).resolve()
DATE = '2026-11-04'

def save_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def image_save(image, rel):
    path = FIX / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    return path

def pcm(path, samples):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), 'wb') as out:
        out.setparams((1, 2, 16000, 0, 'NONE', 'not compressed'))
        out.writeframes(samples)

def images():
    for source in json.loads((FIX/'source/generation.json').read_text())['outputs']:
        path = FIX / source['path']
        if not path.resolve().is_relative_to(FIX) or digest(path) != source['sha256']:
            raise ValueError('Generated source identity differs from preserved evidence')
    # Rebuilding frozen, reviewed pixels would invalidate genuine annotations.
    # Refuse before any writes rather than silently reverting them to AI drafts.
    for relative,key in [('review/head.json','cases'),('masks/items/cases.json',None)]:
        existing=FIX/relative
        if existing.exists():
            value=json.loads(existing.read_text())
            if (key and any(case.get('status')=='human-approved' for case in value[key])) or (not key and value.get('reviewer')):
                raise ValueError('Reviewed corpus is frozen; explicitly revise source and review together before rebuilding images')
    sheet = Image.open(FIX / 'source/contact-sheet.png').convert('RGB')
    names = ['shops/shop-1-items','shops/shop-2-items','shops/shop-3-items','wardrobe/jeans-original',
             'storefronts/shop-1','storefronts/shop-2','storefronts/shop-3','wardrobe/shoes-original',
             'self/positive/long-hair','self/positive/hat','self/negative/half-body','self/negative/neck-hidden',
             'self/negative/multiple-people','self/negative/cropped-head','self/no-person/hanger','self/no-person/mannequin']
    derivations = {}
    for i, name in enumerate(names):
        x, y = i % 4, i // 4
        box = (round(x*sheet.width/4)+2,round(y*sheet.height/4)+2,round((x+1)*sheet.width/4)-2,round((y+1)*sheet.height/4)-2)
        path = image_save(sheet.crop(box), 'images/' + name + '.png')
        derivations[str(path.relative_to(FIX))] = {'parents':['source/contact-sheet.png'],'procedure':{'cropXYXY':box}}
    extra = FIX / 'source/self-four.png'
    if extra.exists():
        with Image.open(extra) as src:
            for i, name in enumerate(['calibration-long-hair','calibration-hat','heldout-long-hair','heldout-hat']):
                x,y = i%2,i//2
                box = (round(x*src.width/2)+2,round(y*src.height/2)+2,round((x+1)*src.width/2)-2,round((y+1)*src.height/2)-2)
                path=image_save(src.crop(box).convert('RGB'),'images/self/positive/'+name+'.png')
                derivations[str(path.relative_to(FIX))]={'parents':['source/self-four.png'],'procedure':{'cropXYXY':box}}
    review=[]
    for path in sorted((FIX/'images/self/positive').glob('*.png')):
        with Image.open(path) as src:
            # Deliberately generous AI draft, NOT human GT or model evaluation evidence.
            mask=Image.new('L',src.size)
            ImageDraw.Draw(mask).rectangle((int(src.width*.29),0,int(src.width*.70),int(src.height*.32)),fill=255)
            rel='masks/head-drafts/'+path.stem+'.png'
            image_save(mask,rel)
            masked=src.convert('RGB').copy(); masked.paste((127,127,127),(0,0,*src.size),mask)
            target='images/derived/'+path.stem+'-masked.png'; image_save(masked,target)
            derivations[rel]={'parents':[str(path.relative_to(FIX))],'procedure':'AI-authored conservative rectangle draft; not human annotated; not approved GT'}
            derivations[target]={'parents':[str(path.relative_to(FIX)),rel],'procedure':'Opaque RGB(127,127,127) paste using draft mask; local demonstration only, upload not approved'}
            review.append({'id':path.stem,'image':str(path.relative_to(FIX)),'sourceSha256':digest(path),'draftMask':rel,'groundTruthMask':None,'annotator':None,'annotatedAt':None,'reviewer':None,'reviewedAt':None,'status':'awaiting-human-annotation','expectedPerson':True,'expectedRegistration':True})
    for folder in ['negative','no-person']:
        for path in sorted((FIX/'images/self'/folder).glob('*.png')):
            review.append({'id':path.stem,'image':str(path.relative_to(FIX)),'sourceSha256':digest(path),'groundTruthMask':None,'expectedPerson':False,'expectedRegistration':False,'status':'classification-awaiting-human-review'})
    previous=FIX/'review/head.json'
    approved={c['id']:c for c in json.loads(previous.read_text())['cases'] if c.get('status')=='human-approved'} if previous.exists() else {}
    review=[approved[c['id']] if c['id'] in approved and approved[c['id']]['sourceSha256']==c['sourceSha256'] else c for c in review]
    save_json(previous,{'frozenAt':DATE,'classificationAuthor':'AI draft unless individual case records actual human approval','cases':review})
    item_cases=[]
    for shop in range(1,4):
        rel=f'images/shops/shop-{shop}-items.png'; src=Image.open(FIX/rel)
        for i in range(4):
            mask=Image.new('L',src.size)
            x0=round(src.width*i/4)+5; x1=round(src.width*(i+1)/4)-5
            box=(x0,round(src.height*.28),x1,round(src.height*.87))
            ImageDraw.Draw(mask).rectangle(box,fill=255)
            mrel=f'masks/items/shop-{shop}-candidate-{i+1}.png'; image_save(mask,mrel)
            cut=src.convert('RGBA'); cut.putalpha(mask)
            crel=f'images/derived/shop-{shop}-candidate-{i+1}.png'; image_save(cut,crel)
            derivations[mrel]={'parents':[rel],'procedure':'AI draft rectangular candidate mask; not SAM output or human GT'}
            derivations[crel]={'parents':[rel,mrel],'procedure':'RGBA alpha equals binary candidate mask; original upright dimensions'}
            item_cases.append({'image':rel,'mask':mrel,'cutout':crel,'bbox':[box[0],box[1],box[2]-box[0]+1,box[3]-box[1]+1],'score':1-i*.1,'sourceType':'hand-authored','annotationStatus':'ai-draft-unreviewed','tap':[int((box[0]+box[2])/2),int((box[1]+box[3])/2)]})
    save_json(FIX/'masks/items/cases.json',{'candidates':item_cases,'tapMasks':[c['mask'] for c in item_cases[:3]],'reviewer':None,'reviewedAt':None})
    for name in ['jeans','shoes']:
        rel=f'images/wardrobe/{name}-original.png'; src=Image.open(FIX/rel).convert('RGBA'); mask=Image.new('L',src.size)
        ImageDraw.Draw(mask).rectangle((int(src.width*.08),int(src.height*.06),int(src.width*(.58 if name=='jeans' else .93)),int(src.height*.97)),fill=255)
        mrel=f'masks/items/{name}-draft.png'; image_save(mask,mrel); src.putalpha(mask)
        target=f'images/wardrobe/{name}-cutout.png'; image_save(src,target)
        derivations[mrel]={'parents':[rel],'procedure':'AI draft binary region; human review pending'}
        derivations[target]={'parents':[rel,mrel],'procedure':'Binary alpha mask applied to original; not renamed opaque original'}
    for i in range(1,4):
        for j,kind in enumerate(['storefront','item']):
            origin=f'images/storefronts/shop-{i}.png' if kind=='storefront' else f'images/shops/shop-{i}-items.png'
            dest=f'capture/{(i-1)*2+j+1:02}-shop{i}-{kind}.png'; (FIX/dest).parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(FIX/origin,FIX/dest)
            derivations[dest]={'parents':[origin],'procedure':'Byte-identical sorted camera staging'}
    exif=Image.Exif(); exif[274]=6; exif[306]='2026:11:04 13:30:00'
    exif[34853]={1:'N',2:(37.0,32.0,40.2),3:'E',4:(127.0,3.0,19.8)}
    with Image.open(FIX/'images/shops/shop-1-items.png') as src:
        path=FIX/'capture-cases/exif/01-oriented-gps.jpg';path.parent.mkdir(parents=True,exist_ok=True);src.save(path,exif=exif)
    derivations[str(path.relative_to(FIX))]={'parents':['images/shops/shop-1-items.png'],'procedure':'JPEG with EXIF Orientation=6, DateTime and synthetic GPS for export stripping test'}
    corrupt=FIX/'capture-cases/corrupt/01-corrupt.png';corrupt.parent.mkdir(parents=True,exist_ok=True);corrupt.write_bytes(b'not a PNG')
    derivations[str(corrupt.relative_to(FIX))]={'parents':[],'procedure':'Intentionally undecodable negative input; decoder must reject'}
    save_json(FIX/'capture-cases/staging.json',{'empty':{'files':[],'expected':'capture failure, no fake image'},'corrupt':{'files':['corrupt/01-corrupt.png'],'expected':'decoder failure, no partial Store row'},'exif':{'files':['exif/01-oriented-gps.jpg'],'expected':'upright decoded output; exported GPS absent; in-app coordinates unchanged'}})
    save_json(FIX/'source/derivations.json',derivations)

def audio():
    # Speech output is deliberately excluded from public version control: Apple SLA 2F.
    for name,count in [('silence',80000),('limit-15s',240000),('over-15s',240001)]:
        samples=b'\0\0'*count if name=='silence' else b''.join(struct.pack('<h',int(8192*math.sin(2*math.pi*220*i/16000))) for i in range(count))
        pcm(FIX/f'audio/{name}.wav',samples)
        stage=FIX/f'voice/{name}/01-{name}.wav';stage.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(FIX/f'audio/{name}.wav',stage)
    tone=b''.join(struct.pack('<h',int(8192*math.sin(2*math.pi*220*i/16000))) for i in range(6400))
    for name,samples in [('tone-silence',tone+b'\0\0'*16000),('leading-5s',b'\0\0'*80000+tone)]:
        pcm(FIX/f'audio/{name}.wav',samples);pcm(FIX/f'voice/{name}/01-{name}.wav',samples)
    path=FIX/'voice/corrupt/01-corrupt.wav';path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b'RIFFbad!')
    save_json(FIX/'voice/staging.json',{'tone-silence':{'directory':'tone-silence','expected':'completed once, silence reason, >=400ms voiced energy plus1000ms silence'},'leading-5s':{'directory':'leading-5s','expected':'no_speech before subsequent tone'},'limit':{'directory':'limit-15s','expected':'completed once, limit,240000samples'},'empty':{'files':[],'expected':'audio_unavailable or io_error; no fake recording'},'corrupt':{'directory':'corrupt','expected':'reject invalid canonical44 WAV'},'disclosure':'220Hz signals test amplitude VAD only, not speech recognition or transcription quality'})
    if not (FIX/'audio/speech-source.json').exists():
        save_json(FIX/'audio/speech-source.json',{'text':'Find the blue jacket in the second shop','format':'PCM16 LE mono 16000Hz','trailingSilenceSamples':16000,'sourceType':'awaiting-licensed-human-recording','publicUseApproved':False,'reason':'Consenting human recording and explicit redistribution permission required; Apple System Voice is not distributable.'})


def traces():
    destination={'lat':37.5445,'lng':127.0555}
    def point(distance): return {'lat':destination['lat']+distance/111195,'lng':destination['lng']}
    sets={
      'shopping-three-shops':[(0,120,'start-shopping'),(5,115,'shop1-storefront'),(10,105,'shop1-item'),(20,85,'new-shop2'),(25,80,'shop2-storefront'),(30,0,'shop2-item'),(40,25,'new-shop3'),(45,20,'shop3-storefront'),(50,0,'shop3-item'),(55,0,'end-shopping')],
      'walk':[(0,100,'route'),(5,66,'route'),(10,50,'direction'),(15,21,'direction'),(20,20,'nearby-start'),(25,19,'nearby'),(30,19,'manual-confirm-arrival')],
      'walk-off-route':[(0,120,'route'),(5,115,'off-route-fix1'),(10,110,'off-route-fix2'),(15,105,'reroute'),(20,95,'cooldown'),(25,80,'route')],
      'walk-boundaries':[(0,66,'route'),(5,50,'direction'),(10,65,'direction'),(15,65.1,'route'),(20,50,'direction'),(25,20.1,'direction'),(30,20,'nearby-start'),(35,19.9,'nearby'),(40,19.9,'manual-confirm-arrival')]
    }
    for name, rows in sets.items():
        entries=[]; xml=['<?xml version="1.0" encoding="UTF-8"?>','<gpx version="1.1" creator="Street Fitting synthetic fixtures" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>']
        for index,(seconds,distance,event) in enumerate(rows):
            loc=point(distance)
            if name=='walk-off-route' and index in (1,2,3):loc['lng']+=.0005
            stamp=(datetime(2026,11,4,4,tzinfo=timezone.utc)+timedelta(seconds=seconds)).isoformat().replace('+00:00','Z')
            xml.append(f'<trkpt lat="{loc["lat"]:.9f}" lon="{loc["lng"]:.9f}"><time>{stamp}</time></trkpt>')
            entries.append({'index':index,'elapsedS':seconds,'event':event,'accuracyM':5,'distanceToDestinationM':distance})
        xml.append('</trkseg></trk></gpx>')
        path=FIX/f'gpx/{name}.gpx';path.parent.mkdir(parents=True,exist_ok=True);path.write_text('\n'.join(xml)+'\n')
        save_json(path.with_suffix('.expected.json'),{'source':'hand-authored synthetic; not actual location history','destination':destination,'shopSpot':point(85),'routeWaypoint':point(25),'accuracySource':'unit sidecar only; AVD reports observed accuracy','checkpoints':entries,'accuracyVariants':[{'accuracyM':31,'expected':'ignore-for-arrival-and-offroute'},{'accuracyM':30,'expected':'eligible'}]})

def store():
    trips=[];shops=[];photos=[]
    for day,tid in [('2026-11-04','today'),('2026-10-31','saturday')]:
        trips.append({'id':tid,'startedAt':day+'T13:00:00+09:00','endedAt':day+'T13:55:00+09:00','status':'ended'})
        for n in (1,2):
            sid=f'{tid}-shop{n}';shops.append({'id':sid,'tripId':tid,'n':n,'startedAt':day+f'T13:{0 if n==1 else 30:02}:00+09:00','descriptionState':'none' if n==2 else 'done',**({'description':'Blue awning shop'} if n==1 else {'note':'vintage'}),'spot':{'lat':37.5448,'lng':127.0555}})
            for j,minute in enumerate(([10,20] if n==1 else [34,35,40,45,46])):
                vector=[0.0]*512;vector[j]=1.0
                photos.append({'id':f'{sid}-photo{j+1}','tripId':tid,'shopId':sid,'takenAt':day+f'T13:{minute:02}:00+09:00','image':f'images/shops/shop-{n}-items.png','location':{'lat':37.5445,'lng':127.0555},'indexState':'done','vector':vector})
    def milliseconds(value):return int(datetime.fromisoformat(value).timestamp()*1000)
    native={'Trip':[{**t,'startedAt':milliseconds(t['startedAt']),'endedAt':milliseconds(t['endedAt'])} for t in trips],
            'Shop':[{**s,'startedAt':milliseconds(s['startedAt']),'spot':{**s['spot'],'accuracyM':5},'storefrontPhotoId':None,'description':s.get('description'),'note':s.get('note')} for s in shops],
            'Photo':[{k:v for k,v in {**p,'takenAt':milliseconds(p['takenAt']),'kind':'item','file':p['image'],'w':Image.open(FIX/p['image']).width,'h':Image.open(FIX/p['image']).height,'location':{**p['location'],'accuracyM':5}}.items() if k not in ('image','vector')} for p in photos],
            'PhotoEmbedding':[{'photoId':p['id'],'model':'pe-core-t16-image','dim':512,'vector':p['vector']} for p in photos]}
    common={'schemaVersion':1,'sourceType':'hand-authored','vectorProvenance':'synthetic normalized basis vectors, NOT PE model inference','trips':trips,'shops':shops,'photos':photos,'nativeSeed':native,'fileRefEncoding':'fixture-relative path; importer must stage into owned Store files before committing DTOs','now':'2026-11-04T14:00:00+09:00','timeZone':'Asia/Seoul'}
    save_json(FIX/'store/search.json',common)
    past={name:[row for row in rows if row.get('tripId',row.get('id',row.get('photoId',''))).startswith('saturday')] for name,rows in native.items()}
    save_json(FIX/'store/e2e.json',{**common,'nativeSeed':past,'trips':trips[1:],'shops':[s for s in shops if s['tripId']=='saturday'],'photos':[p for p in photos if p['tripId']=='saturday'],'captureManifest':[str(p.relative_to(FIX)) for p in sorted((FIX/'capture').glob('*.png'))],'currentTripCreatedBy':'real UI only; no clock/ID override'})
    cases={}
    for name in ['score-ties','empty-visits','all-trips','pending-index','failed-index','no-storefront']:
        state=copy.deepcopy(native)
        if name=='empty-visits':state={key:[] for key in state}
        if name=='score-ties':
            for row in state['PhotoEmbedding']:row['vector']=[1.0]+[0.0]*511
        if name in ('pending-index','failed-index'):
            for row in state['Photo']:row['indexState']=name.split('-')[0]
            state['PhotoEmbedding']=[]
        cases[name]={'nativeSeed':state,'expect':{'score-ties':'takenAt descending, then id ascending','empty-visits':'not found, no photo tool data','all-trips':'today and Saturday searchable','pending-index':'eligible photos remain available without vector','failed-index':'eligible photos remain available without vector','no-storefront':'note vintage and manual visit order remain usable'}[name]}
    cases['delete-during-search']={'base':'search.json','deletePhotoId':photos[0]['id'],'releaseLateToolResponseAfterDeletion':True,'expect':'deleted photo absent; no row/job resurrection'}
    cases['sam-empty-tap']={'base':'search.json','segmentResponse':{'photos':[]},'tapImage':'images/shops/shop-1-items.png','tapMasks':'masks/items/cases.json','expect':'user fallback tap offers three masks'}
    cases['verbatim-transcript']={'responseText':'  Find the blue jacket, please.  ','expectInput':'  Find the blue jacket, please.  ','automaticSearch':True}
    cases['voice-15s']={'audio':'audio/limit-15s.wav','samples':240000,'expectCompletedEvents':1,'stopReason':'limit'}
    cases['offline-browsing']={'base':'e2e.json','network':'offline','expectHTTPCalls':0,'allowedScreens':['trip','item','wardrobe','results']}
    cases['policy-error']={'relayScenario':'tryon-policy','expectResultRowsAdded':0,'expectTemporaryFilesAfter':0}
    cases['label-queue']={'origin':'shop','cutout':'images/derived/shop-1-candidate-1.png','networkTransitions':['offline','online'],'expectedKind':'label_piece','expectedSuccessCalls':1}
    cases['masking-failure']={'reviewCases':['half-body','neck-hidden','multiple-people','cropped-head','hanger','mannequin'],'expectUploadCalls':0,'preserveExistingSelf':True}
    cases['download-off']={'flag':False,'expectExportCalls':0,'expectMediaStoreRowsAdded':0}
    save_json(FIX/'store/variants.json',{'cases':cases,'resultDownload':False,'compositionThresholds':None})
    if not (FIX/'quality/thresholds.json').exists():
        save_json(FIX/'quality/thresholds.json',{'thresholdVersion':None,'neckShoulderDeltaE95':None,'offsetRatio95':None,'calibrationRun':None,'decision':'faceless-not-calibrated'})
    if not (FIX/'quality/cases.json').exists():
        save_json(FIX/'quality/cases.json',{'frozenAt':DATE,'calibration':['calibration-long-hair','calibration-hat'],'heldOut':['heldout-long-hair','heldout-hat'],'pocPlan':{'base':{'self':2,'maskModes':['opaque','crop','background-removed'],'reasoning':['low','high'],'calls':12},'bestRepeatCalls':3,'topOnlyCalls':1,'total':16},'humanApprovalRequired':True})

if __name__=='__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    images();audio();traces();store()
