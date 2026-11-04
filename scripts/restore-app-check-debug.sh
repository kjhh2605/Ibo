#!/bin/bash
# After a debug app-data reset, restore the already registered local debug secret.
# Source scripts/worktree-env.sh first. Never pass the secret as an argument.
set +x
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "$ROOT/scripts/emulator-lock.sh" python3 - <<'PY'
import pathlib
import stat
import subprocess
import xml.etree.ElementTree as ET

package = 'com.streetfitting.app'
secret_file = pathlib.Path.home() / '.config/street-fitting/app-check-debug-token'
if not secret_file.is_file() or stat.S_IMODE(secret_file.stat().st_mode) & 0o077:
    raise SystemExit('A private registered App Check debug-token file is required.')
secret = secret_file.read_text().strip()
if not secret:
    raise SystemExit('The App Check debug-token file is empty.')
# run-as refuses release builds; do not modify a release app or root the device.
subprocess.run(['adb', 'shell', 'run-as', package, 'true'], check=True)
subprocess.run(['adb', 'shell', 'am', 'force-stop', package], check=True)
preferences = ET.Element('map')
ET.SubElement(preferences, 'string', {'name': 'secret'}).text = secret
xml = ET.tostring(preferences, encoding='utf-8', xml_declaration=True)
subprocess.run([
    'adb', 'shell', 'run-as', package, 'sh', '-c',
    "'umask 077; mkdir -p shared_prefs && cat > shared_prefs/sf_app_check_debug.xml.tmp && mv shared_prefs/sf_app_check_debug.xml.tmp shared_prefs/sf_app_check_debug.xml'",
], input=xml, stdout=subprocess.DEVNULL, check=True)
raw = subprocess.check_output([
    'adb', 'exec-out', 'run-as', package, 'cat', 'shared_prefs/sf_app_check_debug.xml',
])
entry = ET.fromstring(raw).find("string[@name='secret']")
if entry is None or entry.text != secret:
    raise SystemExit('App Check debug-secret restoration failed.')
subprocess.run(['adb', 'shell', 'am', 'start', '-n', package + '/.MainActivity'], check=True)
print('Restored the registered App Check debug secret; no secret was logged.')
PY
