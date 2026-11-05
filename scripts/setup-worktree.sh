#!/bin/bash
# Run from a checkout, or configure this command as the Orca repository setup hook.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -f "$HOME/.config/street-fitting/env.sh" ]]; then
  source "$HOME/.config/street-fitting/env.sh"
fi

# Reserve distinct, persistent relay ports across this host's worktrees.
# This reserves configuration, not a listening socket; startup must still fail on EADDRINUSE.
python3 - <<'PY'
import fcntl
import json
import os
from pathlib import Path
import socket

root = str(Path.cwd().resolve())
state = Path.home() / '.cache/street-fitting'
state.mkdir(parents=True, exist_ok=True)
with (state / 'ports.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    registry = state / 'ports.json'
    ports = json.loads(registry.read_text()) if registry.exists() else {}
    if root not in ports:
        for port in range(8787, 8900):
            if port in ports.values():
                continue
            with socket.socket() as probe:
                try:
                    probe.bind(('127.0.0.1', port))
                except OSError:
                    continue
            ports[root] = port
            break
        else:
            raise SystemExit('No unreserved relay port in 8787..8899')
        pending = registry.with_suffix('.tmp')
        pending.write_text(json.dumps(ports, indent=2) + '\n')
        pending.replace(registry)
    output = Path('.sf-worktree.env')
    output.write_text(f'export RELAY_PORT={ports[root]}\n')
    output.chmod(0o600)
    print(f'Assigned RELAY_PORT={ports[root]}')
PY

npm --prefix app ci --no-audit --no-fund
if [[ -f "$HOME/.config/street-fitting/google-services.json" ]]; then
  install -m 600 "$HOME/.config/street-fitting/google-services.json" app/android/app/google-services.json
fi
if [[ -f relay/pyproject.toml ]]; then
  (cd relay && uv sync --locked)
else
  printf '%s\n' 'Relay not implemented yet; uv sync belongs after S00 creates its locked project.'
fi
printf '%s\n' 'Dependencies ready. In each worker shell: source scripts/worktree-env.sh'
