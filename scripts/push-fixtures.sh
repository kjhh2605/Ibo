#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/worktree-env.sh"
if [[ $# -ne 2 || ! -d "$2" || ( "$1" != capture && "$1" != voice ) ]]; then
  echo 'Usage: push-fixtures.sh capture|voice <dir>' >&2
  exit 64
fi
exec "$ROOT/scripts/emulator-lock.sh" bash -eu -o pipefail -c '
  adb shell run-as com.streetfitting.app true
  destination="/sdcard/Android/data/com.streetfitting.app/files/$1-fixtures"
  adb shell mkdir -p "$destination"
  adb push "$2/." "$destination/"
' -- "$1" "$2"
