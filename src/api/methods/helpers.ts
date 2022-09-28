import { Storage } from '../storages/types';
import { ApiTransaction, OnApiUpdate } from '../types';

let localCounter = 0;
const getNextLocalId = () => `${Date.now()}|${localCounter++}`;

export function resolveBlockchainKey(accountId: string) {
  if (accountId === '0') {
    return 'ton';
  }

  return undefined;
}

export async function checkAccountIsAuthorized(storage: Storage, accountId?: string) {
  const addressesJson = await storage.getItem('addresses');
  if (!addressesJson) {
    return false;
  }
  if (!accountId) {
    return true;
  }
  const accountIds = Object.keys(JSON.parse(addressesJson) as Record<string, string>);
  return accountIds.includes(accountId);
}

export function buildLocalTransaction(params: {
  amount: string;
  fromAddress: string;
  toAddress: string;
  comment?: string;
  fee: string;
  slug?: string;
}): ApiTransaction {
  const { amount, ...restParams } = params;
  return {
    txId: getNextLocalId(),
    timestamp: Date.now(),
    isIncoming: false,
    amount: `-${amount}`,
    ...restParams,
  };
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
