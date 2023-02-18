import { Cell } from 'tonweb/dist/types/boc/cell';
import { WalletContract } from 'tonweb/dist/types/contract/wallet/wallet-contract';
import TonWeb from 'tonweb';
import { Transaction as RawTransaction } from 'tonapi-sdk-js/dist/models/Transaction';

import { Storage } from '../../storages/types';
import {
  ApiNetwork, ApiTransaction, ApiTransactionDraftError, ApiTransactionType,
} from '../../types';
import { DEBUG, STAKING_POOLS_ALL, TON_TOKEN_SLUG } from '../../../config';
import { base64ToBytes, hexToBase64 } from '../../common/utils';
import {
  getWalletBalance,
  getWalletInfo,
  isWalletInitialized,
  pickAccountWallet,
} from './wallet';
import { fetchPrivateKey } from './auth';
import { getTonWeb, toBase64Address } from './util/tonweb';
import { fetchAddress, resolveAddress } from './address';
import {
  buildTokenTransaction,
  buildTokenTransfer,
  getTokenWalletBalance,
  JettonWalletType,
} from './tokens';
import {
  fetchAccountEvents,
  fetchAccountTransactions,
} from './util/tonapiio';
import { AnyTransactionWithLt, ApiTransactionWithLt, TonTransferParams } from './types';
import { parseAccountId } from '../../../util/account';
import { STAKE_COMMENT, UNSTAKE_COMMENT } from './constants';
import { pause } from '../../../util/schedulers';

const { Address, fromNano } = TonWeb.utils;

const DEFAULT_FEE = '10966001';
const DEFAULT_EXPIRE_AT_TIMEOUT_SEC = 60; // 60 sec.
const GET_TRANSACTIONS_LIMIT = 100;
const DATA_TEXT_PREFIX = [0, 0, 0, 0].toString();
const WAIT_SEQNO_TIMEOUT = 10000; // 10 sec.
const WAIT_SEQNO_PAUSE = 300; // 0.3 sec.

export async function checkTransactionDraft(
  storage: Storage,
  accountId: string,
  tokenSlug: string,
  toAddress: string,
  amount: string,
  data?: string | Uint8Array | Cell,
  stateInit?: Cell,
) {
  const { network } = parseAccountId(accountId);

  const result: {
    error?: ApiTransactionDraftError;
    fee?: string;
  } = {};

  const resolvedAddress = await resolveAddress(network, toAddress);
  if (!resolvedAddress) {
    result.error = ApiTransactionDraftError.DomainNotResolved;
    return result;
  }

  toAddress = resolvedAddress;
  if (!Address.isValid(toAddress)) {
    result.error = ApiTransactionDraftError.InvalidToAddress;
    return result;
  }

  if (BigInt(amount) < BigInt(0)) {
    result.error = ApiTransactionDraftError.InvalidAmount;
    return result;
  }

  const wallet = await pickAccountWallet(storage, accountId);
  if (!wallet) {
    result.error = ApiTransactionDraftError.Unexpected;
    return result;
  }

  if (tokenSlug !== TON_TOKEN_SLUG) {
    if (data && typeof data !== 'string') {
      result.error = ApiTransactionDraftError.Unexpected;
      return result;
    }

    const address = await fetchAddress(storage, accountId);
    const tokenAmount: string = amount;
    let tokenWallet: JettonWalletType;
    ({
      tokenWallet,
      amount,
      toAddress,
      payload: data,
    } = await buildTokenTransfer(network, tokenSlug, address, toAddress, amount, data));

    const tokenBalance = await getTokenWalletBalance(tokenWallet!);
    if (BigInt(tokenBalance) < BigInt(tokenAmount!)) {
      result.error = ApiTransactionDraftError.InsufficientBalance;
      return result;
    }
  }

  if (await isWalletInitialized(network, wallet)) {
    const query = await signTransaction(network, wallet, toAddress, amount, data, stateInit);
    const allFees = await query.estimateFee();
    const fees = allFees.source_fees;
    result.fee = String(fees.in_fwd_fee + fees.storage_fee + fees.gas_fee + fees.fwd_fee);
  } else {
    result.fee = DEFAULT_FEE;
  }

  const balance = await getWalletBalance(network, wallet);
  if (BigInt(balance) < BigInt(amount) + BigInt(result.fee)) {
    result.error = ApiTransactionDraftError.InsufficientBalance;
    return result;
  }

  return result;
}

export async function submitTransfer(
  storage: Storage,
  accountId: string,
  password: string,
  tokenSlug: string,
  toAddress: string,
  amount: string,
  data?: string | Uint8Array | Cell,
  stateInit?: Cell,
) {
  const { network } = parseAccountId(accountId);

  const wallet = await pickAccountWallet(storage, accountId);
  if (!wallet) {
    return undefined;
  }

  const privateKey = await fetchPrivateKey(storage, accountId, password);
  if (!privateKey) {
    return undefined;
  }

  let resolvedAddress = await resolveAddress(network, toAddress);
  if (!resolvedAddress) {
    return undefined;
  }

  if (tokenSlug !== TON_TOKEN_SLUG) {
    if (data && typeof data !== 'string') {
      return undefined;
    }

    const address = await fetchAddress(storage, accountId);
    ({
      amount,
      toAddress: resolvedAddress,
      payload: data,
    } = await buildTokenTransfer(network, tokenSlug, address, resolvedAddress, amount, data));
  }

  // Force default bounceable address for `waitTxComplete` to work properly
  resolvedAddress = (new Address(resolvedAddress)).toString(true, true, true);

  // Force non-bounceable for non-initialized recipients
  toAddress = !(await isWalletInitialized(network, resolvedAddress))
    ? (new Address(resolvedAddress)).toString(true, true, false)
    : resolvedAddress;

  const { seqno } = await getWalletInfo(network, wallet);
  const query = await signTransaction(network, wallet, toAddress, amount, data, stateInit, privateKey);
  await query.send();

  return { resolvedAddress, amount, seqno };
}

async function signTransaction(
  network: ApiNetwork,
  wallet: WalletContract,
  toAddress: string,
  amount: string,
  payload?: string | Uint8Array | Cell,
  stateInit?: Cell,
  privateKey?: Uint8Array,
) {
  const { seqno } = await getWalletInfo(network, wallet);

  return wallet.methods.transfer({
    secretKey: privateKey as any, // Workaround for wrong typing
    toAddress,
    amount,
    payload,
    seqno: seqno || 0,
    sendMode: 3,
    stateInit,
  });
}

export async function getAccountNewestTxId(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);
  const tonWeb = getTonWeb(network);

  const result: any[] = await tonWeb.provider.getTransactions(
    address,
    1,
    undefined,
    undefined,
    undefined,
    true,
  );
  if (!result?.length) {
    return undefined;
  }

  return stringifyTxId(result[0].transaction_id);
}

export async function getAccountTransactionSlice(
  storage: Storage,
  accountId: string,
  beforeTxId?: string,
  afterTxId?: string,
  limit?: number,
) {
  const { network } = parseAccountId(accountId);
  const address = await fetchAddress(storage, accountId);

  let beforeLt = beforeTxId ? Number(parseTxId(beforeTxId).lt) : undefined;
  const afterLt = afterTxId ? Number(parseTxId(afterTxId).lt) : undefined;
  limit = limit || GET_TRANSACTIONS_LIMIT;

  let txs: ApiTransactionWithLt[] = [];

  // Additional loading in the presence of `afterLt` is not implemented
  while (afterLt ? !txs.length : txs.length < limit) {
    const [allEvents, rawTxs] = await Promise.all([
      fetchAccountEvents(network, address, limit, beforeLt),
      fetchAccountTransactions(
        network,
        address,
        limit,
        afterLt,
        beforeLt,
      ),
    ]);

    if (!rawTxs?.length) {
      break;
    }

    const allTxs = rawTxs.map(parseNestedApiTransactions).flat();

    beforeLt = afterLt ? afterLt + 1 : (allTxs[allTxs.length - 1]).lt;
    txs = txs.concat(allTxs.filter((x) => !!x.fromAddress) as ApiTransactionWithLt[]);

    // Merge token transactions
    let tokenTxs: ApiTransactionWithLt[] = [];
    allEvents.forEach((event) => {
      const newTokenTxs = event.actions
        .map((action) => buildTokenTransaction(event, action))
        .filter(Boolean);
      tokenTxs = tokenTxs.concat(newTokenTxs);
    });

    if (tokenTxs.length) {
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      txs = txs.concat(tokenTxs.filter((t: any) => (t.lt >= beforeLt!)));
    }
    if (rawTxs.length < limit) {
      break;
    }
  }

  txs = txs.sort((x: any, y: any) => (y.lt - x.lt));
  txs.forEach((t: any) => {
    delete t.lt;
  });

  return txs.slice(0, limit) as ApiTransaction[];
}

function parseTxId(txId: string) {
  const [lt, hash] = txId.split(':');
  return { lt: Number(lt), hash };
}

function parseNestedApiTransactions(rawTx: RawTransaction): AnyTransactionWithLt[] {
  const baseTx = buildApiTransaction(rawTx);
  if (rawTx.outMsgs?.length > 1) {
    return rawTx.outMsgs.map((outMsg, i) => ({
      ...baseTx,
      txId: `${baseTx.txId}:${i}`,
      toAddress: toBase64Address(outMsg.destination!.address!),
      amount: String(BigInt(outMsg.value) * BigInt(-1)),
      fee: i === 0 ? baseTx.fee : '0',
    }));
  }
  return [baseTx];
}

function buildApiTransaction(rawTx: RawTransaction): AnyTransactionWithLt {
  const amount = String(rawTx.outMsgs.reduce((acc: bigint, outMsg: any) => {
    return acc - BigInt(outMsg.value);
  }, BigInt(rawTx.inMsg!.value)));

  const isIncoming = Boolean(rawTx.inMsg?.source);
  const target = isIncoming ? rawTx.inMsg! : rawTx.outMsgs[0];
  const tx = {
    txId: stringifyTxId({ lt: rawTx.lt.toString(), hash: hexToBase64(rawTx.hash) }),
    timestamp: Number(rawTx.utime * 1000),
    amount,
    fee: rawTx.fee.toString(),
    slug: TON_TOKEN_SLUG,
    lt: rawTx.lt,
  };

  if (!target) {
    return tx;
  }

  let type: ApiTransactionType;
  const fromAddress = toBase64Address(target!.source!.address!);
  const toAddress = toBase64Address(target!.destination!.address!);
  const comment = parseComment(target!.msgData);

  if (fromAddress && toAddress) {
    const amountNumber = Number(fromNano(tx.amount));
    if (STAKING_POOLS_ALL.includes(fromAddress) && amountNumber > 1) {
      type = 'unstake';
    } else if (STAKING_POOLS_ALL.includes(toAddress)) {
      if (comment === STAKE_COMMENT) {
        type = 'stake';
      } else if (comment === UNSTAKE_COMMENT) {
        type = 'unstakeRequest';
      }
    }
  }

  return {
    ...tx,
    type,
    fromAddress,
    toAddress,
    comment,
    isIncoming,
  };
}

function stringifyTxId({ lt, hash }: { lt: string; hash: string }) {
  return `${lt}:${hash}`;
}

function parseComment(msgData?: string) {
  if (msgData) {
    try {
      const bytes = base64ToBytes(msgData);
      const firstBytes = Array.from(bytes.slice(0, 4));
      if (firstBytes.toString() === DATA_TEXT_PREFIX) {
        return new TextDecoder('utf-8', {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes.slice(4));
      }
    } catch (err) {
      // do nothing
    }
  }
  return undefined;
}

export async function waitIncrementSeqno(network: ApiNetwork, address: string, seqno: number) {
  const waitUntil = new Date().getTime() + WAIT_SEQNO_TIMEOUT;
  while (new Date().getTime() < waitUntil) {
    try {
      const { seqno: currentSeqno } = await getWalletInfo(network, address);
      if (currentSeqno > seqno) return true;

      await pause(WAIT_SEQNO_PAUSE);
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('[waitIncrementSeqno]', err);
      }
    }
  }
  return false;
}

export async function checkMultiTransactionDraft(
  storage: Storage,
  accountId: string,
  messages: TonTransferParams[],
) {
  const { network } = parseAccountId(accountId);

  const result: {
    error?: ApiTransactionDraftError;
    fee?: string;
    totalAmount?: string;
  } = {};

  let totalAmount: bigint = 0n;

  for (const { toAddress, amount } of messages) {
    if (BigInt(amount) < BigInt(0)) {
      result.error = ApiTransactionDraftError.InvalidAmount;
      return result;
    }
    if (!Address.isValid(toAddress)) {
      result.error = ApiTransactionDraftError.InvalidToAddress;
      return result;
    }
    totalAmount += BigInt(amount);
  }

  const wallet = await pickAccountWallet(storage, accountId);

  if (!wallet) {
    result.error = ApiTransactionDraftError.Unexpected;
    return result;
  }

  if (await isWalletInitialized(network, wallet)) {
    const { query } = await signMultiTransaction(network, wallet, messages);
    const allFees = await query.estimateFee();
    const fees = allFees.source_fees;
    result.fee = String(fees.in_fwd_fee + fees.storage_fee + fees.gas_fee + fees.fwd_fee);
  } else {
    result.fee = DEFAULT_FEE;
  }
  result.totalAmount = totalAmount.toString();

  const balance = await getWalletBalance(network, wallet);
  if (BigInt(balance) < totalAmount + BigInt(result.fee)) {
    result.error = ApiTransactionDraftError.InsufficientBalance;
    return result;
  }

  return result;
}

export async function submitMultiTransfer(
  storage: Storage,
  accountId: string,
  password: string,
  messages: TonTransferParams[],
  expireAt?: number,
) {
  const { network } = parseAccountId(accountId);

  const wallet = await pickAccountWallet(storage, accountId);
  if (!wallet) {
    return undefined;
  }

  const privateKey = await fetchPrivateKey(storage, accountId, password);
  if (!privateKey) {
    return undefined;
  }

  const preparedMessages = await Promise.all(messages.map(async (message) => {
    let { toAddress } = message;

    // Force default bounceable address for `waitTxComplete` to work properly
    const resolvedAddress = (new Address(toAddress)).toString(true, true, true);
    toAddress = !(await isWalletInitialized(network, toAddress))
      ? (new Address(toAddress)).toString(true, true, false)
      : resolvedAddress;

    return {
      ...message,
      toAddress,
      resolvedAddress,
    };
  }));

  const { seqno, query } = await signMultiTransaction(network, wallet, preparedMessages, privateKey, expireAt);
  const result = await query.send();

  return {
    seqno,
    messages: preparedMessages,
    result,
  };
}

async function signMultiTransaction(
  network: ApiNetwork,
  wallet: WalletContract,
  messages: TonTransferParams[],
  privateKey?: Uint8Array,
  expireAt?: number,
) {
  const { seqno } = await getWalletInfo(network, wallet);
  if (!expireAt) {
    expireAt = Math.round(Date.now() / 1000) + DEFAULT_EXPIRE_AT_TIMEOUT_SEC;
  }

  // TODO Uncomment after fixing types in tonweb
  // @ts-ignore
  const query = wallet.methods.transfers({
    secretKey: privateKey as any,
    seqno: seqno || 0,
    messages,
    sendMode: 3,
    expireAt,
  });

  return { query, seqno };
}
