#!/bin/sh
# Never mutate node_modules/electron/Electron.app. It is already signed by
# Electron, and touching its Info.plist or resources invalidates that signature
# before electron-builder can make the final Coach Intel application bundle.
#
# Coach Intel branding, bundle ID, protocol registration and signing are applied
# only to the final packaged app through package.json electron-builder settings.
exit 0
