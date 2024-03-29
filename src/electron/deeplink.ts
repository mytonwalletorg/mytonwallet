import { app, ipcMain } from 'electron';
import path from 'path';

import { ElectronAction, ElectronEvent } from './types';

import {
  focusMainWindow, IS_LINUX, IS_MAC_OS, IS_WINDOWS, mainWindow,
} from './utils';

const TON_PROTOCOL = 'ton';
const TRANSFER_PATH = 'transfer';
const TONCONNECT_PROTOCOL = 'tc';
const TONCONNECT_PROTOCOL_SELF = 'mytonwallet-tc';

let deeplinkUrl: string | undefined;

export function initDeeplink() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(TONCONNECT_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
      app.setAsDefaultProtocolClient(TONCONNECT_PROTOCOL_SELF, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(TONCONNECT_PROTOCOL);
    app.setAsDefaultProtocolClient(TONCONNECT_PROTOCOL_SELF);
  }

  ipcMain.handle(ElectronAction.TOGGLE_DEEPLINK_HANDLER, (event, isEnabled: boolean) => {
    if (!isEnabled) {
      app.removeAsDefaultProtocolClient(TON_PROTOCOL);
      return;
    }

    if (process.defaultApp) {
      if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient(TON_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
      }
    } else {
      app.setAsDefaultProtocolClient(TON_PROTOCOL);
    }
  });

  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();

    return;
  }

  app.on('will-finish-launching', () => {
    app.on('open-url', (event: Event, url: string) => {
      event.preventDefault();
      deeplinkUrl = url;
      processDeeplink();
      focusMainWindow();
    });
  });

  if (IS_WINDOWS || IS_LINUX) {
    deeplinkUrl = findDeeplink(process.argv);
  }

  app.on('second-instance', (_, argv: string[]) => {
    if (IS_MAC_OS) {
      deeplinkUrl = argv[0];
    } else {
      deeplinkUrl = findDeeplink(argv);
    }

    processDeeplink();
    focusMainWindow();
  });
}

export function processDeeplink() {
  if (!mainWindow || !deeplinkUrl) {
    return;
  }

  if (isTonTransferDeeplink(deeplinkUrl)) {
    mainWindow.webContents.send(ElectronEvent.DEEPLINK, {
      url: deeplinkUrl,
    });
  } else if (isTonConnectDeeplink(deeplinkUrl)) {
    mainWindow.webContents.send(ElectronEvent.DEEPLINK_TONCONNECT, {
      url: deeplinkUrl,
    });
  }

  deeplinkUrl = undefined;
}

function findDeeplink(args: string[]) {
  return args.find((arg) => isTonDeeplink(arg) || isTonConnectDeeplink(arg));
}

function isTonDeeplink(url: string) {
  return url.startsWith(`${TON_PROTOCOL}://`);
}

function isTonTransferDeeplink(url: string) {
  return url.startsWith(`${TON_PROTOCOL}://${TRANSFER_PATH}/`);
}

function isTonConnectDeeplink(url: string) {
  return url.startsWith(`${TONCONNECT_PROTOCOL}://`) || url.startsWith(`${TONCONNECT_PROTOCOL_SELF}://`);
}
