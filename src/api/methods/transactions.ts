import { Cell } from '@ton/core';

import type { ApiSubmitTransferWithDieselResult } from '../chains/ton/types';
import type {
  ApiActivity,
  ApiChain,
  ApiLocalTransactionParams,
  ApiSignedTransfer,
  ApiTransactionActivity,
  OnApiUpdate,
} from '../types';
import type { ApiSubmitTransferOptions, ApiSubmitTransferResult, CheckTransactionDraftOptions } from './types';

import { parseAccountId } from '../../util/account';
import { getChainConfig } from '../../util/chain';
import { compareActivities } from '../../util/compareActivities';
import { logDebugError } from '../../util/logs';
import chains from '../chains';
import { fetchStoredAccount, fetchStoredAddress, fetchStoredTonWallet } from '../common/accounts';
import { buildLocalTransaction } from '../common/helpers';
import { getPendingTransfer, waitAndCreatePendingTransfer } from '../common/pendingTransfers';
import { handleServerError } from '../errors';
import { buildTokenSlug } from './tokens';

let onUpdate: OnApiUpdate;

const { ton, tron } = chains;

export function initTransactions(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function fetchTokenActivitySlice(
  accountId: string,
  chain: ApiChain,
  slug: string,
  fromTimestamp?: number,
  limit?: number,
): Promise<ApiActivity[] | { error: string }> {
  const { network } = parseAccountId(accountId);

  try {
    if (chain === 'ton') {
      const transactions = await chains[chain].fetchTokenTransactionSlice(
        accountId, slug, fromTimestamp, undefined, limit,
      );
      const activities = await ton.swapReplaceTransactions(accountId, transactions, network, slug);
      await ton.fixTokenActivitiesAddressForm(network, activities);
      return activities;
    } else {
      const activities = await chains[chain].getTokenTransactionSlice(
        accountId, slug, fromTimestamp, undefined, limit,
      );
      return activities;
    }
  } catch (err) {
    logDebugError('fetchTokenActivitySlice', err);
    return handleServerError(err);
  }
}

export async function fetchAllActivitySlice(
  accountId: string,
  limit: number,
  toTimestamp: number,
  tonTokenSlugs: string[],
  tronTokenSlugs: string[],
): Promise<ApiActivity[] | { error: string }> {
  const { network } = parseAccountId(accountId);

  try {
    const { type } = await fetchStoredAccount(accountId);

    const tonTransactions = await ton.getAllTransactionSlice(accountId, toTimestamp, limit, tonTokenSlugs);
    const tonActivities = await ton.swapReplaceTransactions(accountId, tonTransactions, network);
    await ton.fixTokenActivitiesAddressForm(network, tonActivities);

    if (type !== 'bip39') {
      return tonActivities;
    }

    const tronActivities = await tron.getAllTransactionSlice(accountId, toTimestamp, limit, tronTokenSlugs);

    if (!tonActivities.length && !tronActivities.length) {
      return [];
    } else if (!tonActivities.length) {
      return tronActivities;
    } else if (!tronActivities.length) {
      return tonActivities;
    }

    const fromTimestamp = Math.min(
      tonActivities[tonActivities.length - 1].timestamp,
      tronActivities && tronActivities[tronActivities.length - 1].timestamp,
    );

    return [...tronActivities, ...tonActivities]
      .sort(compareActivities)
      .filter(({ timestamp }) => timestamp >= fromTimestamp);
  } catch (err) {
    logDebugError('fetchAllActivitySlice', err);
    return handleServerError(err);
  }
}

export function checkTransactionDraft(chain: ApiChain, options: CheckTransactionDraftOptions) {
  return chains[chain].checkTransactionDraft(options);
}

export async function submitTransfer(
  chain: ApiChain,
  options: ApiSubmitTransferOptions,
  shouldCreateLocalTransaction = true,
): Promise<(ApiSubmitTransferResult | ApiSubmitTransferWithDieselResult) & { txId?: string }> {
  const {
    accountId,
    password,
    toAddress,
    amount,
    tokenAddress,
    comment,
    fee,
    realFee,
    shouldEncrypt,
    isBase64Data,
    withDiesel,
    dieselAmount,
    isGaslessWithStars,
  } = options;
  const stateInit = typeof options.stateInit === 'string' ? Cell.fromBase64(options.stateInit) : options.stateInit;

  const fromAddress = await fetchStoredAddress(accountId, chain);

  let result: ApiSubmitTransferResult | ApiSubmitTransferWithDieselResult;

  if (withDiesel && chain === 'ton') {
    result = await ton.submitTransferWithDiesel({
      accountId,
      password,
      toAddress,
      amount,
      tokenAddress: tokenAddress!,
      data: comment,
      shouldEncrypt,
      dieselAmount: dieselAmount!,
      isGaslessWithStars,
    });
  } else {
    result = await chains[chain].submitTransfer({
      accountId,
      password,
      toAddress,
      amount,
      tokenAddress,
      data: comment,
      shouldEncrypt,
      isBase64Data,
      stateInit,
      fee,
    });
  }

  if ('error' in result) {
    return result;
  }

  if (!shouldCreateLocalTransaction) {
    return result;
  }

  const slug = tokenAddress
    ? buildTokenSlug(chain, tokenAddress)
    : getChainConfig(chain).nativeToken.slug;

  let localTransaction: ApiTransactionActivity;

  if ('msgHash' in result) {
    const { encryptedComment, msgHash } = result;
    localTransaction = createLocalTransaction(accountId, chain, {
      amount,
      fromAddress,
      toAddress,
      comment: shouldEncrypt ? undefined : comment,
      encryptedComment,
      fee: realFee ?? 0n,
      slug,
      inMsgHash: msgHash,
    });
    if ('paymentLink' in result && result.paymentLink) {
      onUpdate({ type: 'openUrl', url: result.paymentLink, isExternal: true });
    }
  } else {
    const { txId } = result;
    localTransaction = createLocalTransaction(accountId, chain, {
      txId,
      amount,
      fromAddress,
      toAddress,
      comment,
      fee: realFee ?? 0n,
      slug,
    });
  }

  return {
    ...result,
    txId: localTransaction.txId,
  };
}

export async function waitAndCreateTonPendingTransfer(accountId: string) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);

  return (await waitAndCreatePendingTransfer(network, address)).id;
}

export async function sendSignedTransferMessage(
  accountId: string,
  message: ApiSignedTransfer,
  pendingTransferId: string,
) {
  const msgHash = await ton.sendSignedMessage(accountId, message, pendingTransferId);

  const localTransaction = createLocalTransaction(accountId, 'ton', {
    ...message.params,
    inMsgHash: msgHash,
  });

  return localTransaction.txId;
}

export function cancelPendingTransfer(id: string) {
  getPendingTransfer(id)?.resolve();
}

export function decryptComment(accountId: string, encryptedComment: string, fromAddress: string, password: string) {
  const chain = chains.ton;

  return chain.decryptComment(accountId, encryptedComment, fromAddress, password);
}

export function createLocalTransaction(accountId: string, chain: ApiChain, params: ApiLocalTransactionParams) {
  const { network } = parseAccountId(accountId);
  const { toAddress } = params;

  let normalizedAddress: string;
  if (params.normalizedAddress) {
    normalizedAddress = params.normalizedAddress;
  } else if (chain === 'ton') {
    normalizedAddress = ton.normalizeAddress(toAddress, network);
  } else {
    normalizedAddress = toAddress;
  }

  const localTransaction = buildLocalTransaction(params, normalizedAddress);

  onUpdate({
    type: 'newLocalTransaction',
    transaction: localTransaction,
    accountId,
  });

  return localTransaction;
}

export function fetchEstimateDiesel(accountId: string, tokenAddress: string) {
  const chain = chains.ton;

  return chain.fetchEstimateDiesel(accountId, tokenAddress);
}
