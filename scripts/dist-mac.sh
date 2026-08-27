#!/bin/sh
# Package Coach Intel for macOS. This intentionally never installs into
# /Applications: official artifacts must be inspected before a person installs
# them, and production signing/notarization happens in CI.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "${COACH_INTEL_UNSIGNED:-}" = "1" ]; then
  echo "Building unsigned development artifacts; these are not official installers."
  CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --universal --publish never
else
  npx electron-builder --mac --universal --publish never
fi

echo "Artifacts are in $ROOT/dist. No application was installed."
