#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
source "$ROOT/scripts/worktree-env.sh"
exec uv --directory "$ROOT/relay" run python "$ROOT/scripts/e2e/entry.py" tryon-poc "$@"
