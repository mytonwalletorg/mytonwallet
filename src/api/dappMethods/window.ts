import storage from '../storages/idb';
import { createDappPromise, rejectAllDappPromises } from '../common/dappPromises';

// eslint-disable-next-line no-restricted-globals
const { chrome } = self;

let currentWindowId: number | undefined;
let readyPromise: Promise<void> | undefined;

const WINDOW_DEFAULTS = {
  top: 120,
  left: 20,
  width: 368,
  height: 750,
};
const MARGIN_RIGHT = 20;
const WINDOW_STATE_MONITOR_INTERVAL = 3000;

(function init() {
  if (!chrome) {
    return;
  }

  chrome.system.display.getInfo(([firstScreen]) => {
    if (firstScreen) {
      WINDOW_DEFAULTS.left = firstScreen.bounds.width - WINDOW_DEFAULTS.width - MARGIN_RIGHT;
    }
  });

  chrome.action.onClicked.addListener(openPopupWindow);

  chrome.windows.onRemoved.addListener((removedWindowId) => {
    if (removedWindowId !== currentWindowId) {
      return;
    }

    rejectAllDappPromises('Extension popup closed');

    currentWindowId = undefined;
    readyPromise = undefined;
  });

  setInterval(async () => {
    const currentWindow = await chrome.windows.getCurrent();
    if (!currentWindow || currentWindow.id !== currentWindowId) {
      return;
    }

    void storage.setItem('windowState', {
      top: currentWindow.top,
      left: currentWindow.left,
      height: currentWindow.height,
      width: currentWindow.width,
    });
  }, WINDOW_STATE_MONITOR_INTERVAL);
}());

export async function openPopupWindow() {
  if (typeof currentWindowId === 'number') {
    chrome.windows.update(currentWindowId, { focused: true });
    return readyPromise;
  }

  const lastWindowId = Number(await storage.getItem('windowId'));
  if (lastWindowId) {
    const wasWindowFound = await new Promise<boolean>((resolve) => {
      chrome.windows.get(lastWindowId, (window) => {
        resolve(Boolean(window));
      });
    });

    if (wasWindowFound) {
      currentWindowId = lastWindowId;
      chrome.windows.update(lastWindowId, { focused: true });
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
  const promise = new Promise<void>((resolve, reject) => {
    chrome.windows.create({
      ...WINDOW_DEFAULTS,
      ...lastState,
      url: 'index.html',
      type: 'popup',
      focused: true,
    }, (window) => {
      if (!window) {
        reject(new Error('Failed to create extension window'));
        return;
      }

      currentWindowId = window.id;
      readyPromise = createDappPromise('whenPopupReady').promise;
      resolve();

      void storage.setItem('windowId', currentWindowId);
    });
  });

  try {
    return await promise;
  } catch (err) {
    if (!isRetryingWithoutLastState) {
      return createWindow(true);
    } else {
      throw err;
    }
  }
}

export async function clearCache() {
  await chrome.webRequest.handlerBehaviorChanged();
}
