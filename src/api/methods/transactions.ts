import type {
  ApiLocalTransactionParams,
  ApiSignedTransfer,
  ApiSubmitTransferOptions,
  ApiTxIdBySlug,
  OnApiUpdate,
} from '../types';

import { parseAccountId } from '../../util/account';
import { logDebugError } from '../../util/logs';
import blockchains from '../blockchains';
import { fetchStoredAddress } from '../common/accounts';
import {
  buildLocalTransaction, resolveBlockchainKey,
} from '../common/helpers';
import { handleServerError } from '../errors';
import { swapReplaceTransactions } from './swap';

let onUpdate: OnApiUpdate;

export function initTransactions(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function fetchTokenActivitySlice(accountId: string, slug: string, fromTxId?: string, limit?: number) {
  const { network, blockchain } = parseAccountId(accountId);
  const activeBlockchain = blockchains[blockchain];
  try {
    const transactions = await activeBlockchain.getTokenTransactionSlice(accountId, slug, fromTxId, undefined, limit);
    const activities = await swapReplaceTransactions(accountId, transactions, network, slug);
    await activeBlockchain.fixTokenActivitiesAddressForm(network, activities);
    return activities;
  } catch (err) {
    logDebugError('fetchTokenActivitySlice', err);
    return handleServerError(err);
  }
}

export async function fetchAllActivitySlice(accountId: string, lastTxIds: ApiTxIdBySlug, limit: number) {
  const { network, blockchain } = parseAccountId(accountId);
  const activeBlockchain = blockchains[blockchain];
  try {
    const transactions = await activeBlockchain.getMergedTransactionSlice(accountId, lastTxIds, limit);
    const activities = await swapReplaceTransactions(accountId, transactions, network);
    await activeBlockchain.fixTokenActivitiesAddressForm(network, activities);
    return activities;
  } catch (err) {
    logDebugError('fetchAllActivitySlice', err);
    return handleServerError(err);
  }
}

export function checkTransactionDraft(
  accountId: string, slug: string, toAddress: string, amount: bigint, comment?: string, shouldEncrypt?: boolean,
) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  return blockchain.checkTransactionDraft(
    accountId, slug, toAddress, amount, comment, undefined, shouldEncrypt,
  );
}

export async function submitTransfer(options: ApiSubmitTransferOptions, shouldCreateLocalTransaction = true) {
  const {
    accountId, password, slug, toAddress, amount, comment, fee, shouldEncrypt,
  } = options;

  const blockchain = blockchains[resolveBlockchainKey(accountId)!];
  const fromAddress = await fetchStoredAddress(accountId);
  const result = await blockchain.submitTransfer(
    accountId, password, slug, toAddress, amount, comment, undefined, shouldEncrypt,
  );

  if ('error' in result) {
    return result;
  }

  const { encryptedComment } = result;

  if (!shouldCreateLocalTransaction) {
    return result;
  }

  const localTransaction = createLocalTransaction(accountId, {
    amount,
    fromAddress,
    toAddress,
    comment: shouldEncrypt ? undefined : comment,
    encryptedComment,
    fee: fee || 0n,
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
  const address = await fetchStoredAddress(accountId);

  return blockchain.waitLastTransfer(network, address);
}

export async function sendSignedTransferMessage(accountId: string, message: ApiSignedTransfer) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  await blockchain.sendSignedMessage(accountId, message);

  const localTransaction = createLocalTransaction(accountId, message.params);

  return localTransaction.txId;
}

export async function sendSignedTransferMessages(accountId: string, messages: ApiSignedTransfer[]) {
  const blockchain = blockchains.ton;

  const result = await blockchain.sendSignedMessages(accountId, messages);

  for (let i = 0; i < result.successNumber; i++) {
    createLocalTransaction(accountId, messages[i].params);
  }

  return result;
}

export function decryptComment(accountId: string, encryptedComment: string, fromAddress: string, password: string) {
  const blockchain = blockchains.ton;

  return blockchain.decryptComment(accountId, encryptedComment, fromAddress, password);
}

export function createLocalTransaction(accountId: string, params: ApiLocalTransactionParams) {
  const { blockchain: blockchainKey, network } = parseAccountId(accountId);
  const blockchain = blockchains[blockchainKey];

  const { toAddress } = params;

  const normalizedAddress = blockchain.normalizeAddress(toAddress, network);

  const localTransaction = buildLocalTransaction(params, normalizedAddress);

  onUpdate({
    type: 'newLocalTransaction',
    transaction: localTransaction,
    accountId,
  });

  return localTransaction;
}
