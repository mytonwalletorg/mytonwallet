import { app, nativeImage } from 'electron';
import contextMenu from 'electron-context-menu';
import path from 'path';

import { setupAutoUpdates } from './autoUpdates';
import { initDeeplink, processDeeplink } from './deeplink';
import { IS_MAC_OS } from './utils';
import { createWindow, mainWindow, setupCloseHandlers } from './window';

import 'v8-compile-cache';

initDeeplink();

contextMenu({
  showLearnSpelling: false,
  showLookUpSelection: false,
  showSearchWithGoogle: false,
  showCopyImage: false,
});

app.on('ready', () => {
  if (IS_MAC_OS) {
    app.dock.setIcon(nativeImage.createFromPath(path.resolve(__dirname, '../public/icon-electron-macos.png')));
  }

  createWindow();
  setupCloseHandlers();

  mainWindow.webContents.once('dom-ready', () => {
    mainWindow.show();
    processDeeplink();
    setupAutoUpdates();
  });
});
