import type blockchains from '../blockchains';
import type { ApiTransactionExtra } from '../blockchains/ton/types';
import type { ApiDbSseConnection } from '../db';
import type { StorageKey } from '../storages/types';
import type {
  AccountIdParsed,
  ApiAccount,
  ApiLocalTransactionParams,
  ApiTransaction,
  ApiTransactionActivity,
  OnApiUpdate,
} from '../types';

import { IS_CAPACITOR, IS_EXTENSION, MAIN_ACCOUNT_ID } from '../../config';
import { buildAccountId, parseAccountId } from '../../util/account';
import { areDeepEqual } from '../../util/areDeepEqual';
import { assert } from '../../util/assert';
import { logDebugError } from '../../util/logs';
import { toBase64Address } from '../blockchains/ton/util/tonCore';
import { getEnvironment } from '../environment';
import { storage } from '../storages';
import capacitorStorage from '../storages/capacitorStorage';
import idbStorage from '../storages/idb';
import {
  checkHasScamLink, checkHasTelegramBotMention, getKnownAddresses, getScamMarkers,
} from './addresses';
import { hexToBytes } from './utils';

let localCounter = 0;
const getNextLocalId = () => `${Date.now()}|${localCounter++}`;

const actualStateVersion = 16;
let migrationEnsurePromise: Promise<void>;

export function resolveBlockchainKey(accountId: string) {
  return parseAccountId(accountId).blockchain;
}

export function toInternalAccountId(accountId: string) {
  return buildInternalAccountId(parseAccountId(accountId));
}

export function buildInternalAccountId(account: Omit<AccountIdParsed, 'network'>) {
  const { id, blockchain } = account;
  return `${id}-${blockchain}`;
}

export function buildLocalTransaction(
  params: ApiLocalTransactionParams,
  normalizedAddress: string,
): ApiTransactionActivity {
  const { amount, ...restParams } = params;

  const transaction: ApiTransaction = updateTransactionMetadata({
    ...restParams,
    txId: getNextLocalId(),
    timestamp: Date.now(),
    isIncoming: false,
    amount: -amount,
    normalizedAddress,
    extraData: {},
  });

  return {
    ...transaction,
    id: transaction.txId,
    kind: 'transaction',
  };
}

export function updateTransactionMetadata(transaction: ApiTransactionExtra): ApiTransactionExtra {
  const {
    normalizedAddress, comment, type, isIncoming, nft,
  } = transaction;
  let { metadata = {} } = transaction;

  const isNftTransfer = type === 'nftTransferred' || type === 'nftReceived' || Boolean(nft);
  const knownAddresses = getKnownAddresses();
  const hasScamMarkers = comment ? getScamMarkers().some((sm) => sm.test(comment)) : false;
  const shouldCheckComment = !hasScamMarkers && comment && isIncoming
    && (isNftTransfer || comment.toLowerCase().includes('claim'));
  const hasScamInComment = shouldCheckComment
    ? (checkHasScamLink(comment) || checkHasTelegramBotMention(comment))
    : false;

  if (normalizedAddress in knownAddresses) {
    metadata = { ...metadata, ...knownAddresses[normalizedAddress] };
  }

  if (hasScamMarkers || hasScamInComment) {
    metadata.isScam = true;
  }

  return { ...transaction, metadata };
}

let currentOnUpdate: OnApiUpdate | undefined;

export function connectUpdater(onUpdate: OnApiUpdate) {
  currentOnUpdate = onUpdate;
}

export function disconnectUpdater() {
  currentOnUpdate = undefined;
}

export function isUpdaterAlive(onUpdate: OnApiUpdate) {
  return currentOnUpdate === onUpdate;
}

export function startStorageMigration(onUpdate: OnApiUpdate, ton: typeof blockchains.ton) {
  migrationEnsurePromise = migrateStorage(onUpdate, ton)
    .catch((err) => {
      logDebugError('Migration error', err);
      currentOnUpdate?.({
        type: 'showError',
        error: 'Migration error',
      });
    });
  return migrationEnsurePromise;
}

export function waitStorageMigration() {
  return migrationEnsurePromise;
}

export async function migrateStorage(onUpdate: OnApiUpdate, ton: typeof blockchains.ton) {
  let version = Number(await storage.getItem('stateVersion', true));

  if (version === actualStateVersion) {
    return;
  }

  if (IS_CAPACITOR && !version) {
    if (await storage.getItem('accounts' as StorageKey, true)) {
      // Fix broken version
      version = 10;
    } else {
      // Prepare for migration to secure storage
      const idbVersion = await idbStorage.getItem('stateVersion');
      if (idbVersion) {
        version = Number(idbVersion);
      }
    }
  }

  // Migration to chrome.storage
  if (IS_EXTENSION && !version && !(await storage.getItem('addresses' as StorageKey))) {
    version = await idbStorage.getItem('stateVersion');

    if (version) {
      // Switching from IndexedDB to `chrome.storage.local`
      const idbData = await idbStorage.getAll!();
      await storage.setMany!(idbData);
    }
  }

  if (!version) {
    await storage.setItem('stateVersion', actualStateVersion);
    return;
  }

  // First version (v1)
  if (!version) {
    // Support multi-accounts
    const mnemonicEncrypted = await storage.getItem('mnemonicEncrypted' as StorageKey);
    if (mnemonicEncrypted) {
      await storage.setItem('mnemonicsEncrypted', JSON.stringify({
        [MAIN_ACCOUNT_ID]: mnemonicEncrypted,
      }));
      await storage.removeItem('mnemonicEncrypted' as StorageKey);
    }

    // Change accountId format ('0' -> '0-ton', '1-ton-mainnet' -> '1-ton')
    if (!mnemonicEncrypted) {
      for (const field of ['mnemonicsEncrypted', 'addresses', 'publicKeys'] as StorageKey[]) {
        const raw = await storage.getItem(field);
        if (!raw) continue;

        const oldItem = JSON.parse(raw);
        const newItem = Object.entries(oldItem).reduce((prevValue, [accountId, data]) => {
          prevValue[toInternalAccountId(accountId)] = data;
          return prevValue;
        }, {} as any);

        await storage.setItem(field, JSON.stringify(newItem));
      }
    }

    version = 1;
    await storage.setItem('stateVersion', version);
  }

  if (version === 1) {
    const addresses = await storage.getItem('addresses' as StorageKey) as string | undefined;
    if (addresses && addresses.includes('-undefined')) {
      for (const field of ['mnemonicsEncrypted', 'addresses', 'publicKeys'] as StorageKey[]) {
        const newValue = (await storage.getItem(field) as string).replace('-undefined', '-ton');
        await storage.setItem(field, newValue);
      }
    }

    version = 2;
    await storage.setItem('stateVersion', version);
  }

  if (version >= 2 && version <= 4) {
    for (const key of ['addresses', 'mnemonicsEncrypted', 'publicKeys', 'dapps'] as StorageKey[]) {
      const rawData = await storage.getItem(key);
      if (typeof rawData === 'string') {
        await storage.setItem(key, JSON.parse(rawData));
      }
    }

    version = 5;
    await storage.setItem('stateVersion', version);
  }

  if (version === 5) {
    const dapps = await storage.getItem('dapps');
    if (dapps) {
      for (const accountDapps of Object.values(dapps) as any[]) {
        for (const dapp of Object.values(accountDapps) as any[]) {
          dapp.connectedAt = 1;
        }
      }
      await storage.setItem('dapps', dapps);
    }

    version = 6;
    await storage.setItem('stateVersion', version);
  }

  if (version === 6) {
    for (const key of ['addresses', 'mnemonicsEncrypted', 'publicKeys', 'accounts', 'dapps'] as StorageKey[]) {
      let data = await storage.getItem(key) as AnyLiteral;
      if (!data) continue;

      data = Object.entries(data).reduce((byAccountId, [internalAccountId, accountData]) => {
        const parsed = parseAccountId(internalAccountId);
        const mainnetAccountId = buildAccountId({ ...parsed, network: 'mainnet' });
        const testnetAccountId = buildAccountId({ ...parsed, network: 'testnet' });
        return {
          ...byAccountId,
          [mainnetAccountId]: accountData,
          [testnetAccountId]: accountData,
        };
      }, {} as AnyLiteral);

      await storage.setItem(key, data);
    }

    version = 7;
    await storage.setItem('stateVersion', version);
  }

  if (version === 7) {
    const addresses = (await storage.getItem('addresses' as StorageKey)) as Record<string, string> | undefined;

    if (addresses) {
      const publicKeys = (await storage.getItem('publicKeys' as StorageKey)) as Record<string, string>;
      const accounts = (await storage.getItem('accounts') ?? {}) as Record<string, ApiAccount>;

      for (const [accountId, oldAddress] of Object.entries(addresses)) {
        const newAddress = toBase64Address(oldAddress, false);

        accounts[accountId] = {
          ...accounts[accountId],
          address: newAddress,
          publicKey: publicKeys[accountId],
        };

        onUpdate({
          type: 'updateAccount',
          accountId,
          partial: {
            address: newAddress,
          },
        });
      }

      await storage.setItem('accounts', accounts);

      await storage.removeItem('addresses' as StorageKey);
      await storage.removeItem('publicKeys' as StorageKey);
    }

    version = 8;
    await storage.setItem('stateVersion', version);
  }

  if (version === 8) {
    if (getEnvironment().isSseSupported) {
      const dapps = await storage.getItem('dapps');

      if (dapps) {
        const items: ApiDbSseConnection[] = [];

        for (const accountDapps of Object.values(dapps) as any[]) {
          for (const dapp of Object.values(accountDapps) as any[]) {
            if (dapp.sse?.appClientId) {
              items.push({ clientId: dapp.sse?.appClientId });
            }
          }
        }
      }
    }

    version = 9;
    await storage.setItem('stateVersion', version);
  }

  if (version === 9) {
    if (IS_CAPACITOR) {
      const data = await idbStorage.getAll!();

      for (const [key, value] of Object.entries(data)) {
        await capacitorStorage.setItem(key as StorageKey, value);
        const newValue = await capacitorStorage.getItem(key as StorageKey, true);

        if (!areDeepEqual(value, newValue)) {
          throw new Error('Migration error!');
        }
      }
      await idbStorage.clear();
    }

    version = 10;
    await storage.setItem('stateVersion', version);
  }

  let isIosKeychainModeMigrated = false;
  if (getEnvironment().isIosApp && version >= 10 && version <= 13) {
    await iosBackupAndMigrateKeychainMode();
    isIosKeychainModeMigrated = true;
  }

  if (version === 10 || version === 11 || version === 12) {
    const accounts: Record<string, {
      publicKey: string;
      address: string;
      version?: string;
    }> | undefined = await storage.getItem('accounts', true);

    if (accounts) {
      for (const account of Object.values(accounts)) {
        const { publicKey, address, version: walletVersion } = account;

        if (walletVersion || !publicKey) continue;

        const publicKeyBytes = hexToBytes(publicKey);
        const walletInfo = ton.pickWalletByAddress('mainnet', publicKeyBytes, address);

        account.version = walletInfo.version;
      }

      await storage.setItem('accounts', accounts);
    }

    version = 13;
    await storage.setItem('stateVersion', version);
  }

  if (version === 13) {
    const accounts: Record<string, {
      publicKey: string;
      address: string;
      version?: string;
    }> | undefined = await storage.getItem('accounts', true);

    if (accounts) {
      for (const [accountId, account] of Object.entries(accounts)) {
        const { network } = parseAccountId(accountId);
        if (network === 'testnet') {
          account.address = toBase64Address(account.address, false, network);

          onUpdate({
            type: 'updateAccount',
            accountId,
            partial: {
              address: account.address,
            },
          });
        }
      }

      await storage.setItem('accounts', accounts);
    }
  }

  if (version === 14 || version === 15) {
    if (getEnvironment().isIosApp && !isIosKeychainModeMigrated) {
      await iosBackupAndMigrateKeychainMode();
    }

    version = 16;
    await storage.setItem('stateVersion', version);
  }
}

async function iosBackupAndMigrateKeychainMode() {
  const keys = await capacitorStorage.getKeys();

  if (keys?.length) {
    const items: [string, any][] = [];

    for (const key of keys) {
      if (key.startsWith('backup_')) {
        continue;
      }

      const backupKey = `backup_${key}` as StorageKey;
      const value = await capacitorStorage.getItem(key as StorageKey, true);

      assert(value !== undefined, 'Empty value!');
      await capacitorStorage.setItem(backupKey, value);
      const backupValue = await capacitorStorage.getItem(backupKey);
      assert(areDeepEqual(value, backupValue), 'Data has not been saved!');

      items.push([key, value]);
    }

    for (const [key, value] of items) {
      let shouldRewrite = false;
      await capacitorStorage.setItem(key as StorageKey, value).catch(() => {
        shouldRewrite = true;
      });

      if (shouldRewrite) {
        await capacitorStorage.removeItem(key as StorageKey);
        await capacitorStorage.setItem(key as StorageKey, value);
      }
    }
  }
}
