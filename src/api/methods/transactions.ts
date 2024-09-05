import { Cell } from '@ton/core';

import type { ApiSubmitTransferResult, ApiSubmitTransferWithDieselResult } from '../blockchains/ton/types';
import type {
  ApiLocalTransactionParams,
  ApiSignedTransfer,
  ApiSubmitTransferOptions,
  ApiTxIdBySlug,
  OnApiUpdate,
} from '../types';

import { TONCOIN_SLUG } from '../../config';
import { parseAccountId } from '../../util/account';
import { logDebugError } from '../../util/logs';
import blockchains from '../blockchains';
import { resolveTransactionError } from '../blockchains/ton/transactions';
import { fetchStoredAddress } from '../common/accounts';
import { buildLocalTransaction, resolveBlockchainKey } from '../common/helpers';
import { handleServerError } from '../errors';
import { swapReplaceTransactions } from './swap';
import { buildTokenSlug } from './tokens';

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

export function checkTransactionDraft(options: {
  accountId: string;
  tokenAddress?: string;
  toAddress: string;
  amount: bigint;
  data?: string;
  shouldEncrypt?: boolean;
  isBase64Data?: boolean;
  stateInit?: string;
}) {
  const blockchain = blockchains[resolveBlockchainKey(options.accountId)!];

  return blockchain.checkTransactionDraft(options);
}

export async function submitTransfer(options: ApiSubmitTransferOptions, shouldCreateLocalTransaction = true) {
  try {
    const {
      accountId, password, toAddress, amount, tokenAddress, comment, fee, shouldEncrypt, isBase64Data,
      withDiesel, dieselAmount,
    } = options;
    const stateInit = typeof options.stateInit === 'string' ? Cell.fromBase64(options.stateInit) : options.stateInit;

    const blockchain = blockchains[resolveBlockchainKey(accountId)!];
    const fromAddress = await fetchStoredAddress(accountId);

    let result: ApiSubmitTransferResult | ApiSubmitTransferWithDieselResult;

    if (withDiesel) {
      result = await blockchain.submitTransferWithDiesel({
        accountId,
        password,
        toAddress,
        amount,
        tokenAddress: tokenAddress!,
        data: comment,
        shouldEncrypt,
        dieselAmount: dieselAmount!,
      });
    } else {
      result = await blockchain.submitTransfer({
        accountId,
        password,
        toAddress,
        amount,
        tokenAddress,
        data: comment,
        shouldEncrypt,
        isBase64Data,
        stateInit,
      });
    }

    if ('error' in result) {
      return result;
    }

    const { encryptedComment, msgHash } = result;

    if (!shouldCreateLocalTransaction) {
      return result;
    }

    const slug = tokenAddress ? buildTokenSlug(tokenAddress) : TONCOIN_SLUG;

    const localTransaction = createLocalTransaction(accountId, {
      amount,
      fromAddress,
      toAddress,
      comment: shouldEncrypt ? undefined : comment,
      encryptedComment,
      fee: fee || 0n,
      slug,
      inMsgHash: msgHash,
    });

    return {
      ...result,
      txId: localTransaction.txId,
    };
  } catch (err) {
    logDebugError('submitTransfer', err);

    return { error: resolveTransactionError(err) };
  }
}

export async function waitLastTransfer(accountId: string) {
  const blockchain = blockchains.ton;

  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  return blockchain.waitPendingTransfer(network, address);
}

export async function sendSignedTransferMessage(accountId: string, message: ApiSignedTransfer) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  const msgHash = await blockchain.sendSignedMessage(accountId, message);

  const localTransaction = createLocalTransaction(accountId, {
    ...message.params,
    inMsgHash: msgHash,
  });

  return localTransaction.txId;
}

export async function sendSignedTransferMessages(accountId: string, messages: ApiSignedTransfer[]) {
  const blockchain = blockchains.ton;

  const result = await blockchain.sendSignedMessages(accountId, messages);

  for (let i = 0; i < result.successNumber; i++) {
    createLocalTransaction(accountId, {
      ...messages[i].params,
      inMsgHash: result.msgHashes[i],
    });
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

  const normalizedAddress = params.normalizedAddress ?? blockchain.normalizeAddress(toAddress, network);

  const localTransaction = buildLocalTransaction(params, normalizedAddress);

  onUpdate({
    type: 'newLocalTransaction',
    transaction: localTransaction,
    accountId,
  });

  return localTransaction;
}

export function fetchDieselState(accountId: string, tokenAddress: string) {
  const blockchain = blockchains.ton;

  return blockchain.fetchEstimateDiesel(accountId, tokenAddress);
}
