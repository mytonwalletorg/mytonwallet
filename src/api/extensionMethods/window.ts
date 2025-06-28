import extension from 'webextension-polyfill';

import { DEFAULT_PORTRAIT_WINDOW_SIZE } from '../../config';
import { createDappPromise, rejectAllDappPromises } from '../common/dappPromises';
import storage from '../storages/extension';

const { chrome } = self;

let currentWindowId: number | undefined;
let readyPromise: Promise<void> | undefined;

const WINDOW_DEFAULTS = {
  top: 120,
  left: 20,
  ...DEFAULT_PORTRAIT_WINDOW_SIZE,
};
const MARGIN_RIGHT = 20;
const WINDOW_STATE_MONITOR_INTERVAL = 3000;
const MINIMAL_WINDOW = 100;

(function init() {
  if (!chrome) {
    return;
  }

  if (chrome.system) {
    chrome.system.display.getInfo(([firstScreen]) => {
      if (firstScreen) {
        WINDOW_DEFAULTS.left = firstScreen.bounds.width - WINDOW_DEFAULTS.width - MARGIN_RIGHT;
      }
    });
  }

  extension.action.onClicked.addListener(openPopupWindow);

  extension.windows.onRemoved.addListener((removedWindowId) => {
    if (removedWindowId !== currentWindowId) {
      return;
    }

    rejectAllDappPromises('Extension popup closed');

    currentWindowId = undefined;
    readyPromise = undefined;
  });

  setInterval(async () => {
    const currentWindow = await extension.windows.getCurrent();
    if (!currentWindow || currentWindow.id !== currentWindowId) {
      return;
    }

    const { height = 0, width = 0 } = currentWindow;
    const correctHeight = Math.max(height, MINIMAL_WINDOW);
    const correctWidth = Math.max(width, MINIMAL_WINDOW);

    void storage.setItem('windowState', {
      top: currentWindow.top,
      left: currentWindow.left,
      height: correctHeight,
      width: correctWidth,
    });

    if (height < MINIMAL_WINDOW || width < MINIMAL_WINDOW) {
      await extension.windows.update(currentWindowId!, {
        height: MINIMAL_WINDOW,
        width: MINIMAL_WINDOW,
      });
    }
  }, WINDOW_STATE_MONITOR_INTERVAL);
}());

export async function openPopupWindow() {
  if (typeof currentWindowId === 'number') {
    await extension.windows.update(currentWindowId, { focused: true });
    return readyPromise;
  }

  const lastWindowId = Number(await storage.getItem('windowId'));
  if (lastWindowId) {
    let wasWindowFound: boolean;
    try {
      await extension.windows.get(lastWindowId);
      wasWindowFound = true;
    } catch (e) {
      wasWindowFound = false;
    }

    if (wasWindowFound) {
      currentWindowId = lastWindowId;
      await extension.windows.update(lastWindowId, { focused: true });
      readyPromise = Promise.resolve();
      return readyPromise;
    } else {
      await storage.removeItem('windowId');
    }
  }

  await createWindow();

  return readyPromise;
}

async function createWindow(isRetryingWithoutLastState = false): Promise<void> {
  const lastState = !isRetryingWithoutLastState ? await storage.getItem('windowState') : undefined;

  try {
    const window = await extension.windows.create({
      ...WINDOW_DEFAULTS,
      ...lastState,
      url: 'index.html',
      type: 'popup',
      focused: true,
    });

    if (!window) {
      throw new Error('Failed to create extension window');
    }

    currentWindowId = window.id;
    readyPromise = createDappPromise('whenPopupReady').promise;

    void storage.setItem('windowId', currentWindowId);
  } catch (err) {
    if (!isRetryingWithoutLastState) {
      await createWindow(true);
    } else {
      throw err;
    }
  }
}

export async function clearCache() {
  await extension.webRequest.handlerBehaviorChanged();
}

export async function updateWindowSize(size: { width: number; height: number }) {
  await extension.windows.update(currentWindowId!, size);
}
