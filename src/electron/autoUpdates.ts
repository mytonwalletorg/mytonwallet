import { ipcMain } from 'electron';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import { autoUpdater, CancellationToken } from 'electron-updater';

import { ElectronAction, ElectronEvent } from './types';

import { forceQuit, IS_MAC_OS, mainWindow } from './utils';

const CHECK_UPDATE_INTERVAL = 5 * 60 * 1000;

let cancellationToken: CancellationToken = new CancellationToken();
let interval: NodeJS.Timer;

export function setupAutoUpdates() {
  if (!interval) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.checkForUpdates();

    interval = setInterval(() => autoUpdater.checkForUpdates(), CHECK_UPDATE_INTERVAL);

    ipcMain.handle(ElectronAction.DOWNLOAD_UPDATE, () => {
      autoUpdater.downloadUpdate(cancellationToken).catch((error) => {
        mainWindow.webContents.send(ElectronEvent.UPDATE_ERROR, error);
      });
    });
    ipcMain.handle(ElectronAction.CANCEL_UPDATE, () => {
      cancellationToken.cancel();
      cancellationToken = new CancellationToken();
    });
    ipcMain.handle(ElectronAction.INSTALL_UPDATE, () => {
      if (IS_MAC_OS) {
        forceQuit.enable();
      }

      return autoUpdater.quitAndInstall();
    });
  }

  autoUpdater.on('error', (error: Error) => mainWindow.webContents.send(ElectronEvent.UPDATE_ERROR, error));
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    mainWindow.webContents.send(ElectronEvent.UPDATE_AVAILABLE, info);
  });
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    mainWindow.webContents.send(ElectronEvent.UPDATE_DOWNLOAD_PROGRESS, progress);
  });
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    mainWindow.webContents.send(ElectronEvent.UPDATE_DOWNLOADED, info);
  });
}
