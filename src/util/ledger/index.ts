import { Address, Cell, SendMode } from 'ton-core';
import type { TonPayloadFormat } from 'ton-ledger';
import { TonTransport } from 'ton-ledger';
import { StatusCodes } from '@ledgerhq/errors';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';

import {
  TRANSFER_TIMEOUT_SEC,
  WORKCHAIN,
} from '../../api/types';
import type {
  ApiDappTransaction,
  ApiNetwork,
  ApiSignedTransfer,
  ApiSubmitTransferOptions,
  Workchain,
} from '../../api/types';
import type { LedgerWalletInfo } from './types';

import { TON_TOKEN_SLUG } from '../../config';
import { callApi } from '../../api';
import { getWalletBalance } from '../../api/blockchains/ton';
import { ApiUserRejectsError } from '../../api/errors';
import { parseAccountId } from '../account';
import { range } from '../iteratees';
import { logDebugError } from '../logs';
import { pause } from '../schedulers';

const CHAIN = 0; // workchain === -1 ? 255 : 0;
const VERSION = 'v4R2';
const ACCOUNTS_PAGE = 9;
const ATTEMPTS = 10;
const PAUSE = 125;
const IS_BOUNCEABLE = false;

let transport: TransportWebHID | undefined;
let tonTransport: TonTransport | undefined;

export async function importLedgerWallet(network: ApiNetwork, accountIndex: number) {
  const walletInfo = await getLedgerWalletInfo(network, accountIndex, IS_BOUNCEABLE);
  return callApi('importLedgerWallet', network, walletInfo);
}

export async function connectLedger() {
  try {
    transport = await connectHID();
    tonTransport = new TonTransport(transport);
    return true;
  } catch (err) {
    logDebugError('connectLedger', err);
    return false;
  }
}

function waitLedgerTonAppDeadline(): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(false);
    }, PAUSE * ATTEMPTS);
  });
}

export async function checkTonApp() {
  for (let i = 0; i < ATTEMPTS; i++) {
    try {
      const isTonOpen = await tonTransport!.isAppOpen();

      if (isTonOpen) {
        // Workaround for Ledger S, this is a way to check if it is unlocked.
        // There will be an error with code 0x530c
        await tonTransport?.getAddress(getLedgerAccountPathByIndex(0));

        return true;
      }
    } catch (err: any) {
      if (!err?.message.includes('0x530c')) {
        logDebugError('waitLedgerTonApp', err);
      }
    }

    await pause(PAUSE);
  }

  return false;
}

export function waitLedgerTonApp() {
  return Promise.race([
    checkTonApp(),
    waitLedgerTonAppDeadline(),
  ]);
}

async function connectHID() {
  for (let i = 0; i < ATTEMPTS; i++) {
    const [device] = await TransportWebHID.list();

    if (!device) {
      await TransportWebHID.create();
      await pause(PAUSE);
      continue;
    }

    if (device.opened) {
      return new TransportWebHID(device);
    } else {
      return TransportWebHID.open(device);
    }
  }

  throw new Error('Failed to connect');
}

export async function submitLedgerTransfer(options: ApiSubmitTransferOptions) {
  const {
    accountId, slug, comment, fee,
  } = options;
  let { toAddress, amount } = options;
  const { network } = parseAccountId(accountId);

  await callApi('waitLastTransfer', accountId);

  const [path, fromAddress, seqno, isInitialized] = await Promise.all([
    getLedgerAccountPath(accountId),
    callApi('fetchAddress', accountId),
    callApi('getWalletSeqno', accountId),
    callApi('isWalletInitialized', network, toAddress),
  ]);

  let payload: TonPayloadFormat | undefined;

  if (slug !== TON_TOKEN_SLUG) {
    const params = await callApi(
      'buildTokenTransferRaw',
      accountId,
      slug,
      fromAddress!,
      toAddress,
      amount,
      comment,
    );

    const message = Cell.fromBoc(Buffer.from(params!.payload))[0];
    ({ toAddress, amount } = params!);

    payload = { type: 'unsafe', message };
  } else if (comment) {
    payload = { type: 'comment', text: comment };
  }

  try {
    const signedCell = await tonTransport!.signTransaction(path, {
      to: Address.parse(toAddress),
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      seqno: seqno!,
      timeout: getTransferExpirationTime(),
      bounce: isInitialized!, // Force non-bounceable for non-initialized recipients
      amount: BigInt(amount),
      payload,
    });

    const message: ApiSignedTransfer = {
      base64: signedCell.toBoc().toString('base64'),
      seqno: seqno!,
      params: {
        amount: options.amount,
        fromAddress: fromAddress!,
        toAddress: options.toAddress,
        comment,
        fee: fee!,
        slug,
      },
    };

    return await callApi('sendSignedTransferMessage', accountId, message);
  } catch (error) {
    logDebugError('submitLedgerTransfer', error);
    return undefined;
  }
}

export async function signLedgerTransactions(
  accountId: string, messages: ApiDappTransaction[], seqno?: number,
): Promise<ApiSignedTransfer[]> {
  await callApi('waitLastTransfer', accountId);

  const [path, fromAddress] = await Promise.all([
    getLedgerAccountPath(accountId),
    callApi('fetchAddress', accountId),
  ]);

  if (!seqno) {
    seqno = await callApi('getWalletSeqno', accountId);
  }

  const preparedOptions = messages.map((message, index) => {
    const {
      toAddress, amount, payload, rawPayload,
    } = message;

    let ledgerPayload: TonPayloadFormat | undefined;

    switch (payload?.type) {
      case 'comment': {
        ledgerPayload = {
          type: 'comment',
          text: payload.comment,
        };
        break;
      }
      case undefined: {
        ledgerPayload = undefined;
        break;
      }
      case 'transfer-nft': // TODO Wait for support https://github.com/ton-core/ton-ledger-ts/issues/1
      case 'transfer-tokens': // TODO Wait for support
      case 'unknown':
      default: {
        ledgerPayload = {
          type: 'unsafe',
          message: Cell.fromBase64(rawPayload!),
        };
      }
    }

    return {
      to: Address.parse(toAddress),
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      seqno: seqno! + index,
      timeout: getTransferExpirationTime(),
      bounce: IS_BOUNCEABLE,
      amount: BigInt(amount),
      payload: ledgerPayload,
    };
  });

  const signedMessages: ApiSignedTransfer[] = [];

  const attempts = ATTEMPTS + preparedOptions.length;
  let index = 0;
  let attempt = 0;

  while (index < preparedOptions.length && attempt < attempts) {
    const options = preparedOptions[index];
    const message = messages[index];

    try {
      const base64 = (await tonTransport!.signTransaction(path, options)).toBoc().toString('base64');
      signedMessages.push({
        base64,
        seqno: options.seqno,
        params: {
          amount: message.amount,
          fromAddress: fromAddress!,
          toAddress: message.toAddress,
          comment: message.payload?.type === 'comment' ? message.payload.comment : undefined,
          fee: '0',
          slug: TON_TOKEN_SLUG,
        },
      });
      index++;
    } catch (err: any) {
      if (err?.statusCode === StatusCodes.CONDITIONS_OF_USE_NOT_SATISFIED) {
        throw new ApiUserRejectsError();
      }
      logDebugError('signLedgerTransactions', err);
    }
    attempt++;
  }

  return signedMessages;
}

export function getFirstLedgerWallets(network: ApiNetwork) {
  const accountIndexes = range(0, ACCOUNTS_PAGE);

  return Promise.all(accountIndexes.map((index) => {
    return getLedgerWalletInfo(network, index, IS_BOUNCEABLE);
  }));
}

export async function getLedgerWalletInfo(
  network: ApiNetwork,
  accountIndex: number,
  isBounceable: boolean,
): Promise<LedgerWalletInfo> {
  const { address, publicKey } = await getLedgerWalletAddress(accountIndex, isBounceable);
  const balance = await getWalletBalance(network, address);

  return {
    index: accountIndex,
    address,
    publicKey: publicKey!.toString('hex'),
    balance,
    version: VERSION,
    driver: 'HID',
    deviceId: transport!.deviceModel?.id,
    deviceName: transport!.deviceModel?.productName,
  };
}

export function getLedgerWalletAddress(index: number, isBounceable: boolean, isTestnet?: boolean) {
  const path = getLedgerAccountPathByIndex(index, isTestnet);

  return tonTransport!.getAddress(path, {
    chain: CHAIN,
    bounceable: isBounceable,
  });
}

async function getLedgerAccountPath(accountId: string) {
  const accountInfo = await callApi('fetchAccount', accountId);
  const index = accountInfo!.ledger!.index;

  return getLedgerAccountPathByIndex(index);
}

function getLedgerAccountPathByIndex(index: number, isTestnet?: boolean, workchain: Workchain = WORKCHAIN) {
  const network = isTestnet ? 1 : 0;
  const chain = workchain === -1 ? 255 : 0;
  return [44, 607, network, chain, index, 0];
}

function getTransferExpirationTime() {
  return Math.floor(Date.now() / 1000 + TRANSFER_TIMEOUT_SEC);
}
