#!/bin/sh
# Always launch the packaged app from /Applications when it exists.
set -e
APP="/Applications/Coach Intel.app"
if [ -d "$APP" ]; then
  open -a "$APP"
  exit 0
fi
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
env -u ELECTRON_RUN_AS_NODE npx electron .
