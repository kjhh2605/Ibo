"""M1-only test APK transport; no production source files or SQL are modified."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
from uuid import uuid4
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from runtime import ROOT, FIX, adb, command, device_environment, require

PKG='com.streetfitting.app'
BASE=f'/data/user/0/{PKG}/cache/s11-verification'


def install_driver():
    device_environment()
    command([ROOT/'app/android/gradlew','-p',ROOT/'app/android','--init-script',ROOT/'scripts/e2e/android.init.gradle',
             '-Dsf.verification.sources='+str(ROOT/'scripts/e2e/android-src'),'assembleDebugAndroidTest'],timeout=1800)
    apk=ROOT/'app/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk'
    require(apk.exists(),'verification_test_apk_missing')
    adb('install','-r',str(apk))


def stage_bytes(raw, suffix='.bin'):
    require(re.fullmatch(r'\.[a-z0-9]+',suffix),'invalid_staging_suffix')
    name=hashlib.sha256(raw).hexdigest()+suffix
    adb('shell','run-as',PKG,'mkdir','-p','cache/s11-verification')
    adb('shell','run-as',PKG,'sh','-c',"'cat > cache/s11-verification/"+name+"'",input=raw)
    return BASE+'/'+name


def stage_file(file):
    file=Path(file)
    return stage_bytes(file.read_bytes(),file.suffix)


def read_private(file):
    require(file.startswith(BASE+'/') and '..' not in file,'private_verification_path_escape')
    return adb('exec-out','run-as',PKG,'cat',file)


def remove_private(*files):
    for file in files:
        require(file.startswith(BASE+'/') and '..' not in file,'private_verification_path_escape')
        adb('shell','run-as',PKG,'rm','-f',file)


def invoke(request):
    source=stage_bytes(json.dumps(request,separators=(',',':')).encode(),'.json')
    destination=BASE+'/'+uuid4().hex+'.json'
    instrumentation=adb('shell','pm','list','instrumentation').decode()
    matches=re.findall(r'instrumentation:([^\s]+) \(target='+re.escape(PKG)+r'\)',instrumentation)
    require(len(matches)==1,'verification_instrumentation_runner_missing_or_ambiguous')
    try:
        output=adb('shell','am','instrument','-w','-r','-e','class','com.streetfitting.verification.NativeVerificationTest',
                   '-e','sfInput',source,'-e','sfOutput',destination,matches[0],timeout=1800)
        require(b'FAILURES!!!' not in output and b'INSTRUMENTATION_FAILED' not in output and b'OK (1 test)' in output,'native_verification_failed')
        report=json.loads(read_private(destination))
        require(report.get('status')=='passed','native_verification_report_failed')
        return report
    finally:
        remove_private(source,destination)


def seed(dataset='e2e',relative_time=False,storefronts=()):
    require(dataset in {'e2e','search'},'invalid_native_seed_dataset')
    fixture=json.loads((FIX/f'store/{dataset}.json').read_text());value=fixture['nativeSeed']
    reference=None;zone_name=None
    if relative_time:
        zone_name=adb('shell','getprop','persist.sys.timezone').decode().strip()
        zone=ZoneInfo(zone_name)
        reference=datetime.fromtimestamp(int(adb('shell','date','+%s').strip()),zone)
        original=datetime.fromisoformat(fixture['now']).astimezone(zone)
        today_shift=int((reference.timestamp()-original.timestamp())*1000)
        saturday=reference.date()-timedelta(days=(reference.weekday()-5)%7)
        shifts={}
        for trip in value['Trip']:
            when=datetime.fromtimestamp(trip['startedAt']/1000,zone)
            if when.date()==original.date():shift=today_shift
            else:
                target=datetime.combine(saturday,when.timetz(),zone)
                shift=int((target.timestamp()-when.timestamp())*1000)
            shifts[trip['id']]=shift
            for key in ('startedAt','endedAt'):
                if trip.get(key) is not None:trip[key]+=shift
        for shop in value['Shop']:shop['startedAt']+=shifts[shop['tripId']]
        for photo in value['Photo']:photo['takenAt']+=shifts[photo['tripId']]
    if storefronts:
        from PIL import Image
        shops={shop['id']:shop for shop in value['Shop']}
        for index,item in enumerate(storefronts):
            shop=shops[item['shopId']]
            with Image.open(FIX/item['image']) as image:width,height=image.size
            value['Photo'].append({'id':f'research-storefront-{index+1}','tripId':shop['tripId'],'shopId':shop['id'],'kind':'storefront','takenAt':shop['startedAt']+500,'file':item['image'],'w':width,'h':height,'location':shop['spot'],'indexState':'pending'})
    staged=[]
    try:
        for photo in value['Photo']:
            photo['file']=stage_file(FIX/photo['file']);staged.append(photo['file'])
        result=invoke({'operation':'seed','seed':value})
        result.update(dataset=dataset,relativeSyntheticTimes=relative_time,referenceNow=reference.isoformat() if reference else None,timeZone=zone_name)
        return result
    finally:remove_private(*set(staged))
