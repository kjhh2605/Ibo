# Source from the repository root in each worker shell; never enable shell tracing here.
set +x
if [ -f "$HOME/.config/street-fitting/env.sh" ]; then
  . "$HOME/.config/street-fitting/env.sh"
fi
if [ ! -f .sf-worktree.env ]; then
  printf '%s\n' 'Run bash scripts/setup-worktree.sh first.' >&2
  return 1
fi
. ./.sf-worktree.env
if [ -f "$HOME/.config/street-fitting/secrets.env" ]; then
  . "$HOME/.config/street-fitting/secrets.env"
fi
export SF_MODELS_DIR="${SF_MODELS_DIR:-$HOME/.cache/street-fitting/models}"
# RELAY_MODE is deliberately not defaulted: callers must choose mock or live.
