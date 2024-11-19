#!/usr/bin/env bash

DESTINATION=${1:-"dist"}

cp -R ./public/* "$DESTINATION"

cp ./src/lib/rlottie/rlottie-wasm.js "$DESTINATION"
cp ./src/lib/rlottie/rlottie-wasm.wasm "$DESTINATION"

FILES_TO_REMOVE=("static-sites")

if [ "$IS_CAPACITOR" = "1" ] || [ "$IS_EXTENSION" = "1" ] || [ "$IS_PACKAGED_ELECTRON" = "1" ]; then
    FILES_TO_REMOVE+=("get" "_headers" "_redirects" "statoscope-*")
fi

if [ "$IS_EXTENSION" = "1" ]; then
    FILES_TO_REMOVE+=("site.webmanifest")
else
    FILES_TO_REMOVE+=("extension*")
fi

if [ "$IS_PACKAGED_ELECTRON" != "1" ]; then
    FILES_TO_REMOVE+=("background-electron-dmg.tiff" "electron-entitlements.mac.plist" "icon-electron-*")
fi

for FILE in "${FILES_TO_REMOVE[@]}"; do
    rm -rf $DESTINATION/$FILE
done
