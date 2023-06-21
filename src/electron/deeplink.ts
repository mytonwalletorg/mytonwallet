import { app } from 'electron';
import path from 'path';

import { ElectronEvent } from './types';

import { IS_MAC_OS, IS_WINDOWS } from './utils';
import { mainWindow } from './window';

const DEEPLINK_PROTOCOL = 'ton';
const DEEPLINK_PATH = 'transfer';

let deeplinkUrl: string;

export function initDeeplink() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient(DEEPLINK_PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient(DEEPLINK_PROTOCOL);
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

  if (IS_WINDOWS) {
    deeplinkUrl = process.argv.slice(-1).join('');
  }

  app.on('second-instance', (_, argv: string[]) => {
    if (IS_MAC_OS) {
      deeplinkUrl = argv[0];
    } else {
      deeplinkUrl = argv.slice(-1).join('');
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
  if (!mainWindow || !deeplinkUrl?.startsWith(`${DEEPLINK_PROTOCOL}://${DEEPLINK_PATH}/`)) {
    return;
  }

  const parsed = new URL(deeplinkUrl);

  mainWindow.webContents.send(ElectronEvent.DEEPLINK, {
    to: parsed.pathname.replace(`//${DEEPLINK_PATH}/`, ''),
    amount: Number(parsed.searchParams.get('amount')),
    text: parsed.searchParams.get('text'),
  });

  deeplinkUrl = '';
}
