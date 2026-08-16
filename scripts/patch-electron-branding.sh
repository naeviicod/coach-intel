#!/bin/sh
# Keep the stock Electron.dev identity. Patching it to "Coach Intel" made
# Spotlight show two apps with the same name and bundle id, and often opened
# the leftover Electron binary instead of the real Coach Intel.app.
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$DIR/node_modules/electron/dist/Electron.app/Contents/Info.plist"
RES="$DIR/node_modules/electron/dist/Electron.app/Contents/Resources"

if [ -f "$PLIST" ]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleName 'Electron'" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName 'Electron'" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.github.Electron" "$PLIST" 2>/dev/null || true
fi

rm -rf "$RES/app"
