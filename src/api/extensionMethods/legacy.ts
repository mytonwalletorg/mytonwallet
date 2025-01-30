import { Cell } from '@ton/core';

import type { AnyPayload } from '../chains/ton/types';
import type { ApiSignedTransfer, OnApiUpdate } from '../types';
import type { OnApiSiteUpdate } from '../types/dappUpdates';

import { TONCOIN } from '../../config';
import { parseAccountId } from '../../util/account';
import { logDebugError } from '../../util/logs';
import chains from '../chains';
import {
  fetchStoredAccount,
  fetchStoredTonWallet,
  getCurrentAccountId,
  getCurrentAccountIdOrFail,
  waitLogin,
} from '../common/accounts';
import { createDappPromise } from '../common/dappPromises';
import { base64ToBytes, hexToBytes } from '../common/utils';
import { createLocalTransaction } from '../methods';
import { openPopupWindow } from './window';

const ton = chains.ton;
let onPopupUpdate: OnApiUpdate;

export function initLegacyDappMethods(_onPopupUpdate: OnApiUpdate) {
  onPopupUpdate = _onPopupUpdate;
}

export async function onDappSendUpdates(onDappUpdate: OnApiSiteUpdate) {
  const accounts = await requestAccounts();

  onDappUpdate({
    type: 'updateAccounts',
    accounts,
  });
}

export async function getBalance() {
  const accountId = await getCurrentAccountIdOrFail();

  return ton.getAccountBalance(accountId);
}

export async function requestAccounts() {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    return [];
  }

  const tonWallet = await fetchStoredTonWallet(accountId);
  if (!tonWallet) {
    return [];
  }

  return [tonWallet.address];
}

export async function requestWallets() {
  const accountId = await getCurrentAccountId();
  if (!accountId) {
    return [];
  }

  const { network } = parseAccountId(accountId);
  const { address, publicKey, version } = await fetchStoredTonWallet(accountId);
  const wallet = ton.buildWallet(network, publicKey, version);

  return [{
    address,
    publicKey,
    walletVersion: wallet ? ton.resolveWalletVersion(wallet) : undefined,
  }];
}

export async function sendTransaction(params: {
  to: string;
  value: string;
  data?: string;
  dataType?: 'text' | 'hex' | 'base64' | 'boc';
  stateInit?: string;
}) {
  const accountId = await getCurrentAccountIdOrFail();

  const {
    value, to: toAddress, data, dataType, stateInit,
  } = params;
  const amount = BigInt(value);

  let processedData: AnyPayload | undefined;
  if (data) {
    switch (dataType) {
      case 'hex':
        processedData = hexToBytes(data);
        break;
      case 'base64':
        processedData = base64ToBytes(data);
        break;
      case 'boc':
        processedData = Cell.fromBase64(data);
        break;
      default:
        processedData = data;
    }
  }

  const processedStateInit = stateInit ? Cell.fromBase64(stateInit) : undefined;

  await openPopupWindow();
  await waitLogin();

  const checkResult = await ton.checkTransactionDraft({
    accountId,
    toAddress,
    amount,
    data: processedData,
    stateInit,
  });

  if ('error' in checkResult) {
    onPopupUpdate({
      type: 'showError',
      error: checkResult.error,
    });

    return false;
  }

  const { promiseId, promise } = createDappPromise();

  const { type } = await fetchStoredAccount(accountId);

  if (type === 'ledger') {
    return sendLedgerTransaction(accountId, promiseId, promise, checkResult.fee, checkResult.realFee, params);
  }

  onPopupUpdate({
    type: 'createTransaction',
    promiseId,
    toAddress,
    amount,
    fee: checkResult.fee!,
    ...(dataType === 'text' && {
      comment: data,
    }),
  });

  const password = await promise;

  const result = await ton.submitTransfer({
    accountId,
    password,
    toAddress,
    amount,
    data: processedData,
    stateInit: processedStateInit,
  });

  if ('error' in result) {
    return false;
  }

  const { address: fromAddress } = await fetchStoredTonWallet(accountId);
  createLocalTransaction(accountId, 'ton', {
    amount,
    fromAddress,
    toAddress,
    fee: checkResult.realFee ?? checkResult.fee!,
    slug: TONCOIN.slug,
    inMsgHash: result.msgHash,
    ...(dataType === 'text' && {
      comment: data,
    }),
  });

  return true;
}

async function sendLedgerTransaction(
  accountId: string,
  promiseId: string,
  promise: Promise<any>,
  fee: bigint | undefined,
  realFee: bigint | undefined,
  params: {
    to: string;
    value: string;
    data?: string;
    dataType?: 'text' | 'hex' | 'base64' | 'boc';
    stateInit?: string;
  },
) {
  const { network } = parseAccountId(accountId);
  const { address: fromAddress } = await fetchStoredTonWallet(accountId);
  const {
    to: toAddress, value, data, dataType, stateInit,
  } = params;
  const amount = BigInt(value);

  let payloadBoc: string | undefined;

  if (data) {
    switch (dataType) {
      case 'hex':
        payloadBoc = await ton.packPayloadToBoc(hexToBytes(data));
        break;
      case 'base64':
        payloadBoc = await ton.packPayloadToBoc(base64ToBytes(data));
        break;
      case 'boc':
        payloadBoc = data;
        break;
      case 'text':
        payloadBoc = await ton.packPayloadToBoc(data);
        break;
      default:
        payloadBoc = undefined;
    }
  }

  const parsedPayload = payloadBoc ? await ton.parsePayloadBase64(network, toAddress, payloadBoc) : undefined;

  onPopupUpdate({
    type: 'createTransaction',
    promiseId,
    toAddress,
    amount: BigInt(amount),
    fee,
    realFee,
    ...(dataType === 'text' && {
      comment: data,
    }),
    stateInit,
    rawPayload: payloadBoc,
    parsedPayload,
  });

  let msgHash: string;

  try {
    const [signedMessage] = await promise as ApiSignedTransfer[];

    msgHash = await ton.sendSignedMessage(accountId, signedMessage);
  } catch (err) {
    logDebugError('sendLedgerTransaction', err);
    return false;
  }

  createLocalTransaction(accountId, 'ton', {
    amount,
    fromAddress,
    toAddress,
    fee: realFee ?? fee ?? 0n,
    slug: TONCOIN.slug,
    inMsgHash: msgHash,
    ...(dataType === 'text' && {
      comment: data,
    }),
  });

  return true;
}

export async function rawSign({ data }: { data: string }) {
  const accountId = await getCurrentAccountIdOrFail();

  await openPopupWindow();
  await waitLogin();

  const { promiseId, promise } = createDappPromise();

  onPopupUpdate({
    type: 'createSignature',
    promiseId,
    dataHex: data,
  });

  const password = await promise;

  return ton.rawSign(accountId, password, data);
}
