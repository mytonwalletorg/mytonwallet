import {
  Address, Builder, Cell, SendMode,
} from 'ton-core';
import { StatusCodes } from '@ledgerhq/errors';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import type { TonPayloadFormat } from '@ton-community/ton-ledger';
import { TonTransport } from '@ton-community/ton-ledger';

import type { ApiTonConnectProof } from '../../api/tonConnect/types';
import type {
  ApiDappTransaction,
  ApiNetwork,
  ApiSignedTransfer,
  ApiSubmitTransferOptions,
  Workchain,
} from '../../api/types';
import type { LedgerWalletInfo } from './types';
import {
  TRANSFER_TIMEOUT_SEC,
  WORKCHAIN,
} from '../../api/types';

import { TON_TOKEN_SLUG } from '../../config';
import { callApi } from '../../api';
import {
  DEFAULT_IS_BOUNCEABLE,
  TOKEN_TRANSFER_TON_AMOUNT,
  TOKEN_TRANSFER_TON_FORWARD_AMOUNT,
} from '../../api/blockchains/ton/constants';
import { ApiUserRejectsError, handleServerError } from '../../api/errors';
import { parseAccountId } from '../account';
import { logDebugError } from '../logs';
import { pause } from '../schedulers';
import { isValidLedgerComment } from './utils';

const CHAIN = 0; // workchain === -1 ? 255 : 0;
const VERSION = 'v4R2';
const ATTEMPTS = 10;
const PAUSE = 125;
const IS_BOUNCEABLE = false;

let transport: TransportWebHID | undefined;
let tonTransport: TonTransport | undefined;

export async function importLedgerWallet(network: ApiNetwork, accountIndex: number) {
  const walletInfo = await getLedgerWalletInfo(network, accountIndex, IS_BOUNCEABLE);
  return callApi('importLedgerWallet', network, walletInfo);
}

export async function reconnectLedger() {
  try {
    if (tonTransport && await tonTransport?.isAppOpen()) {
      return true;
    }
  } catch {
    // do nothing
  }

  return await connectLedger() && await waitLedgerTonApp();
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

  const [path, fromAddress, seqno] = await Promise.all([
    getLedgerAccountPath(accountId),
    callApi('fetchAddress', accountId),
    callApi('getWalletSeqno', accountId),
  ]);

  let payload: TonPayloadFormat | undefined;
  const parsedAddress = Address.parseFriendly(toAddress);
  let isBounceable = parsedAddress.isBounceable;
  // Force default bounceable address for `waitTxComplete` to work properly
  const normalizedAddress = parsedAddress.address.toString({ urlSafe: true, bounceable: DEFAULT_IS_BOUNCEABLE });

  if (slug !== TON_TOKEN_SLUG) {
    ({ toAddress, amount, payload } = await buildLedgerTokenTransfer(
      network, slug, fromAddress!, toAddress, amount, comment,
    ));
    isBounceable = true;
  } else if (comment) {
    if (isValidLedgerComment(comment)) {
      payload = { type: 'comment', text: comment };
    } else {
      throw Error('Unsupported format');
    }
  }

  try {
    const signedCell = await tonTransport!.signTransaction(path, {
      to: Address.parse(toAddress),
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      seqno: seqno!,
      timeout: getTransferExpirationTime(),
      bounce: isBounceable,
      amount: BigInt(amount),
      payload,
    });

    const message: ApiSignedTransfer = {
      base64: signedCell.toBoc().toString('base64'),
      seqno: seqno!,
      params: {
        amount: options.amount,
        fromAddress: fromAddress!,
        toAddress: normalizedAddress,
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

export async function buildLedgerTokenTransfer(
  network: ApiNetwork,
  slug: string,
  fromAddress: string,
  toAddress: string,
  amount: string,
  comment?: string,
) {
  const { minterAddress } = (await callApi('resolveTokenBySlug', slug))!;
  const tokenWalletAddress = await callApi('resolveTokenWalletAddress', network, fromAddress, minterAddress!);
  const realMinterAddress = await callApi('resolveTokenMinterAddress', network, tokenWalletAddress!);
  if (minterAddress !== realMinterAddress) {
    throw new Error('Invalid contract');
  }

  // eslint-disable-next-line no-null/no-null
  let forwardPayload: Cell | null = null;
  if (comment) {
    forwardPayload = new Builder()
      .storeUint(0, 32)
      .storeStringTail(comment)
      .endCell();
  }

  const payload: TonPayloadFormat = {
    type: 'jetton-transfer',
    queryId: 0n,
    amount: BigInt(amount),
    destination: Address.parse(toAddress),
    responseDestination: Address.parse(fromAddress),
    // eslint-disable-next-line no-null/no-null
    customPayload: null,
    forwardAmount: TOKEN_TRANSFER_TON_FORWARD_AMOUNT,
    forwardPayload,
  };

  return {
    amount: TOKEN_TRANSFER_TON_AMOUNT.toString(),
    toAddress: tokenWalletAddress!,
    payload,
  };
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
      toAddress, amount, payload,
    } = message;

    let isBounceable = IS_BOUNCEABLE;
    let ledgerPayload: TonPayloadFormat | undefined;

    switch (payload?.type) {
      case 'comment': {
        const { comment } = payload;
        if (isValidLedgerComment(comment)) {
          ledgerPayload = { type: 'comment', text: payload.comment };
        } else {
          throw Error('Unsupported format');
        }
        break;
      }
      case undefined: {
        ledgerPayload = undefined;
        break;
      }
      case 'nft:transfer': {
        const {
          queryId,
          newOwner,
          responseDestination,
          customPayload,
          forwardAmount,
          forwardPayload,
        } = payload;

        isBounceable = true;
        ledgerPayload = {
          type: 'nft-transfer',
          queryId: BigInt(queryId),
          newOwner: Address.parse(newOwner),
          responseDestination: Address.parse(responseDestination),
          // eslint-disable-next-line no-null/no-null
          customPayload: customPayload ? Cell.fromBase64(customPayload) : null,
          forwardAmount: BigInt(forwardAmount),
          // eslint-disable-next-line no-null/no-null
          forwardPayload: forwardPayload ? Cell.fromBase64(forwardPayload) : null,
        };
        break;
      }
      case 'tokens:transfer': {
        const {
          queryId,
          amount: jettonAmount,
          destination,
          responseDestination,
          customPayload,
          forwardAmount,
          forwardPayload,
        } = payload;

        isBounceable = true;
        ledgerPayload = {
          type: 'jetton-transfer',
          queryId: BigInt(queryId),
          amount: BigInt(jettonAmount),
          destination: Address.parse(destination),
          responseDestination: Address.parse(responseDestination),
          // eslint-disable-next-line no-null/no-null
          customPayload: customPayload ? Cell.fromBase64(customPayload) : null,
          forwardAmount: BigInt(forwardAmount),
          // eslint-disable-next-line no-null/no-null
          forwardPayload: forwardPayload ? Cell.fromBase64(forwardPayload) : null,
        };
        break;
      }
      case 'unknown':
      default: {
        throw Error('Unsupported format');
      }
    }

    return {
      to: Address.parse(toAddress),
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      seqno: seqno! + index,
      timeout: getTransferExpirationTime(),
      bounce: isBounceable,
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

export async function signLedgerProof(accountId: string, proof: ApiTonConnectProof): Promise<string> {
  const path = await getLedgerAccountPath(accountId);

  const { timestamp, domain, payload } = proof;

  const result = await tonTransport!.getAddressProof(path, {
    domain,
    timestamp,
    payload: Buffer.from(payload),
  });
  return result.signature.toString('base64');
}

export async function getNextLedgerWallets(
  network: ApiNetwork,
  lastExistingIndex = -1,
  alreadyImportedAddresses: string[] = [],
) {
  const result: LedgerWalletInfo[] = [];
  let index = lastExistingIndex + 1;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const walletInfo = await getLedgerWalletInfo(network, index, IS_BOUNCEABLE);

      if (alreadyImportedAddresses.includes(walletInfo.address)) {
        index += 1;
        continue;
      }

      if (walletInfo.balance !== '0') {
        result.push(walletInfo);
        index += 1;
        continue;
      }

      if (!result.length) {
        result.push(walletInfo);
      }

      return result;
    }
  } catch (err) {
    return handleServerError(err);
  }
}

export async function getLedgerWalletInfo(
  network: ApiNetwork,
  accountIndex: number,
  isBounceable: boolean,
): Promise<LedgerWalletInfo> {
  const { address, publicKey } = await getLedgerWalletAddress(accountIndex, isBounceable);
  const balance = (await callApi('getWalletBalance', network, address))!;

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

export async function verifyAddress(accountId: string) {
  const path = await getLedgerAccountPath(accountId);

  await tonTransport!.validateAddress(path, { bounceable: IS_BOUNCEABLE });
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
