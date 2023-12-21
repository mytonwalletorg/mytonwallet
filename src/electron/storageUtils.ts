import type { StorageKey } from '../api/storages/types';

import { ACTIVE_TAB_STORAGE_KEY, INDEXED_DB_NAME, INDEXED_DB_STORE_NAME } from '../config';
import { checkIsWebContentsUrlAllowed, mainWindow } from './utils';

let localStorage: Record<string, any> | undefined;
let idb: { key: StorageKey; value: any }[] | undefined;

export function captureStorage(): Promise<[void, void]> {
  return Promise.all([captureLocalStorage(), captureIdb()]);
}

export function restoreStorage(): Promise<[void, void]> {
  return Promise.all([restoreLocalStorage(), restoreIdb()]);
}

async function captureLocalStorage(): Promise<void> {
  const contents = mainWindow.webContents;
  const contentsUrl = contents.getURL();

  if (!checkIsWebContentsUrlAllowed(contentsUrl)) {
    return;
  }

  localStorage = await contents.executeJavaScript('({ ...localStorage });');
}

async function captureIdb(): Promise<void> {
  const contents = mainWindow.webContents;
  const contentsUrl = contents.getURL();

  if (!checkIsWebContentsUrlAllowed(contentsUrl)) {
    return;
  }

  idb = await contents.executeJavaScript(`
    new Promise((resolve) => {
      const request = window.indexedDB.open('${INDEXED_DB_NAME}');

      request.onupgradeneeded = (event) => {
        event.target.transaction.abort();
        resolve();
      }

      request.onsuccess = (event) => {
        const result = [];

        const db = event.target.result;
        const transaction = db.transaction(['${INDEXED_DB_STORE_NAME}'], 'readonly');
        const store = transaction.objectStore('${INDEXED_DB_STORE_NAME}');

        store.openCursor().onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            result.push({ key: cursor.key, value: cursor.value });
            cursor.continue();
          } else {
            resolve(result);
          }
        };

        transaction.oncomplete = () => {
          db.close();
        };

        transaction.onerror = () => {
          resolve();
        };
      }

      request.onerror = () => {
        resolve();
      };
    });
  `);
}

export async function restoreLocalStorage(): Promise<void> {
  if (!localStorage) {
    return;
  }

  const contents = mainWindow.webContents;
  const contentsUrl = contents.getURL();

  if (!checkIsWebContentsUrlAllowed(contentsUrl)) {
    return;
  }

  await contents.executeJavaScript(
    Object.keys(localStorage)
      .filter((key: string) => key !== ACTIVE_TAB_STORAGE_KEY)
      .map((key: string) => `localStorage.setItem('${key}', JSON.stringify(${localStorage![key]}))`)
      .join(';'),
  );

  localStorage = undefined;
}

export async function restoreIdb(): Promise<void> {
  if (!idb) {
    return;
  }

  const contents = mainWindow.webContents;
  const contentsUrl = contents.getURL();

  if (!checkIsWebContentsUrlAllowed(contentsUrl)) {
    return;
  }

  await contents.executeJavaScript(`
    new Promise((resolve) => {
      const request = window.indexedDB.open('${INDEXED_DB_NAME}');

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('${INDEXED_DB_STORE_NAME}')) {
          db.createObjectStore('${INDEXED_DB_STORE_NAME}');
        }
      }

      request.onsuccess = (event) => {
        const result = {};

        const db = event.target.result;
        const transaction = db.transaction(['${INDEXED_DB_STORE_NAME}'], 'readwrite');
        const store = transaction.objectStore('${INDEXED_DB_STORE_NAME}');

        ${JSON.stringify(idb)}.forEach(item => {
          store.put(item.value, item.key);
        });

        transaction.oncomplete = () => {
          db.close();
          resolve();
        };

        transaction.onerror = () => {
          resolve();
        };
      }

      request.onerror = () => {
        resolve();
      };
    });
  `);

  idb = undefined;
}
