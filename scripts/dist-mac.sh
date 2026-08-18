#!/bin/sh
# Package Coach Intel and install it at /Applications/Coach Intel.app.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_NAME="Coach Intel.app"
DEST="/Applications/$APP_NAME"
SRC="$ROOT/dist/mac-arm64/$APP_NAME"

# Don't let a leftover Electron.dev instance keep the Dock/name.
pkill -f "$ROOT/node_modules/electron/dist/Electron.app" >/dev/null 2>&1 || true
pkill -f "/Applications/Coach Intel.app" >/dev/null 2>&1 || true

env -u ELECTRON_RUN_AS_NODE CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac --dir

rm -rf "$DEST"
cp -R "$SRC" "$DEST"
xattr -cr "$DEST"
find "$DEST" -name '._*' -delete

# electron-builder leaves helper CFBundleName as "Electron Helper …"
find "$DEST/Contents/Frameworks" -name Info.plist | while IFS= read -r plist; do
  name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleName' "$plist" 2>/dev/null || true)"
  case "$name" in
    "Electron Helper"*)
      new="$(printf '%s' "$name" | sed 's/^Electron Helper/Coach Intel Helper/')"
      /usr/libexec/PlistBuddy -c "Set :CFBundleName '$new'" "$plist"
      ;;
  esac
done

codesign --force --deep --sign - --identifier com.naevii.coachintel "$DEST"
rm -rf "$SRC"

# Older builds lived in ~/Applications and Dock would keep launching that copy.
rm -rf "$HOME/Applications/$APP_NAME"

chmod +x "$ROOT/scripts/pin-packaged-app.sh"
sh "$ROOT/scripts/pin-packaged-app.sh"

echo "Installed $DEST"
open -a "$DEST"
