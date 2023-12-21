import { ipcMain, safeStorage, systemPreferences } from 'electron';

import { ElectronAction } from './types';

export function setupSecrets() {
  ipcMain.handle(ElectronAction.GET_IS_TOUCH_ID_SUPPORTED, () => {
    return safeStorage.isEncryptionAvailable() && systemPreferences.canPromptTouchID();
  });
  ipcMain.handle(ElectronAction.ENCRYPT_PASSWORD, (e, password: string) => {
    return safeStorage.encryptString(password).toString('base64');
  });
  ipcMain.handle(ElectronAction.DECRYPT_PASSWORD, async (e, encrypted: string) => {
    try {
      await systemPreferences.promptTouchID('confirm an operation in MyTonWallet');
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
    } catch (err) {
      return undefined;
    }
  });
}
