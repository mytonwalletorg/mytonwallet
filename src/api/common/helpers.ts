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
import { toBase64Address } from '../blockchains/ton/util/tonCore';
import { apiDb } from '../db';
import { getEnvironment } from '../environment';
import { storage } from '../storages';
import capacitorStorage from '../storages/capacitorStorage';
import idbStorage from '../storages/idb';
import { getKnownAddresses, getScamMarkers } from './addresses';

let localCounter = 0;
const getNextLocalId = () => `${Date.now()}|${localCounter++}`;

const actualStateVersion = 10;
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
  const { normalizedAddress, comment } = transaction;
  let { metadata = {} } = transaction;

  const knownAddresses = getKnownAddresses();
  const scamMarkers = getScamMarkers();

  if (normalizedAddress in knownAddresses) {
    metadata = { ...metadata, ...knownAddresses[normalizedAddress] };
  }

  if (comment && scamMarkers.map((sm) => sm.test(comment)).find(Boolean)) {
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

export function startStorageMigration(onUpdate: OnApiUpdate) {
  migrationEnsurePromise = migrateStorage(onUpdate);
  return migrationEnsurePromise;
}

export function waitStorageMigration() {
  return migrationEnsurePromise;
}

export async function migrateStorage(onUpdate: OnApiUpdate) {
  let version = Number(await storage.getItem('stateVersion'));

  if (version === actualStateVersion) {
    return;
  }

  if (IS_CAPACITOR) {
    const idbVersion = await idbStorage.getItem('stateVersion');
    if (idbVersion && !version) {
      version = Number(idbVersion);
    }
  }

  if (!version && !(await storage.getItem('addresses' as StorageKey))) {
    version = await idbStorage.getItem('stateVersion');

    if (IS_EXTENSION && version) {
      // Switching from IndexedDB to `chrome.storage.local`
      const idbData = await idbStorage.getAll!();
      await storage.setMany!(idbData);
    } else {
      await storage.setItem('stateVersion', actualStateVersion);
      return;
    }
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

        if (items.length) {
          await apiDb.sseConnections.bulkPut(items);
        }
      }

      version = 9;
      await storage.setItem('stateVersion', version);
    }
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
}
