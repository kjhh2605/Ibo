"""Concrete offline/device gates used by entry.py. No success from absent evidence."""
from __future__ import annotations
import hashlib
import io
import json
import math
import os
from pathlib import Path
import re
import struct
import subprocess
import tempfile
import time
import zipfile
from PIL import Image
from types import SimpleNamespace
from runtime import ROOT, FIX, RESULTS, Blocked, adb, approved_assets, command, device_environment, digest, load, require, run_path


def human_head_inputs():
    review = load(FIX/'review/head.json')
    required={'calibration-hat','calibration-long-hair','hat','heldout-hat','heldout-long-hair','long-hair','cropped-head','half-body','multiple-people','neck-hidden','hanger','mannequin'}
    require({case['id'] for case in review['cases']}==required and len(review['cases'])==len(required),'head_case_coverage_incomplete')
    paths = []
    for case in review['cases']:
        if case.get('status') != 'human-approved' or case.get('humanAttestation') is not True:
            raise Blocked('Human annotation/classification required: verification/fixtures/review/head.json#'+case['id'])
        paths.append(case['image'])
        require(digest(FIX/case['image']) == case['sourceSha256'], 'review_source_hash_changed')
        if case['expectedRegistration']:
            if not case.get('groundTruthMask') or not all(case.get(k) for k in ('annotator','annotatedAt','reviewer','reviewedAt')):
                raise Blocked('Positive case requires actual human head GT: '+case['id'])
            paths.append(case['groundTruthMask'])
            require(digest(FIX/case['groundTruthMask'])==case.get('groundTruthSha256'),'human_head_mask_hash_changed')
    approved_assets(paths)
    return paths


def device_run(run, operation='run', scenario=None, **values):
    device_environment()
    options = {'operation':operation, 'mode':run.data['mode'], 'scenario':scenario, 'output':str(run.path), **values}
    # Config contains only operation/scenario/output paths, never credentials.
    with tempfile.TemporaryDirectory(prefix='sf-e2e-') as temp:
        config = Path(temp)/'options.json'
        config.write_text(json.dumps(options))
        from resources import sample_memory, android_pss
        memory_name='app-memory.json' if operation in {'run','research'} else 'app-memory-'+operation+'.json'
        with sample_memory(run,memory_name,android_pss,5):
            process = subprocess.run(['node',str(ROOT/'scripts/e2e/device.mjs'),str(config)], cwd=ROOT, capture_output=True, timeout=7200)
    try:
        result = json.loads(process.stdout)
    except (ValueError, UnicodeError):
        raise RuntimeError('device_runner_did_not_return_safe_json') from None
    run.save('device.json' if operation=='run' else operation+'.json',result)
    require(process.returncode == 0 and result.get('status') == 'passed', result.get('code','device_assertions_failed'))
    return result


def run_scenario(run, args):
    require(os.environ.get('RELAY_MODE') == args.mode, 'relay_mode_environment_mismatch')
    require(args.mode != 'live' or os.environ.get('RELAY_MOCK_SKIP_AUTH','0') == '0', 'live_auth_skip_forbidden')
    human_head_inputs()
    speech = FIX/'audio/query.wav'
    if not speech.exists():
        raise Blocked('Licensed consenting-human query WAV required: verification/fixtures/audio/query.wav')
    approved_assets(['audio/query.wav','voice/normal/01-query.wav','images/shops/shop-1-items.png','images/shops/shop-2-items.png']+[str(p.relative_to(FIX)) for p in (FIX/'capture').glob('*.png')]+['images/wardrobe/jeans-original.png'])
    device_environment()
    command([ROOT/'scripts/push-fixtures.sh','capture',FIX/'capture'])
    command([ROOT/'scripts/push-fixtures.sh','voice',FIX/'voice/normal'])
    if args.scenario=='full':
        for permission in ('ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION','POST_NOTIFICATIONS'):
            adb('shell','pm','revoke','com.streetfitting.app','android.permission.'+permission)
            adb('shell','pm','clear-permission-flags','com.streetfitting.app','android.permission.'+permission,'user-set','user-fixed')
    from observed_relay import observed_relay
    try:
        with observed_relay(run):
            adb('shell','am','start','-W','-n','com.streetfitting.app/.MainActivity','--es','sf_capture_source','fixture','--es','sf_capture_fixture_dir','/data/user/0/com.streetfitting.app/files/capture-fixtures/','--es','sf_voice_source','fixture','--es','sf_voice_fixture_dir','/data/user/0/com.streetfitting.app/files/voice-fixtures/')
            if args.scenario=='full':device_run(run,'head-mask')
            result=device_run(run,scenario=args.scenario)
    finally:
        report_path=run.path/'privacy-observer.json'
        if report_path.exists():
            run.data['providerCalls']=sum(row['boundary']=='outbound' for row in load(report_path)['records'])
        else:
            run.data['providerCalls']=None
    result['providerCalls']=run.data['providerCalls']
    if args.mode=='mock':require(result['providerCalls']==0,'mock_provider_calls_observed')
    if args.mode=='mock':
        observed=[{'endpoint':row['operation'],'fixture':row.get('fixture')} for row in load(run.path/'privacy-observer.json')['records'] if row['boundary']=='ingress' and row['operation'] in {'/v1/route','/v1/tryon'}]
        require(observed==result.get('phaseHeaders',[]),'android_phase_headers_not_observed_at_relay')
    return result


def privacy(run,args):
    source=run_path(args.run)
    observation=source/'privacy-observer.json'
    device=source/'device.json'
    if not observation.exists():
        raise Blocked('Missing shutdown report from memory observer: '+str(observation.relative_to(ROOT)))
    if not device.exists():
        raise Blocked('Missing actual Android ownership/deletion evidence: '+str(device.relative_to(ROOT)))
    report=load(observation);native=load(device);summary=load(source/'summary.json')
    require(report.get('status')=='passed' and not report.get('failures'),'memory_privacy_assertion_failed')
    require(report.get('rawBodiesPersisted') is False,'raw_body_persistence_not_disproved')
    require(report.get('relayWriteAttempts')==0 and report.get('relayDatabaseOpens')==0,'relay_persistence_observed')
    require(report.get('logRecords',0)>0,'metadata_logs_not_observed')
    require(report.get('nativeIdentityInventoryPresent') is True,'native_masked_identity_not_observed')
    records=report.get('records',[])
    ingress={r['operation'] for r in records if r['boundary']=='ingress'}
    require({'/v1/search/turn','/v1/search/segment','/v1/transcribe','/v1/describe/piece','/v1/describe/storefront','/v1/tryon','/v1/route'}<=ingress,'privacy_endpoint_coverage_incomplete')
    outbound=[r for r in records if r['boundary']=='outbound']
    if summary.get('mode')=='mock': require(not outbound,'mock_called_provider')
    else: require({'meta','route'}<={r['hostClass'] for r in outbound},'live_outbound_not_observed')
    values=native.get('devicePrivacy',{})
    require(values.get('rawSelfReads')==0 and values.get('headMaskReads')==0 and values.get('resultExports')==0,'device_private_read_or_export')
    heads=source/'head-mask.json'
    require(heads.exists(),'full_native_head_case_evidence_missing')
    head=load(heads);cases=head.get('cases',[])
    require(head.get('status')=='passed' and len(cases)==12 and all(case.get('passed') is True for case in cases),'full_native_head_cases_not_passed')
    require(values.get('otherResultPreserved') is True and values.get('deletedOwnedFiles') is True and values.get('embeddingCascade') is True,'full_deletion_proof_incomplete')
    require(values.get('snapshotIndependent') is True and values.get('endedTrailCount')==0,'device_ownership_not_proven')
    return {'sourceRun':args.run,'assertions':['memory-ingress-outbound','request-write-and-db-zero','metadata-logs','native-file-identity','trail-and-snapshot','export-off'],'providerCalls':len(outbound)}


def provenance(run,args):
    source=run_path(args.run)
    if (source/'summary.json').exists() and load(source/'summary.json').get('operation')=='tryon-poc':
        from quality import provenance as poc_provenance
        return poc_provenance(run,args)
    evidence=source/'provenance.json'
    if evidence.exists():
        result=load(evidence)
    elif (source/'device.json').exists():
        result=load(source/'device.json').get('provenance',{})
    else:
        raise Blocked('No provider/export observations from the specified run: '+args.run)
    require(result.get('status')=='passed','provenance_failed')
    require(result.get('resultDownload') is False and result.get('galleryUnchanged') is True,'unverified_provenance_export_enabled')
    rows=result.get('results',[])
    require(rows and all(r.get('providerUnchanged') is True and r.get('exportBlocked') is True and re.fullmatch('[a-f0-9]{64}',r.get('providerSha256','')) for r in rows),'provider_integrity_not_proven')
    observer=source/'privacy-observer.json'
    if not observer.exists():raise Blocked('Missing corresponding in-memory provider hash observation: '+args.run)
    records=load(observer)['records']
    delivered={r['providerSha256'] for r in records if r['boundary']=='relay-output'}
    require(all(r['providerSha256'] in delivered for r in rows),'saved_provider_differs_from_relay_bytes')
    if load(source/'summary.json').get('mode')=='live':
        original={r['providerSha256'] for r in records if r['boundary']=='provider-output'}
        require(delivered<=original,'relay_changed_original_provider_bytes')
    return {'sourceRun':args.run,**result,'note':'Export remains OFF; byte immutability is not proof of provider watermark preservation.'}


def elf_segments(raw):
    require(raw[:4]==b'\x7fELF','native_library_not_elf')
    require(raw[4]==2 and raw[5]==1,'arm64_requires_elf64_little_endian')
    require(struct.unpack_from('<H',raw,18)[0]==183,'library_not_aarch64')
    phoff=struct.unpack_from('<Q',raw,32)[0]
    phentsize,phnum=struct.unpack_from('<HH',raw,54)
    require(phentsize>=56 and phnum>0 and phoff+phentsize*phnum<=len(raw),'invalid_elf_program_headers')
    result=[]
    for i in range(phnum):
        kind,flags,offset,vaddr,paddr,filesz,memsz,align=struct.unpack_from('<IIQQQQQQ',raw,phoff+i*phentsize)
        if kind==1:
            require(align>=16384 and align&(align-1)==0 and offset%16384==vaddr%16384,'elf_load_not_16k_aligned')
            require(offset+filesz<=len(raw) and memsz>=filesz,'elf_load_out_of_bounds')
            result.append({'alignment':align,'offsetModulo16K':offset%16384,'virtualModulo16K':vaddr%16384})
    require(result,'elf_has_no_load_segments')
    return result


def inspect_apk(apk):
    libraries=[]
    with zipfile.ZipFile(apk) as archive,Path(apk).open('rb') as file:
        for member in archive.infolist():
            if not member.filename.startswith('lib/arm64-v8a/') or not member.filename.endswith('.so'):continue
            file.seek(member.header_offset);header=file.read(30)
            require(header[:4]==b'PK\x03\x04','invalid_zip_local_header')
            name_size,extra_size=struct.unpack_from('<HH',header,26)
            offset=member.header_offset+30+name_size+extra_size
            require(member.compress_type==zipfile.ZIP_STORED,'packaged_library_compressed')
            require(offset%16384==0,'zip_library_not_16k_aligned')
            libraries.append({'name':member.filename,'zipOffsetModulo16K':offset%16384,'segments':elf_segments(archive.read(member))})
    require(libraries,'apk_has_no_arm64_libraries')
    return {'apkSha256':digest(apk),'libraries':libraries}


def android_pages(run,args):
    apk=Path(args.apk)
    result=inspect_apk(apk if apk.is_absolute() else ROOT/apk)
    run.save('apk-alignment.json',result)
    device_environment()
    require(adb('shell','getconf','PAGE_SIZE').strip()==b'16384','avd_page_size_not_16k')
    human_head_inputs()
    result['inference']=device_run(run,'inference')
    result['pageSize']=16384
    return result


def measure(run,args):
    from research import measure as run_research
    return run_research(run,args)


def demo(run,args):
    if args.concat:
        if not args.inputs:raise Blocked('Pass --inputs with recorded live segment run IDs in presentation order')
        segments=[];coverage=[]
        for run_id in args.inputs:
            source=run_path(run_id);summary=load(source/'summary.json')
            require(summary.get('status')=='passed' and summary.get('operation')=='demo' and summary.get('mode')=='live','concat_requires_successful_live_segments')
            segment=source/'segment.webm';require(segment.is_file(),'recorded_segment_missing');segments.append(segment)
            coverage.append(summary.get('segment'))
        require(coverage==['full'] or coverage==['shopping','search','tryon','walk'],'demo_requires_ordered_full_flow_segments')
        with tempfile.TemporaryDirectory() as temp:
            concat=Path(temp)/'segments.txt'
            concat.write_text(''.join("file '"+str(p).replace("'","'\\''")+"'\n" for p in segments))
            output=run.path/'demo.mp4'
            command(['ffmpeg','-nostdin','-v','error','-f','concat','-safe','0','-i',concat,'-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',output],timeout=300)
        info=json.loads(command(['ffprobe','-v','error','-show_format','-show_streams','-of','json',output]))
        duration=float(info['format']['duration']);require(0<duration<=180,'demo_exceeds_three_minutes')
        require(any(s['codec_type']=='video' for s in info['streams']),'demo_has_no_video')
        command(['ffmpeg','-nostdin','-v','error','-i',output,'-f','null','-'],timeout=300)
        return {'durationS':duration,'decodedToEnd':True,'segments':args.inputs,'video':'demo.mp4'}
    require(args.mode=='live' and os.environ.get('RELAY_MODE')=='live','demo_requires_live')
    require(os.environ.get('RELAY_MOCK_SKIP_AUTH','0')=='0','demo_auth_skip_forbidden')
    require(1<=args.seconds<=180,'recording_seconds_out_of_range')
    human_head_inputs();device_environment()
    # GPU mode is an emulator startup fact, not inferred from renderer name.
    processes=command(['ps','-axo','command']).decode()
    require(any('Medium_Phone' in line and re.search(r'-gpu\s+host\b',line) for line in processes.splitlines()),'emulator_host_gpu_startup_not_observed')
    segment=run.path/'segment.webm'
    adb('emu','screenrecord','start','--time-limit',str(args.seconds),str(segment))
    start=time.monotonic()
    try:
        result=run_scenario(run,SimpleNamespace(mode='live',scenario=args.segment))
    finally:
        adb('emu','screenrecord','stop')
    require(time.monotonic()-start<=args.seconds,'scenario_outlasted_recording')
    require(segment.exists() and segment.stat().st_size>0,'console_recording_missing')
    command(['ffmpeg','-nostdin','-v','error','-i',segment,'-f','null','-'],timeout=300)
    return {'segment':args.segment,'video':'segment.webm','device':result,'source':'live emulator + local relay','decodedToEnd':True}
