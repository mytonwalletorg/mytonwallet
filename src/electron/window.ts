import {
  app, BrowserWindow, ipcMain, shell, systemPreferences,
} from 'electron';
import windowStateKeeper from 'electron-window-state';
import path from 'path';

import { ElectronAction } from './types';

import { IS_MAC_OS } from './utils';

export let mainWindow: BrowserWindow; // eslint-disable-line import/no-mutable-exports

const ALLOWED_DEVICE_ORIGINS = ['http://localhost:4321', 'file://'];

export function createWindow() {
  const windowState = windowStateKeeper({
    defaultWidth: 980,
    defaultHeight: 788,
  });

  mainWindow = new BrowserWindow({
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
      devTools: process.env.APP_ENV !== 'production',
    },
    titleBarStyle: 'hidden',
    ...(IS_MAC_OS && {
      trafficLightPosition: { x: 19, y: 17 },
    }),
  });

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

  if (app.isPackaged) {
    mainWindow.loadURL(`file://${__dirname}/index.html`);
  } else {
    mainWindow.loadURL('http://localhost:4321');
    mainWindow.webContents.openDevTools();
  }

  if (!IS_MAC_OS) {
    setupWindowsTitleBar();
  }

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
}

let forceQuit = false;
export function setupCloseHandlers() {
  mainWindow.on('close', (event: Event) => {
    if (IS_MAC_OS) {
      if (forceQuit) {
        app.exit(0);
        forceQuit = false;
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
    if (IS_MAC_OS && !forceQuit) {
      event.preventDefault();
      forceQuit = true;
      app.quit();
    }
  });

  app.on('activate', () => {
    const hasActiveWindow = BrowserWindow.getAllWindows().length > 0;

    if (!hasActiveWindow) {
      createWindow();
    }

    if (IS_MAC_OS && hasActiveWindow) {
      forceQuit = false;
      mainWindow.show();
    }
  });
}

export function setForceQuit() {
  forceQuit = true;
}

function setupWindowsTitleBar() {
  mainWindow.removeMenu();

  ipcMain.handle(ElectronAction.CLOSE, () => mainWindow.destroy());
  ipcMain.handle(ElectronAction.MINIMIZE, () => mainWindow.minimize());
  ipcMain.handle(ElectronAction.MAXIMIZE, () => mainWindow.maximize());
  ipcMain.handle(ElectronAction.UNMAXIMIZE, () => mainWindow.unmaximize());
  ipcMain.handle(ElectronAction.GET_IS_MAXIMIZED, () => mainWindow.isMaximized());
}
