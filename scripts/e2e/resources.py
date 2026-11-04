"""Monotonic, payload-free process memory sampling; peaks are sampled, not exact."""
from contextlib import contextmanager
import re
import threading
import time
from runtime import adb, command, require


def android_pss():
    text=adb('shell','dumpsys','meminfo','com.streetfitting.app',timeout=20).decode()
    match=re.search(r'TOTAL PSS:\s*(\d+)',text) or re.search(r'\bTOTAL\s+(\d+)\s',text)
    require(match is not None,'android_pss_unavailable')
    return int(match[1])


def process_rss(pid):
    text=command(['ps','-p',str(pid),'-o','rss='],timeout=5).decode().strip()
    require(text.isdigit(),'relay_rss_unavailable')
    return int(text)


@contextmanager
def sample_memory(run, name, sample, interval):
    start=time.monotonic();stop=threading.Event();rows=[];errors=[]
    def collect():
        try:rows.append({'elapsedMs':round((time.monotonic()-start)*1000),'kiB':sample()})
        except Exception as error:errors.append(type(error).__name__)
    def worker():
        while not stop.wait(interval):collect()
    collect()
    thread=threading.Thread(target=worker,name='s11-memory-sampler',daemon=True);thread.start()
    try:yield rows
    finally:
        stop.set();thread.join(timeout=30)
        require(not thread.is_alive(),'memory_sampler_did_not_stop')
        collect()
        values=[row['kiB'] for row in rows]
        run.save(name,{'unit':'KiB','intervalSeconds':interval,'samples':rows,'errors':errors,'sampledPeak':max(values) if values else None,'initial':values[0] if values else None,'after':values[-1] if values else None,'scope':'sampled process memory, not an unsampled exact peak or physical-device battery'})
