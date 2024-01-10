import { app, ipcMain, net } from 'electron';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import { autoUpdater, CancellationToken } from 'electron-updater';

import { ElectronAction, ElectronEvent } from './types';

import { PRODUCTION_URL } from '../config';
import getIsAppUpdateNeeded from '../util/getIsAppUpdateNeeded';
import { pause } from '../util/schedulers';
import {
  forceQuit, IS_MAC_OS, IS_PREVIEW, IS_WINDOWS, mainWindow, store,
} from './utils';

export const AUTO_UPDATE_SETTING_KEY = 'autoUpdate';

const ELECTRON_APP_VERSION_URL = 'electronVersion.txt';
const CHECK_UPDATE_INTERVAL = 5 * 60 * 1000;

let cancellationToken: CancellationToken = new CancellationToken();
let isUpdateCheckStarted = false;

export function setupAutoUpdates() {
  if (isUpdateCheckStarted) {
    return;
  }

  isUpdateCheckStarted = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  checkForUpdates();

  ipcMain.handle(ElectronAction.DOWNLOAD_UPDATE, () => {
    autoUpdater.downloadUpdate(cancellationToken).catch((error) => {
      mainWindow.webContents.send(ElectronEvent.UPDATE_ERROR, error);
    });
  });
  ipcMain.handle(ElectronAction.INSTALL_UPDATE, () => {
    if (IS_MAC_OS || IS_WINDOWS) {
      forceQuit.enable();
    }

    return autoUpdater.quitAndInstall();
  });
  ipcMain.handle(ElectronAction.CANCEL_UPDATE, () => {
    cancellationToken.cancel();
    cancellationToken = new CancellationToken();
  });

  autoUpdater.on('error', (error: Error) => {
    mainWindow.webContents.send(ElectronEvent.UPDATE_ERROR, error);
  });
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

export function getIsAutoUpdateEnabled() {
  return !IS_PREVIEW && store.get(AUTO_UPDATE_SETTING_KEY);
}

async function checkForUpdates(): Promise<void> {
  while (true) { // eslint-disable-line no-constant-condition
    if (await shouldPerformAutoUpdate()) {
      if (getIsAutoUpdateEnabled()) {
        autoUpdater.checkForUpdates();
      } else {
        mainWindow.webContents.send(ElectronEvent.UPDATE_DOWNLOADED);
      }
    }

    await pause(CHECK_UPDATE_INTERVAL);
  }
}

function shouldPerformAutoUpdate(): Promise<boolean> {
  return new Promise((resolve) => {
    const request = net.request(`${PRODUCTION_URL}/${ELECTRON_APP_VERSION_URL}?${Date.now()}`);

    request.on('response', (response) => {
      let contents = '';

      response.on('end', () => {
        resolve(getIsAppUpdateNeeded(contents, app.getVersion(), true));
      });

      response.on('data', (data: Buffer) => {
        contents = `${contents}${String(data)}`;
      });

      response.on('error', () => {
        resolve(false);
      });
    });

    request.on('error', () => {
      resolve(false);
    });

    request.end();
  });
}
