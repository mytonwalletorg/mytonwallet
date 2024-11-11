import type { StorageKey } from '../storages/types';

import { storage } from '../storages';

type OldAccount = {
  address: string;
  publicKey: string;
  version: string;
  ledger?: {
    index: number;
    driver: string;
    deviceId?: string;
    deviceName?: string;
  };
  authToken?: string;
  isInitialized?: boolean;
};

export async function start() {
  const oldAccountById: Record<string, OldAccount> | undefined = await storage.getItem('accounts');

  if (!oldAccountById) return;

  const mnemonicById: Record<string, string> = await storage.getItem('mnemonicsEncrypted' as StorageKey);
  const newAccountById: Record<string, any> = {};

  for (const [accountId, oldAccount] of Object.entries(oldAccountById)) {
    const {
      address, version, publicKey, authToken, ledger, isInitialized,
    } = oldAccount;

    const tonWallet = {
      type: 'ton',
      address,
      version,
      publicKey,
      authToken,
      isInitialized,
      index: ledger?.index ?? 0,
    };

    newAccountById[accountId] = ledger ? {
      type: 'ledger',
      ton: tonWallet,
      driver: ledger.driver,
      deviceId: ledger.deviceId,
      deviceName: ledger.deviceName,
    } : {
      type: 'ton',
      mnemonicEncrypted: mnemonicById[accountId],
      ton: tonWallet,
    };
  }

  await storage.setItem('accounts', newAccountById);
}
