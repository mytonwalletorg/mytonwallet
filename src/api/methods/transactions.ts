import type { Storage } from '../storages/types';
import type {
  ApiSignedTransfer, ApiSubmitTransferOptions, ApiTxIdBySlug, OnApiUpdate,
} from '../types';

import { parseAccountId } from '../../util/account';
import blockchains from '../blockchains';
import { fetchStoredAddress } from '../common/accounts';
import { createLocalTransaction, resolveBlockchainKey } from '../common/helpers';

let onUpdate: OnApiUpdate;
let storage: Storage;

export function initTransactions(_onUpdate: OnApiUpdate, _storage: Storage) {
  onUpdate = _onUpdate;
  storage = _storage;
}

export function fetchTransactions(accountId: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getAccountTransactionSlice(storage, accountId);
}

export function fetchTokenTransactionSlice(accountId: string, slug: string, beforeTxId?: string, limit?: number) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getTokenTransactionSlice(storage, accountId, slug, beforeTxId, undefined, limit);
}

export function fetchAllTransactionSlice(accountId: string, lastTxIds: ApiTxIdBySlug, limit: number) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.getMergedTransactionSlice(storage, accountId, lastTxIds, limit);
}

export function checkTransactionDraft(
  accountId: string, slug: string, toAddress: string, amount: string, comment?: string, shouldEncrypt?: boolean,
) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.checkTransactionDraft(
    storage, accountId, slug, toAddress, amount, comment, undefined, shouldEncrypt,
  );
}

export async function submitTransfer(options: ApiSubmitTransferOptions) {
  const {
    accountId, password, slug, toAddress, amount, comment, fee, shouldEncrypt,
  } = options;

  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const fromAddress = await fetchStoredAddress(storage, accountId);
  const result = await blockchain.submitTransfer(
    storage, accountId, password, slug, toAddress, amount, comment, undefined, shouldEncrypt,
  );

  if ('error' in result) {
    return result;
  }

  const { encryptedComment } = result;
  const localTransaction = createLocalTransaction(onUpdate, accountId, {
    amount,
    fromAddress,
    toAddress,
    comment: shouldEncrypt ? undefined : comment,
    encryptedComment,
    fee: fee || '0',
    slug,
  });

  return {
    ...result,
    txId: localTransaction.txId,
  };
}

export async function waitLastTransfer(accountId: string) {
  const blockchain = blockchains.ton;

  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(storage, accountId);

  return blockchain.waitLastTransfer(network, address);
}

export async function sendSignedTransferMessage(accountId: string, message: ApiSignedTransfer) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  await blockchain.sendSignedMessage(storage, accountId, message);

  const localTransaction = createLocalTransaction(onUpdate, accountId, message.params);

  return localTransaction.txId;
}

export async function sendSignedTransferMessages(accountId: string, messages: ApiSignedTransfer[]) {
  const blockchain = blockchains.ton;

  const result = await blockchain.sendSignedMessages(storage, accountId, messages);

  for (let i = 0; i < result.successNumber; i++) {
    createLocalTransaction(onUpdate, accountId, messages[i].params);
  }

  return result;
}

export function decryptComment(accountId: string, encryptedComment: string, fromAddress: string, password: string) {
  const blockchain = blockchains.ton;

  return blockchain.decryptComment(storage, accountId, encryptedComment, fromAddress, password);
}
