#!/bin/sh
# Verifies a completed, signed macOS release without installing it.
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_PATH="${1:-$ROOT/dist/mac-universal/Coach Intel.app}"
VERSION="$(node -p "require(process.argv[1]).version" "$ROOT/package.json")"
DMG_PATH="${2:-$ROOT/dist/Coach-Intel-$VERSION-macOS.dmg}"

test -d "$APP_PATH"
test -f "$DMG_PATH"
codesign --verify --deep --strict --verbose=2 "$APP_PATH"
spctl --assess --type execute --verbose=4 "$APP_PATH"
xcrun stapler validate "$APP_PATH"
xcrun stapler validate "$DMG_PATH"

MOUNT_OUTPUT="$(hdiutil attach -nobrowse -readonly "$DMG_PATH")"
MOUNT_POINT="$(printf '%s\n' "$MOUNT_OUTPUT" | awk -F '\t' '/\/Volumes\// {print $NF; exit}')"
test -n "$MOUNT_POINT"
test -d "$MOUNT_POINT/Coach Intel.app"
hdiutil detach "$MOUNT_POINT" -quiet

echo "Verified $APP_PATH and $DMG_PATH"
