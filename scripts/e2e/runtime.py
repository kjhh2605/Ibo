"""Shared verification runtime; reports contain assertions, never request bodies."""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
from datetime import datetime, timezone
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT / 'verification/fixtures'
RESULTS = ROOT / 'verification/results'

class Blocked(RuntimeError):
    """A named external prerequisite is absent; never a successful skip."""


def require(condition, code):
    if not condition:
        raise AssertionError(code)


def load(path):
    return json.loads(Path(path).read_text())


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def command(argv, *, timeout=120, input=None, cwd=ROOT, env=None):
    result = subprocess.run([str(x) for x in argv], input=input, capture_output=True,
                            timeout=timeout, cwd=cwd, env=env)
    if result.returncode:
        # Child output can contain tokens, coordinates, or image bytes.
        raise RuntimeError(f'command_failed:{Path(str(argv[0])).name}:exit_{result.returncode}')
    return result.stdout


def run_path(run_id):
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,127}', run_id):
        raise ValueError('invalid_run_id')
    path = RESULTS / run_id
    require(path.resolve().parent == RESULTS.resolve(), 'run_path_escape')
    return path


class Run:
    def __init__(self, operation, mode=None, run_id=None):
        self.id = run_id or datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + operation + '-' + uuid4().hex[:8]
        self.path = run_path(self.id)
        self.path.mkdir(parents=True, exist_ok=False)
        self.start = time.monotonic()
        self.data = {'runId': self.id, 'operation': operation, 'mode': mode,
                     'status': 'running', 'assertions': [], 'providerCalls': 0,
                     'startedAt': datetime.now(timezone.utc).isoformat()}

    def save(self, name, value):
        require(re.fullmatch(r'[A-Za-z0-9_.-]+\.json', name), 'invalid_report_name')
        (self.path / name).write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')

    def finish(self, status, **values):
        self.data.update(values, status=status, elapsedMs=round((time.monotonic()-self.start)*1000))
        self.save('summary.json', self.data)
        return self.data


def device_environment():
    if not os.environ.get('ANDROID_SERIAL'):
        raise Blocked('ANDROID_SERIAL must select the single M1 Medium_Phone emulator')
    # Verify the inherited owner really is a live lockf ancestor, not a boolean.
    owner = os.environ.get('SF_EMULATOR_LOCK_OWNER', '')
    if not owner.isdigit():
        raise Blocked('Run the entire command under scripts/emulator-lock.sh')
    pid = os.getppid()
    while pid > 1:
        if str(pid) == owner:
            comm = command(['ps', '-p', str(pid), '-o', 'comm=']).decode().strip()
            require(comm == '/usr/bin/lockf', 'invalid_emulator_lock_owner')
            return
        pid = int(command(['ps', '-p', str(pid), '-o', 'ppid=']).strip())
    raise Blocked('The emulator lock owner is not an ancestor of this process')


def adb(*args, timeout=120, input=None):
    device_environment()
    return command(['adb', '-s', os.environ['ANDROID_SERIAL'], *args], timeout=timeout, input=input)


def approved_assets(paths):
    entries = {e['path']: e for e in load(FIX/'manifest.json')['assets']}
    for relative in paths:
        require(relative in entries, 'asset_not_manifested')
        entry = entries[relative]
        if not entry['terms'].get('publicUseApproved'):
            raise Blocked('Human/public-use approval required: verification/fixtures/' + relative)
        require(entry.get('sourceType') != 'macos-say', 'apple_system_voice_forbidden')
        require(digest(FIX/relative) == entry['sha256'], 'approved_asset_hash_changed')
    return entries
