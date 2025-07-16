import { Cell } from '@ton/core';

import type { ApiSubmitTransferWithDieselResult, TonTransferParams } from '../chains/ton/types';
import type {
  ApiActivity,
  ApiAnyDisplayError,
  ApiChain,
  ApiLocalTransactionParams,
  ApiSignedTransfer,
  ApiTransactionActivity,
  ApiTransferToSign,
  OnApiUpdate,
} from '../types';
import type { ApiSubmitTransferOptions, ApiSubmitTransferResult, CheckTransactionDraftOptions } from './types';

import { parseAccountId } from '../../util/account';
import { mergeActivitiesToMaxTime } from '../../util/activities';
import { getChainConfig } from '../../util/chain';
import { logDebugError } from '../../util/logs';
import chains from '../chains';
import { fetchStoredAccount, fetchStoredAddress } from '../common/accounts';
import { buildLocalTransaction } from '../common/helpers';
import { swapReplaceCexActivities } from '../common/swap';
import { handleServerError } from '../errors';
import { buildTokenSlug, getTokenBySlug } from './tokens';

let onUpdate: OnApiUpdate;

const { ton, tron } = chains;

export function initTransactions(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function fetchActivitySlice(
  accountId: string,
  chain: ApiChain,
  slug: string,
  toTimestamp?: number,
  limit?: number,
  fromTimestamp?: number,
): Promise<ApiActivity[] | { error: string }> {
  let activities: ApiActivity[];

  try {
    if (chain === 'ton') {
      activities = await chains[chain].fetchActivitySlice(
        accountId, slug, toTimestamp, fromTimestamp, limit,
      );
    } else {
      activities = await chains[chain].getTokenTransactionSlice(
        accountId, slug, toTimestamp, fromTimestamp, limit,
      );
    }

    activities = await swapReplaceCexActivities(accountId, activities, slug);

    return activities;
  } catch (err) {
    logDebugError('fetchActivitySlice', err);
    return handleServerError(err);
  }
}

export async function fetchAllActivitySlice(
  accountId: string,
  limit: number,
  toTimestamp: number,
  tronTokenSlugs: string[],
): Promise<ApiActivity[] | { error: string }> {
  try {
    const account = await fetchStoredAccount(accountId);

    const [tonActivities, tronActivities] = await Promise.all([
      'ton' in account ? ton.fetchActivitySlice(accountId, undefined, toTimestamp, undefined, limit) : [],
      'tron' in account ? tron.getAllTransactionSlice(accountId, toTimestamp, limit, tronTokenSlugs) : [],
    ]);

    const activities = mergeActivitiesToMaxTime(tonActivities, tronActivities);

    return await swapReplaceCexActivities(accountId, activities);
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
  shouldCreateLocalActivity = true,
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

  if (!shouldCreateLocalActivity) {
    return result;
  }

  const slug = tokenAddress
    ? buildTokenSlug(chain, tokenAddress)
    : getChainConfig(chain).nativeToken.slug;

  let localActivity: ApiTransactionActivity;

  if ('msgHash' in result) {
    const { encryptedComment, msgHash, msgHashNormalized } = result;
    localActivity = createLocalTransaction(accountId, chain, {
      txId: msgHashNormalized,
      amount,
      fromAddress,
      toAddress,
      comment: shouldEncrypt ? undefined : comment,
      encryptedComment,
      fee: realFee ?? 0n,
      slug,
      externalMsgHash: msgHash,
      extra: {
        ...('withW5Gasless' in result && { withW5Gasless: result.withW5Gasless }),
      },
    });
    if ('paymentLink' in result && result.paymentLink) {
      onUpdate({ type: 'openUrl', url: result.paymentLink, isExternal: true });
    }
  } else {
    const { txId } = result;
    localActivity = createLocalTransaction(accountId, chain, {
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
    txId: localActivity.txId,
  };
}

export function decryptComment(accountId: string, encryptedComment: string, fromAddress: string, password: string) {
  const chain = chains.ton;

  return chain.decryptComment(accountId, encryptedComment, fromAddress, password);
}

export function createLocalTransaction(
  accountId: string,
  chain: ApiChain,
  params: ApiLocalTransactionParams,
  subId?: number,
) {
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

  const localTransaction = buildLocalTransaction(params, normalizedAddress, subId);

  onUpdate({
    type: 'newLocalActivity',
    activity: localTransaction,
    accountId,
  });

  return localTransaction;
}

export function fetchEstimateDiesel(accountId: string, tokenAddress: string) {
  const chain = chains.ton;

  return chain.fetchEstimateDiesel(accountId, tokenAddress);
}

export async function fetchTonActivityDetails(accountId: string, activity: ApiActivity) {
  const result = await chains.ton.fetchActivityDetails(accountId, activity);
  return result.activity;
}

export async function signTransactions(accountId: string, messages: ApiTransferToSign[], options: {
  vestingAddress?: string;
  /** Unix seconds */
  validUntil?: number;
} = {}): Promise<ApiSignedTransfer[] | { error: ApiAnyDisplayError }> {
  const chain = chains.ton;

  const preparedMessages = messages.map(({
    toAddress,
    amount,
    stateInit: stateInitBase64,
    rawPayload,
    payload,
  }): TonTransferParams => ({
    toAddress,
    amount,
    payload: rawPayload ? Cell.fromBase64(rawPayload) : undefined,
    stateInit: stateInitBase64 ? Cell.fromBase64(stateInitBase64) : undefined,
    hints: {
      tokenAddress: payload?.type === 'tokens:transfer'
        ? getTokenBySlug(payload.slug).tokenAddress
        : undefined,
    },
  }));

  const signedTransactions = await chain.signTransactions({
    accountId,
    expireAt: options.validUntil,
    messages: preparedMessages,
    ledgerVestingAddress: options.vestingAddress,
  });
  if ('error' in signedTransactions) return signedTransactions;

  return signedTransactions.map(({ seqno, transaction }) => ({
    seqno,
    base64: transaction.toBoc().toString('base64'),
  }));
}
