#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/worktree-env.sh"
[[ $# -eq 1 && -f "$1" ]] || { echo 'Usage: gpx-replay.sh <gpx-file>' >&2; exit 64; }
exec "$ROOT/scripts/emulator-lock.sh" python3 - "$1" <<'PY'
import datetime
import math
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

points = []
for point in ET.parse(sys.argv[1]).getroot().iter():
    if point.tag.rsplit('}', 1)[-1] not in ('trkpt', 'rtept', 'wpt'):
        continue
    lat, lon = float(point.attrib['lat']), float(point.attrib['lon'])
    if not math.isfinite(lat) or not math.isfinite(lon) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise SystemExit('Invalid GPX coordinate')
    stamp = next((c.text for c in point if c.tag.rsplit('}', 1)[-1] == 'time'), None)
    stamp = datetime.datetime.fromisoformat(stamp.replace('Z', '+00:00')).timestamp() if stamp else None
    points.append((lon, lat, stamp))
if not points:
    raise SystemExit('No GPX points')
previous = None
for index, (lon, lat, stamp) in enumerate(points):
    if index:
        time.sleep(max(0, stamp - previous) if previous is not None and stamp is not None else 1)
    subprocess.run(['adb', 'emu', 'geo', 'fix', str(lon), str(lat)], check=True, stdout=subprocess.DEVNULL)
    previous = stamp
print(f'Replayed {len(points)} GPX points')
PY
