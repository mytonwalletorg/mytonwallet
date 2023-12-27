import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import Store from 'electron-store';
import fs from 'fs';

import { BASE_URL, PRODUCTION_URL } from '../config';

const ALLOWED_URL_ORIGINS = [BASE_URL!, PRODUCTION_URL].map((url) => (new URL(url).origin));

export let mainWindow: BrowserWindow; // eslint-disable-line import/no-mutable-exports
export const store: Store = new Store();

export function checkIsWebContentsUrlAllowed(url: string): boolean {
  if (!app.isPackaged) {
    return true;
  }

  const parsedUrl = new URL(url);

  if (parsedUrl.pathname === encodeURI(`${__dirname}/index.html`)) {
    return true;
  }

  return ALLOWED_URL_ORIGINS.includes(parsedUrl.origin);
}

export const WINDOW_STATE_FILE = 'window-state.json';
export const FORCE_STORAGE_CAPTURED_SETTINGS_KEY = 'forceStorageCaptured';

export const IS_MAC_OS = process.platform === 'darwin';
export const IS_WINDOWS = process.platform === 'win32';
export const IS_LINUX = process.platform === 'linux';
export const IS_PREVIEW = process.env.IS_PREVIEW === 'true';
export const IS_FIRST_RUN = !fs.existsSync(`${app.getPath('userData')}/${WINDOW_STATE_FILE}`);
export const IS_FORCE_STORAGE_CAPTURE_REQUIRED = app.getVersion() === '1.17.6'
  && !store.get(FORCE_STORAGE_CAPTURED_SETTINGS_KEY);

export function setMainWindow(window: BrowserWindow) {
  mainWindow = window;
}

export const forceQuit = {
  value: false,

  enable() {
    this.value = true;
  },

  disable() {
    this.value = false;
  },

  get isEnabled(): boolean {
    return this.value;
  },
};
