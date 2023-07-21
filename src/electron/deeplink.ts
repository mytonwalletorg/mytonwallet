import { app } from 'electron';
import path from 'path';

import { ElectronEvent } from './types';

import {
  IS_LINUX, IS_MAC_OS, IS_WINDOWS, mainWindow,
} from './utils';

const TON_PROTOCOL = 'ton';
const TRANSFER_PATH = 'transfer';
const TONCONNECT_PROTOCOL = 'tc';

let deeplinkUrl: string | undefined;

export function initDeeplink() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(TON_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
      app.setAsDefaultProtocolClient(TONCONNECT_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(TON_PROTOCOL);
    app.setAsDefaultProtocolClient(TONCONNECT_PROTOCOL);
  }

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

    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }

      mainWindow.focus();
    }
  });
}

export function processDeeplink() {
  if (!mainWindow || !deeplinkUrl) {
    return;
  }

  if (isTonTransferDeeplink(deeplinkUrl)) {
    const parsed = new URL(deeplinkUrl);
    mainWindow.webContents.send(ElectronEvent.DEEPLINK, {
      to: parsed.pathname.replace(/^.*\//g, ''),
      amount: Number(parsed.searchParams.get('amount')),
      text: parsed.searchParams.get('text'),
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
  return url.startsWith(`${TONCONNECT_PROTOCOL}://`);
}
