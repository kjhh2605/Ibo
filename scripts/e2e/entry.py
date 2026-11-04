#!/usr/bin/env python3
"""S11 CLI: exit 0 passed, 1 failed, 2 blocked/usage. Paths are cwd-independent."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
from runtime import ROOT, Run, Blocked


def parser():
    result=argparse.ArgumentParser(description=__doc__)
    commands=result.add_subparsers(dest='command',required=True)
    validate=commands.add_parser('validate-fixtures');group=validate.add_mutually_exclusive_group(required=True);group.add_argument('--all',action='store_true');group.add_argument('--relay',action='store_true')
    record=commands.add_parser('record-relay');record.add_argument('--scenario',required=True);record.add_argument('--source',choices=['live'],required=True)
    run=commands.add_parser('run');run.add_argument('--mode',choices=['mock','live'],required=True);run.add_argument('--scenario',choices=['full','shopping','search','walk','tryon'],required=True)
    for name in ['privacy','provenance']:
        command=commands.add_parser(name);command.add_argument('--run',required=True)
        if name=='provenance':command.add_argument('--app-run',help='For a separate PoC run, link actual native app download-OFF evidence')
    head=commands.add_parser('head-mask');head.add_argument('--all',action='store_true',required=True)
    quality=commands.add_parser('tryon-poc');quality.add_argument('--plan',type=int,choices=[16],required=True);quality.add_argument('--mode',choices=['live'],required=True);quality.add_argument('--resume',help='Resume completed 12-call calibration after genuine human review')
    pages=commands.add_parser('android-pages');pages.add_argument('--apk',required=True)
    measurement=commands.add_parser('measure');measurement.add_argument('--suite',choices=['research10'],required=True);measurement.add_argument('--mode',choices=['live'],required=True);measurement.add_argument('--full-run');measurement.add_argument('--poc-run');measurement.add_argument('--seed-search',action='store_true',help='Explicitly import synthetic historical data using the S11 test APK, real device clock and real native index; requires empty trips')
    demo=commands.add_parser('demo');demo.add_argument('--mode',choices=['live'],default='live');demo.add_argument('--segment',choices=['full','shopping','search','walk','tryon'],default='full');demo.add_argument('--seconds',type=int,default=180);demo.add_argument('--concat',action='store_true');demo.add_argument('--inputs',nargs='+',help='Live segment run IDs in presentation order')
    return result


def main(argv=None):
    args=parser().parse_args(argv)
    if args.command=='validate-fixtures':
        return subprocess.run([sys.executable,str(ROOT/'scripts/e2e/validate_fixtures.py'),'--all' if args.all else '--relay'],cwd=ROOT).returncode
    selected_mode=getattr(args,'mode',getattr(args,'source',None))
    if selected_mode is not None:os.environ['RELAY_MODE']=selected_mode
    run=Run(args.command,getattr(args,'mode',getattr(args,'source',None)))
    try:
        import backends
        if args.command=='run':
            value=backends.run_scenario(run,args)
        elif args.command=='record-relay':
            from recording import record
            value=record(run,args)
        elif args.command=='head-mask':
            backends.human_head_inputs();value=backends.device_run(run,'head-mask')
        elif args.command=='tryon-poc':
            from quality import poc
            value=poc(run,args)
        elif args.command=='android-pages':value=backends.android_pages(run,args)
        elif args.command=='privacy':value=backends.privacy(run,args)
        elif args.command=='provenance':value=backends.provenance(run,args)
        elif args.command=='measure':value=backends.measure(run,args)
        elif args.command=='demo':
            if not args.concat and not args.segment:raise Blocked('Select --segment full|tryon|walk, or --concat --inputs <live-run-ids>')
            value=backends.demo(run,args)
        else:raise ValueError('unsupported_command')
        # A subordinate backend cannot turn a failed/blocked result into passed.
        if value.get('status','passed')!='passed':raise AssertionError('backend_did_not_pass')
        value.pop('status',None)
        result=run.finish('passed',**value);exit_code=0
    except Blocked as error:
        result=run.finish('blocked',blocked=[str(error)]);exit_code=2
    except KeyboardInterrupt:
        result=run.finish('failed',errorType='Interrupted',code='verification_cancelled');exit_code=130
    except Exception as error:
        # Validation errors often include rejected request values. Report only
        # static assertion codes, never repr/traceback or child stderr.
        import re
        code=str(error) if isinstance(error,(AssertionError,RuntimeError)) and re.fullmatch(r'[a-z][a-z0-9_:.-]{0,160}',str(error)) else 'verification_operation_failed'
        result=run.finish('failed',errorType=type(error).__name__,code=code);exit_code=1
    print(json.dumps(result,indent=2,allow_nan=False));return exit_code

if __name__=='__main__':sys.exit(main())
