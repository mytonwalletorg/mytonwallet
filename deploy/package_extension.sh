#!/usr/bin/env bash

set -e

if [ -z "$1" ]; then
  echo "Missing argument: <target>"
  exit 1
fi

TARGET="$1"

cp -R ./public/* ./src/lib/rlottie/rlottie-wasm.js ./src/lib/rlottie/rlottie-wasm.wasm ./dist/

rm -rf ./dist/statoscope-* \
  ./dist/get \
  ./dist/background-electron-dmg.tiff \
  ./dist/electron-entitlements.mac.plist \
  ./dist/icon-electron-* \
  ./dist/site.webmanifest \
  ./dist/_headers

rm -f "MyTonWallet-$TARGET.zip"

cd dist

zip -r -X "../MyTonWallet-$TARGET.zip" ./*
