#!/bin/bash
set -euo pipefail
if [[ $# -eq 0 ]]; then
  echo 'Usage: emulator-lock.sh <command> [args...]' >&2
  exit 64
fi
if [[ ! -x /usr/bin/lockf ]]; then
  echo 'Required device lock tool /usr/bin/lockf is unavailable.' >&2
  exit 69
fi
# Reuse only a live lockf ancestor, not an inherited boolean or stale marker.
if [[ "${SF_EMULATOR_LOCK_OWNER:-}" =~ ^[0-9]+$ ]]; then
  ancestor="$PPID"
  while [[ "$ancestor" -gt 1 ]]; do
    if [[ "$ancestor" == "$SF_EMULATOR_LOCK_OWNER" ]]; then
      owner_command="$(ps -p "$ancestor" -o comm=)"
      if [[ "$owner_command" == /usr/bin/lockf ]]; then
        exec "$@"
      fi
      break
    fi
    ancestor="$(ps -p "$ancestor" -o ppid= | tr -d ' ')"
    [[ "$ancestor" =~ ^[0-9]+$ ]] || break
  done
fi
mkdir -p "$HOME/.cache/street-fitting"
exec /usr/bin/lockf -k "$HOME/.cache/street-fitting/emulator.lock" /bin/bash -c '
  export SF_EMULATOR_LOCK_OWNER="$PPID"
  exec "$@"
' -- "$@"
