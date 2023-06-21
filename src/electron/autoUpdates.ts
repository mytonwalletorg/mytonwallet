import { ipcMain } from 'electron';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import { autoUpdater, CancellationToken } from 'electron-updater';

import { ElectronAction, ElectronEvent } from './types';

import { IS_MAC_OS } from './utils';
import { mainWindow, setForceQuit } from './window';

const CHECK_UPDATE_INTERVAL = 5 * 60 * 1000;

let cancellationToken: CancellationToken = new CancellationToken();
let interval: NodeJS.Timer;

export function setupAutoUpdates() {
  if (interval) {
    clearInterval(interval);
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.checkForUpdates();

  interval = setInterval(() => autoUpdater.checkForUpdates(), CHECK_UPDATE_INTERVAL);

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
      setForceQuit();
    }

    return autoUpdater.quitAndInstall();
  });
}
