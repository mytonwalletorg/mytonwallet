import type { ApiTransactionExtra } from '../blockchains/ton/types';
import type { StorageKey } from '../storages/types';
import type {
  AccountIdParsed, ApiLocalTransactionParams, ApiTransaction, OnApiUpdate,
} from '../types';

import { MAIN_ACCOUNT_ID } from '../../config';
import { buildAccountId, parseAccountId } from '../../util/account';
import { IS_EXTENSION } from '../environment';
import { storage } from '../storages';
import idbStorage from '../storages/idb';
import { getKnownAddresses, getScamMarkers } from './addresses';
import { whenTxComplete } from './txCallbacks';

let localCounter = 0;
const getNextLocalId = () => `${Date.now()}|${localCounter++}`;

const actualStateVersion = 7;
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

export function createLocalTransaction(onUpdate: OnApiUpdate, accountId: string, params: ApiLocalTransactionParams) {
  const {
    amount, fromAddress, toAddress, comment, fee, slug, type, encryptedComment,
  } = params;

  const localTransaction = buildLocalTransaction({
    amount,
    fromAddress,
    toAddress,
    comment,
    fee,
    slug,
    type,
    encryptedComment,
  });

  onUpdate({
    type: 'newLocalTransaction',
    transaction: localTransaction,
    accountId,
  });

  whenTxComplete(toAddress, amount)
    .then(({ txId }) => {
      onUpdate({
        type: 'updateTxComplete',
        accountId,
        toAddress,
        amount,
        txId,
        localTxId: localTransaction.txId,
      });
    });

  return localTransaction;
}

function buildLocalTransaction(params: ApiLocalTransactionParams): ApiTransaction {
  const { amount, ...restParams } = params;

  return updateTransactionMetadata({
    txId: getNextLocalId(),
    timestamp: Date.now(),
    isIncoming: false,
    amount: `-${amount}`,
    ...restParams,
  });
}

export function updateTransactionMetadata(transaction: ApiTransactionExtra): ApiTransactionExtra {
  const {
    isIncoming, fromAddress, toAddress, comment,
  } = transaction;
  let { metadata = {} } = transaction;

  const knownAddresses = getKnownAddresses();
  const scamMarkers = getScamMarkers();

  const address = isIncoming ? fromAddress : toAddress;
  if (address in knownAddresses) {
    metadata = { ...metadata, ...knownAddresses[address] };
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

export function startStorageMigration() {
  migrationEnsurePromise = migrateStorage();
  return migrationEnsurePromise;
}

export function waitStorageMigration() {
  return migrationEnsurePromise;
}

export async function migrateStorage() {
  let version = Number(await storage.getItem('stateVersion'));

  if (version === actualStateVersion) {
    return;
  }

  if (!version && !(await storage.getItem('addresses'))) {
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
    const addresses = await storage.getItem('addresses') as string | undefined;
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
}
