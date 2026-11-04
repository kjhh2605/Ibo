#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/worktree-env.sh"
if [[ $# -ne 2 || ! -d "$2" || ( "$1" != capture && "$1" != voice ) ]]; then
  echo 'Usage: push-fixtures.sh capture|voice <dir>' >&2
  exit 64
fi
exec "$ROOT/scripts/emulator-lock.sh" bash -eu -o pipefail -c '
  package=com.streetfitting.app
  adb shell run-as "$package" true
  staging="$(adb shell mktemp -d /data/local/tmp/street-fitting-fixtures.XXXXXX | tr -d "\r")"
  trap "adb shell rm -rf \"$staging\" >/dev/null" EXIT
  adb push "$2/." "$staging/"
  adb shell chmod -R a+rX "$staging"
  destination="files/$1-fixtures"
  adb shell run-as "$package" mkdir -p files
  adb shell run-as "$package" rm -rf "$destination"
  adb shell run-as "$package" cp -R "$staging" "$destination"
' -- "$1" "$2"
