#!/usr/bin/env bash

DESTINATION=${1:-"dist"}


cp -R ./public/* "$DESTINATION"

cp ./src/lib/rlottie/rlottie-wasm.js "$DESTINATION"
cp ./src/lib/rlottie/rlottie-wasm.wasm "$DESTINATION"

if [ "$IS_CAPACITOR" = "1" ]; then
    FILES_TO_REMOVE+=("background-electron-dmg.tiff")
fi

for FILE in "${FILES_TO_REMOVE[@]}"; do
    FILE_PATH="$DESTINATION/$FILE"

    if [ -f "$FILE_PATH" ]; then
        rm "$FILE_PATH"
    fi
done
