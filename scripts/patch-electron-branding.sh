#!/bin/sh
# Do not brand the stock Electron.app as Coach Intel — that made Spotlight
# and the Dock open this leftover binary instead of /Applications/Coach Intel.app.
# Keep a unique bundle id so other projects' Electron.app copies don't collide,
# and do not claim coachintel:// (the packaged app owns that).
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$DIR/node_modules/electron/dist/Electron.app/Contents/Info.plist"
RES="$DIR/node_modules/electron/dist/Electron.app/Contents/Resources"

if [ -f "$PLIST" ]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleName 'Electron'" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName 'Electron'" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.naevii.coachintel.dev" "$PLIST" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes" "$PLIST" 2>/dev/null || true
fi

rm -rf "$RES/app"
