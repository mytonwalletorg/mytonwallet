import type { BrowserWindow } from 'electron';

export const IS_MAC_OS = process.platform === 'darwin';
export const IS_WINDOWS = process.platform === 'win32';
export const IS_LINUX = process.platform === 'linux';

export let mainWindow: BrowserWindow; // eslint-disable-line import/no-mutable-exports
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
