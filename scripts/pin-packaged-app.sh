#!/bin/sh
# Make /Applications/Coach Intel.app the only thing macOS will open
# for the Dock tile, Spotlight, and coachintel:// — not node_modules/Electron.app.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_NAME="Coach Intel.app"
DEST="/Applications/$APP_NAME"
ELECTRON_APP="$ROOT/node_modules/electron/dist/Electron.app"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"

strip_dev_scheme() {
  plist="$ELECTRON_APP/Contents/Info.plist"
  [ -f "$plist" ] || return 0
  /usr/libexec/PlistBuddy -c "Delete :CFBundleURLTypes" "$plist" 2>/dev/null || true
}

unregister() {
  [ -n "$1" ] || return 0
  "$LSREGISTER" -u "$1" >/dev/null 2>&1 || true
}

pin_dock() {
  python3 - "$DEST" <<'PY'
import os, plistlib, sys, urllib.parse

dest = os.path.abspath(sys.argv[1])
if not dest.endswith(".app"):
    raise SystemExit(0)
url = "file://" + urllib.parse.quote(dest) + "/"
dock_path = os.path.expanduser("~/Library/Preferences/com.apple.dock.plist")
if not os.path.exists(dock_path):
    raise SystemExit(0)

with open(dock_path, "rb") as fh:
    dock = plistlib.load(fh)

changed = False
need = True
needles = (
    "coach intel",
    "electron.app",
    "com.naevii.coachintel",
    "ci [coach intel]",
    "cci [cod coach intel]",
)

def matches(item):
    tile = item.get("tile-data") or {}
    blob = " ".join(
        [
            str(tile.get("file-label") or ""),
            str(tile.get("bundle-identifier") or ""),
            str((tile.get("file-data") or {}).get("_CFURLString") or ""),
        ]
    ).lower()
    return any(n in blob for n in needles)

apps = list(dock.get("persistent-apps") or [])
out = []
for item in apps:
    if not matches(item):
        out.append(item)
        continue
    tile = dict(item.get("tile-data") or {})
    tile["file-label"] = "Coach Intel"
    tile["bundle-identifier"] = "com.naevii.coachintel"
    tile["file-data"] = {"_CFURLString": url, "_CFURLStringType": 15}
    tile.pop("book", None)  # stale bookmark would keep opening Electron.app
    out.append({"tile-type": item.get("tile-type") or "file-tile", "tile-data": tile})
    changed = True
    need = False

if need:
    out.append(
        {
            "tile-type": "file-tile",
            "tile-data": {
                "file-label": "Coach Intel",
                "bundle-identifier": "com.naevii.coachintel",
                "file-data": {"_CFURLString": url, "_CFURLStringType": 15},
                "file-type": 1,
            },
        }
    )
    changed = True

if not changed:
    raise SystemExit(0)
dock["persistent-apps"] = out
with open(dock_path, "wb") as fh:
    plistlib.dump(dock, fh, fmt=plistlib.FMT_BINARY)
PY
  killall Dock >/dev/null 2>&1 || true
}

strip_dev_scheme
unregister "$ELECTRON_APP"
unregister "$HOME/Applications/$APP_NAME"
unregister "$ROOT/dist/mac-arm64/$APP_NAME"

if [ -d "$ELECTRON_APP" ]; then
  "$LSREGISTER" -f "$ELECTRON_APP" >/dev/null 2>&1 || true
fi
if [ -d "$DEST" ]; then
  "$LSREGISTER" -f "$DEST"
  pin_dock
fi
