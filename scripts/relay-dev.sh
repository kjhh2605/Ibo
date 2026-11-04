#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/scripts/worktree-env.sh"
export PORT="${RELAY_PORT:?Run scripts/setup-worktree.sh first}"
cd "$ROOT/relay"
exec uv run uvicorn app.main:create_app --factory --host 0.0.0.0 --port "$PORT" --workers 1 --no-access-log "$@"
