"""Own one ephemeral observed relay on the worktree's assigned port."""
from contextlib import contextmanager
import json
import os
import signal
import socket
import subprocess
import sys
import time
from runtime import ROOT, Blocked, require
from resources import sample_memory, process_rss

@contextmanager
def observed_relay(run):
    port=int(os.environ.get('RELAY_PORT','8787'))
    with socket.socket() as probe:
        if probe.connect_ex(('127.0.0.1',port))==0:
            raise Blocked('Assigned relay port is occupied; stop its owner before running the S11 observed relay')
    identity=run.path/'native-identities.json'
    identity.write_text(json.dumps({'rawSelfPixelHashes':[],'headMaskSha256':[],'maskedSelfPixelHashes':[],'cutoutPixelHashes':[]}))
    report=run.path/'privacy-observer.json'
    old=os.environ.get('SF_PRIVACY_IDENTITIES')
    os.environ['SF_PRIVACY_IDENTITIES']=str(identity)
    env={**os.environ,'SF_PRIVACY_IDENTITIES':str(identity),'SF_PRIVACY_REPORT':str(report),
         'PYTHONDONTWRITEBYTECODE':'1','PYTHONPATH':os.pathsep.join([str(ROOT/'scripts/e2e'),str(ROOT/'relay')]),'PORT':str(port)}
    started=time.monotonic()
    process=subprocess.Popen([sys.executable,'-m','uvicorn','privacy_capture:create_app','--factory','--host','0.0.0.0','--port',str(port),'--workers','1','--no-access-log'],cwd=ROOT/'relay',env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    try:
        with sample_memory(run,'relay-memory.json',lambda:process_rss(process.pid),.25):
            deadline=time.monotonic()+180
            while True:
                require(process.poll() is None,'observed_relay_startup_failed')
                with socket.socket() as probe:
                    if probe.connect_ex(('127.0.0.1',port))==0:break
                if time.monotonic()>=deadline:raise Blocked('Observed relay startup deadline exceeded; inspect local model/auth prerequisites without logging credentials')
                time.sleep(.1)
            run.save('relay-startup.json',{'elapsedMs':round((time.monotonic()-started)*1000),'scope':'new process to listening after lifespan startup; filesystem-cache coldness not assumed','workers':1})
            yield
    finally:
        if process.poll() is None:
            process.send_signal(signal.SIGINT)
            try:process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                process.kill();process.wait(timeout=10)
        run.data['providerCalls']=sum(row['boundary']=='outbound' for row in json.loads(report.read_text())['records']) if report.exists() else None
        if old is None:os.environ.pop('SF_PRIVACY_IDENTITIES',None)
        else:os.environ['SF_PRIVACY_IDENTITIES']=old
