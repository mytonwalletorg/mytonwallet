import {
  app, BrowserWindow, ipcMain, shell, systemPreferences,
} from 'electron';
import windowStateKeeper from 'electron-window-state';
import path from 'path';

import { ElectronAction } from './types';

import { APP_ENV, BASE_URL, BETA_URL } from '../config';
import { AUTO_UPDATE_SETTING_KEY, getIsAutoUpdateEnabled, setupAutoUpdates } from './autoUpdates';
import { processDeeplink } from './deeplink';
import { captureStorage, restoreStorage } from './storageUtils';
import tray from './tray';
import {
  checkIsWebContentsUrlAllowed, FORCE_STORAGE_CAPTURED_SETTINGS_KEY, forceQuit,
  getIsForceStorageCaptureRequired, IS_FIRST_RUN, IS_MAC_OS, IS_PREVIEW, IS_WINDOWS,
  mainWindow, setMainWindow, store, WINDOW_STATE_FILE,
} from './utils';

const ALLOWED_DEVICE_ORIGINS = ['http://localhost:4321', 'file://', BASE_URL];

export function createWindow() {
  const windowState = windowStateKeeper({
    file: WINDOW_STATE_FILE,
    defaultWidth: 980,
    defaultHeight: 788,
  });

  const window = new BrowserWindow({
    show: false,
    x: windowState.x,
    y: windowState.y,
    minWidth: 360,
    minHeight: 690,
    width: windowState.width,
    height: windowState.height,
    title: 'MyTonWallet',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      devTools: APP_ENV !== 'production',
    },
    titleBarStyle: 'hidden',
    ...(IS_MAC_OS && {
      trafficLightPosition: { x: 19, y: 17 },
    }),
  });

  setMainWindow(window);

  mainWindow.on('page-title-updated', (event: Event) => {
    event.preventDefault();
  });

  windowState.manage(mainWindow);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.session.setDevicePermissionHandler(({ deviceType, origin }) => {
    return deviceType === 'hid' && ALLOWED_DEVICE_ORIGINS.includes(origin);
  });

  window.webContents.on('will-navigate', (event, newUrl) => {
    if (!checkIsWebContentsUrlAllowed(newUrl)) {
      event.preventDefault();
    }
  });

  if (!IS_MAC_OS) {
    setupWindowsTitleBar();
  }

  if (IS_WINDOWS && tray.isEnabled) {
    tray.create();
  }

  mainWindow.webContents.once('dom-ready', async () => {
    processDeeplink();

    if (APP_ENV === 'production') {
      setupAutoUpdates();
    }

    if (!IS_FIRST_RUN && getIsAutoUpdateEnabled() === undefined) {
      store.set(AUTO_UPDATE_SETTING_KEY, true);
      await captureStorage();
      loadWindowUrl();
    }

    if (await getIsForceStorageCaptureRequired()) {
      await captureStorage();
      store.set(FORCE_STORAGE_CAPTURED_SETTINGS_KEY, true);
      loadWindowUrl();
    }

    mainWindow.show();
  });

  loadWindowUrl();
}

async function loadWindowUrl(): Promise<void> {
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:4321');
    mainWindow.webContents.openDevTools();
  } else if (getIsAutoUpdateEnabled()) {
    if (await getIsForceStorageCaptureRequired()) {
      mainWindow.loadURL(BETA_URL);
    } else {
      mainWindow.loadURL(BASE_URL!);
    }
  } else if (getIsAutoUpdateEnabled() === undefined && IS_FIRST_RUN) {
    store.set(AUTO_UPDATE_SETTING_KEY, true);
    mainWindow.loadURL(BASE_URL!);
  } else {
    mainWindow.loadURL(`file://${__dirname}/index.html`);
  }
}

export function setupElectronActionHandlers() {
  ipcMain.handle(ElectronAction.HANDLE_DOUBLE_CLICK, () => {
    const doubleClickAction = systemPreferences.getUserDefault('AppleActionOnDoubleClick', 'string');

    if (doubleClickAction === 'Minimize') {
      mainWindow.minimize();
    } else if (doubleClickAction === 'Maximize') {
      if (!mainWindow.isMaximized()) {
        mainWindow.maximize();
      } else {
        mainWindow.unmaximize();
      }
    }
  });

  ipcMain.handle(ElectronAction.SET_IS_TRAY_ICON_ENABLED, (_, isTrayIconEnabled: boolean) => {
    if (isTrayIconEnabled) {
      tray.enable();
    } else {
      tray.disable();
    }
  });

  ipcMain.handle(ElectronAction.GET_IS_TRAY_ICON_ENABLED, () => tray.isEnabled);

  ipcMain.handle(ElectronAction.SET_IS_AUTO_UPDATE_ENABLED, async (_, isAutoUpdateEnabled: boolean) => {
    if (IS_PREVIEW) {
      return;
    }

    store.set(AUTO_UPDATE_SETTING_KEY, isAutoUpdateEnabled);
    await captureStorage();
    loadWindowUrl();
  });

  ipcMain.handle(ElectronAction.GET_IS_AUTO_UPDATE_ENABLED, () => {
    return store.get(AUTO_UPDATE_SETTING_KEY, true);
  });

  ipcMain.handle(ElectronAction.RESTORE_STORAGE, () => restoreStorage());
}

export function setupCloseHandlers() {
  mainWindow.on('close', (event: Event) => {
    if (IS_MAC_OS || (IS_WINDOWS && tray.isEnabled)) {
      if (forceQuit.isEnabled) {
        app.exit(0);
        forceQuit.disable();
      } else {
        event.preventDefault();
        mainWindow.hide();
      }
    }
  });

  app.on('window-all-closed', () => {
    if (!IS_MAC_OS) {
      app.quit();
    }
  });

  app.on('before-quit', (event: Event) => {
    if (IS_MAC_OS && !forceQuit.isEnabled) {
      event.preventDefault();
      forceQuit.enable();
      app.quit();
    }
  });

  app.on('activate', () => {
    const hasActiveWindow = BrowserWindow.getAllWindows().length > 0;

    if (!hasActiveWindow) {
      createWindow();
    }

    if (IS_MAC_OS && hasActiveWindow) {
      forceQuit.disable();
      mainWindow.show();
    }
  });
}

function setupWindowsTitleBar() {
  mainWindow.removeMenu();

  ipcMain.handle(ElectronAction.CLOSE, () => mainWindow.close());
  ipcMain.handle(ElectronAction.MINIMIZE, () => mainWindow.minimize());
  ipcMain.handle(ElectronAction.MAXIMIZE, () => mainWindow.maximize());
  ipcMain.handle(ElectronAction.UNMAXIMIZE, () => mainWindow.unmaximize());
  ipcMain.handle(ElectronAction.GET_IS_MAXIMIZED, () => mainWindow.isMaximized());
}
