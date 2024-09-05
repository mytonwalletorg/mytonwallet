import { StatusCodes } from '@ledgerhq/errors';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import type { StateInit } from '@ton/core';
import { loadStateInit } from '@ton/core';
import type { TonPayloadFormat } from '@ton-community/ton-ledger';
import { KNOWN_JETTONS, parseMessage, TonTransport } from '@ton-community/ton-ledger';
import { Address } from '@ton/core/dist/address/Address';
import { Builder } from '@ton/core/dist/boc/Builder';
import { Cell } from '@ton/core/dist/boc/Cell';
import { SendMode } from '@ton/core/dist/types/SendMode';

import type { ApiTonConnectProof } from '../../api/tonConnect/types';
import type {
  ApiDappTransfer,
  ApiLocalTransactionParams,
  ApiNetwork, ApiNft,
  ApiSignedTransfer,
  ApiStakingType,
  ApiSubmitTransferOptions,
  Workchain,
} from '../../api/types';
import type { LedgerWalletInfo } from './types';
import { ApiLiquidUnstakeMode, ApiTransactionError } from '../../api/types';

import {
  BURN_ADDRESS, LIQUID_JETTON, LIQUID_POOL,
  NOTCOIN_EXCHANGERS, NOTCOIN_VOUCHERS_ADDRESS, ONE_TON, TONCOIN_SLUG,
} from '../../config';
import { callApi } from '../../api';
import {
  DEFAULT_IS_BOUNCEABLE,
  NFT_TRANSFER_AMOUNT,
  NFT_TRANSFER_FORWARD_AMOUNT,
  STAKE_COMMENT,
  TOKEN_TRANSFER_AMOUNT,
  TOKEN_TRANSFER_FORWARD_AMOUNT,
  TRANSFER_TIMEOUT_SEC,
  UNSTAKE_COMMENT,
  WALLET_IS_BOUNCEABLE,
  WORKCHAIN,
} from '../../api/blockchains/ton/constants';
import {
  buildLiquidStakingWithdrawCustomPayload,
  commentToBytes,
  packBytesAsSnakeCell,
  toBase64Address,
} from '../../api/blockchains/ton/util/tonCore';
import {
  ApiHardwareBlindSigningNotEnabled,
  ApiUnsupportedVersionError,
  ApiUserRejectsError,
  handleServerError,
} from '../../api/errors';
import { parseAccountId } from '../account';
import compareVersions from '../compareVersions';
import { logDebugError } from '../logs';
import { pause } from '../schedulers';
import { isValidLedgerComment } from './utils';

type TransactionParams = {
  to: Address;
  sendMode: SendMode;
  seqno: number;
  timeout: number;
  bounce: boolean;
  amount: bigint;
  stateInit?: StateInit;
  payload?: TonPayloadFormat;
  walletSpecifiers?: {
    subwalletId?: number;
    includeWalletOp: boolean;
  };
};

const CHAIN = 0; // workchain === -1 ? 255 : 0;
const WALLET_VERSION = 'v4R2';
const INTERNAL_WALLET_VERSION = 'v4';
const ATTEMPTS = 10;
const PAUSE = 125;
const IS_BOUNCEABLE = false;
const VERSION_WITH_UNSAFE = '2.1.0';
const VERSION_WITH_JETTON_ID = '2.2.0';
const VESTING_SUBWALLET_ID = 0x10C;

const knownJettonAddresses = KNOWN_JETTONS.map(
  ({ masterAddress }) => masterAddress.toString({ bounceable: true, urlSafe: true }),
);

let transport: TransportWebHID | TransportWebUSB | undefined;
let tonTransport: TonTransport | undefined;

export async function importLedgerWallet(network: ApiNetwork, accountIndex: number) {
  const walletInfo = await getLedgerWalletInfo(network, accountIndex);
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
    if (await TransportWebHID.isSupported()) {
      transport = await connectHID();
    } else if (await TransportWebUSB.isSupported()) {
      transport = await connectUSB();
    } else {
      logDebugError('connectLedger: HID and/or USB are not supported');
      return false;
    }
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
        await tonTransport?.getAddress(getLedgerAccountPathByIndex(0), {
          walletVersion: INTERNAL_WALLET_VERSION,
        });

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

async function connectUSB() {
  for (let i = 0; i < ATTEMPTS; i++) {
    const [device] = await TransportWebUSB.list();

    if (!device) {
      await TransportWebUSB.create();
      await pause(PAUSE);
      continue;
    }

    if (device.opened) {
      return (await TransportWebUSB.openConnected()) ?? (await TransportWebUSB.request());
    } else {
      return TransportWebUSB.open(device);
    }
  }

  throw new Error('Failed to connect');
}

export async function submitLedgerStake(
  accountId: string,
  amount: bigint,
  type: ApiStakingType,
  fee?: bigint,
) {
  const { network } = parseAccountId(accountId);
  const address = await callApi('fetchAddress', accountId);

  let result: string | { error: ApiTransactionError } | undefined;

  if (type === 'liquid') {
    amount += ONE_TON;

    const payload: TonPayloadFormat = {
      type: 'tonstakers-deposit',
      queryId: 0n,
      // eslint-disable-next-line no-null/no-null
      appId: null,
    };

    result = await submitLedgerTransfer({
      accountId,
      password: '',
      toAddress: LIQUID_POOL,
      amount,
    }, TONCOIN_SLUG, { type: 'stake' }, payload);
  } else {
    const backendState = await callApi('fetchBackendStakingState', address!);
    const poolAddress = toBase64Address(backendState!.nominatorsPool.address, true, network);

    result = await submitLedgerTransfer({
      accountId,
      password: '',
      toAddress: poolAddress,
      amount,
      comment: STAKE_COMMENT,
      fee,
    }, TONCOIN_SLUG, { type: 'stake' });
  }

  if (result) {
    await callApi('updateAccountMemoryCache', accountId, address!, { stakedAt: Date.now() });
  }

  await callApi('onStakingChangeExpected');

  return result;
}

export async function submitLedgerUnstake(accountId: string, type: ApiStakingType, amount: bigint) {
  const { network } = parseAccountId(accountId);
  const address = (await callApi('fetchAddress', accountId))!;
  const { backendState, state: stakingState } = (await callApi('getStakingState', accountId))!;

  let result: string | { error: ApiTransactionError } | undefined;

  if (type === 'liquid') {
    const tokenWalletAddress = await callApi('resolveTokenWalletAddress', network, address, LIQUID_JETTON);
    const mode = stakingState.type === 'liquid' && !stakingState.instantAvailable
      ? ApiLiquidUnstakeMode.BestRate
      : ApiLiquidUnstakeMode.Default;

    const fillOrKill = false;
    const waitTillRoundEnd = mode === ApiLiquidUnstakeMode.BestRate;

    const payload: TonPayloadFormat = {
      type: 'jetton-burn',
      queryId: 0n,
      amount,
      responseDestination: Address.parse(address),
      customPayload: buildLiquidStakingWithdrawCustomPayload(fillOrKill, waitTillRoundEnd),
    };

    result = await submitLedgerTransfer({
      accountId,
      password: '',
      toAddress: tokenWalletAddress!,
      amount: ONE_TON,
    }, TONCOIN_SLUG, { type: 'unstakeRequest' }, payload);
  } else {
    const poolAddress = toBase64Address(backendState!.nominatorsPool.address, true, network);
    result = await submitLedgerTransfer({
      accountId,
      password: '',
      toAddress: poolAddress,
      amount: ONE_TON,
      comment: UNSTAKE_COMMENT,
    }, TONCOIN_SLUG, { type: 'unstakeRequest' });
  }

  await callApi('onStakingChangeExpected');

  return result;
}

export async function submitLedgerTransfer(
  options: ApiSubmitTransferOptions,
  slug: string,
  localTransactionParams?: Partial<ApiLocalTransactionParams>,
  payload?: TonPayloadFormat,
) {
  const {
    accountId, tokenAddress, comment, fee,
  } = options;
  let { toAddress, amount } = options;
  const { network } = parseAccountId(accountId);

  await callApi('waitLastTransfer', accountId);

  const fromAddress = await callApi('fetchAddress', accountId);

  const [path, walletInfo, appInfo] = await Promise.all([
    getLedgerAccountPath(accountId),
    callApi('getWalletInfo', network, fromAddress!),
    getTonAppInfo(),
  ]);

  const { seqno, balance } = walletInfo!;

  const parsedAddress = Address.parseFriendly(toAddress);
  let isBounceable = parsedAddress.isBounceable;
  const normalizedAddress = parsedAddress.address.toString({ urlSafe: true, bounceable: DEFAULT_IS_BOUNCEABLE });

  const { isUnsafeSupported, isJettonIdSupported } = appInfo;

  if (tokenAddress) {
    ({ toAddress, amount, payload } = await buildLedgerTokenTransfer(
      network,
      tokenAddress,
      fromAddress!,
      toAddress,
      amount,
      comment,
      isJettonIdSupported,
    ));
    isBounceable = true;
  } else if (comment) {
    if (isValidLedgerComment(comment)) {
      payload = { type: 'comment', text: comment };
    } else if (isUnsafeSupported) {
      payload = { type: 'unsafe', message: buildCommentPayload(comment) };
    } else {
      return {
        error: ApiTransactionError.NotSupportedHardwareOperation,
      };
    }
  }

  const isFullTonBalance = !tokenAddress && balance === amount;

  const sendMode = isFullTonBalance
    ? SendMode.CARRY_ALL_REMAINING_BALANCE
    : SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS;

  try {
    const signedCell = await tonTransport!.signTransaction(path, {
      to: Address.parse(toAddress),
      sendMode,
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
        ...localTransactionParams,
      },
    };

    return await callApi('sendSignedTransferMessage', accountId, message);
  } catch (err: any) {
    handleLedgerErrors(err);
    logDebugError('submitLedgerTransfer', err);
    return undefined;
  }
}

export async function submitLedgerNftTransfer(options: {
  accountId: string;
  password: string;
  nftAddress: string;
  toAddress: string;
  comment?: string;
  nft?: ApiNft;
  fee?: bigint;
}) {
  const {
    accountId, nftAddress, comment, nft, fee,
  } = options;
  let { toAddress } = options;
  const { network } = parseAccountId(accountId);

  await callApi('waitLastTransfer', accountId);

  const fromAddress = await callApi('fetchAddress', accountId);

  const [path, walletInfo, appInfo] = await Promise.all([
    getLedgerAccountPath(accountId),
    callApi('getWalletInfo', network, fromAddress!),
    getTonAppInfo(),
  ]);

  if (!appInfo.isUnsafeSupported) {
    return {
      error: ApiTransactionError.NotSupportedHardwareOperation,
    };
  }

  const { seqno } = walletInfo!;

  const isNotcoinBurn = nft?.collectionAddress === NOTCOIN_VOUCHERS_ADDRESS
    && (toAddress === BURN_ADDRESS || NOTCOIN_EXCHANGERS.includes(toAddress as any));
  // eslint-disable-next-line no-null/no-null
  let forwardPayload: Cell | null = null;
  let forwardAmount = NFT_TRANSFER_FORWARD_AMOUNT;

  if (isNotcoinBurn) {
    ({ forwardPayload, toAddress } = buildNotcoinVoucherExchange(nftAddress, nft!.index));
    forwardAmount = 50000000n;
  } else if (comment) {
    forwardPayload = buildCommentPayload(comment);
  }

  try {
    const signedCell = await tonTransport!.signTransaction(path, {
      to: Address.parse(nftAddress),
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      seqno: seqno!,
      timeout: getTransferExpirationTime(),
      bounce: true,
      amount: NFT_TRANSFER_AMOUNT,
      payload: {
        type: 'nft-transfer',
        queryId: 0n,
        newOwner: Address.parse(toAddress),
        responseDestination: Address.parse(fromAddress!),
        // eslint-disable-next-line no-null/no-null
        customPayload: null,
        forwardAmount,
        forwardPayload,
      },
    });

    const message: ApiSignedTransfer = {
      base64: signedCell.toBoc().toString('base64'),
      seqno: seqno!,
      params: {
        amount: NFT_TRANSFER_AMOUNT,
        fromAddress: fromAddress!,
        toAddress: options.toAddress,
        comment,
        fee: fee!,
        slug: TONCOIN_SLUG,
        type: 'nftTransferred',
        nft,
        normalizedAddress: toBase64Address(nftAddress, true, network),
      },
    };

    return await callApi('sendSignedTransferMessage', accountId, message);
  } catch (error) {
    logDebugError('submitLedgerNftTransfer', error);
    return undefined;
  }
}

function buildNotcoinVoucherExchange(nftAddress: string, nftIndex: number) {
  // eslint-disable-next-line no-bitwise
  const first4Bits = Address.parse(nftAddress).hash.readUint8() >> 4;
  const toAddress = NOTCOIN_EXCHANGERS[first4Bits];

  const forwardPayload = new Builder()
    .storeUint(0x5fec6642, 32)
    .storeUint(nftIndex, 64)
    .endCell();

  return { forwardPayload, toAddress };
}

export async function buildLedgerTokenTransfer(
  network: ApiNetwork,
  tokenAddress: string,
  fromAddress: string,
  toAddress: string,
  amount: bigint,
  comment?: string,
  isJettonIdSupported?: boolean,
) {
  const tokenWalletAddress = await callApi('resolveTokenWalletAddress', network, fromAddress, tokenAddress);
  const realTokenAddress = await callApi('resolveTokenMinterAddress', network, tokenWalletAddress!);
  if (tokenAddress !== realTokenAddress) {
    throw new Error('Invalid contract');
  }

  // eslint-disable-next-line no-null/no-null
  const forwardPayload = comment ? buildCommentPayload(comment) : null;

  const payload: TonPayloadFormat = {
    type: 'jetton-transfer',
    queryId: 0n,
    amount,
    destination: Address.parse(toAddress),
    responseDestination: Address.parse(fromAddress),
    // eslint-disable-next-line no-null/no-null
    customPayload: null,
    forwardAmount: TOKEN_TRANSFER_FORWARD_AMOUNT,
    forwardPayload,
    // eslint-disable-next-line no-null/no-null
    knownJetton: isJettonIdSupported ? getKnownJettonId(tokenAddress) : null,
  };

  return {
    amount: TOKEN_TRANSFER_AMOUNT,
    toAddress: tokenWalletAddress!,
    payload,
  };
}

function getKnownJettonId(tokenAddress: string) {
  const index = knownJettonAddresses.indexOf(tokenAddress);
  // eslint-disable-next-line no-null/no-null
  return index > -1 ? { jettonId: index, workchain: WORKCHAIN } : null;
}

function buildCommentPayload(comment: string) {
  const bytes = commentToBytes(comment);
  return packBytesAsSnakeCell(bytes);
}

export async function signLedgerTransactions(accountId: string, messages: ApiDappTransfer[], options?: {
  isTonConnect?: boolean;
  vestingAddress?: string;
}): Promise<ApiSignedTransfer[]> {
  const { isTonConnect, vestingAddress } = options ?? {};

  const { network } = parseAccountId(accountId);

  await callApi('waitLastTransfer', accountId);

  const [path, fromAddress, appInfo] = await Promise.all([
    getLedgerAccountPath(accountId),
    callApi('fetchAddress', accountId),
    getTonAppInfo(),
  ]);

  const { isUnsafeSupported, isJettonIdSupported } = appInfo;

  if (isTonConnect && !isUnsafeSupported) {
    throw new ApiUnsupportedVersionError('Please update Ledger TON app.');
  }

  const seqno = await callApi('getWalletSeqno', accountId, vestingAddress);
  const walletSpecifiers: TransactionParams['walletSpecifiers'] = vestingAddress
    ? { subwalletId: VESTING_SUBWALLET_ID, includeWalletOp: false }
    : undefined;

  const preparedParams: TransactionParams[] = await Promise.all(messages.map(async (message, index) => {
    const {
      toAddress,
      amount,
      stateInit: stateInitBase64,
      rawPayload,
    } = message;

    const isBounceable = Address.isFriendly(toAddress)
      ? Address.parseFriendly(toAddress).isBounceable
      : DEFAULT_IS_BOUNCEABLE;

    let ledgerPayload: TonPayloadFormat | undefined;

    if (rawPayload) {
      ledgerPayload = parseMessage(Cell.fromBase64(rawPayload), { disallowModification: true });
    }

    if (ledgerPayload?.type === 'jetton-transfer') {
      const tokenAddress = await callApi('resolveTokenMinterAddress', network, toAddress);
      // eslint-disable-next-line no-null/no-null
      ledgerPayload.knownJetton = isJettonIdSupported ? getKnownJettonId(tokenAddress!) : null;
    }

    const stateInit = stateInitBase64 ? loadStateInit(
      Cell.fromBase64(stateInitBase64).asSlice(),
    ) : undefined;

    return {
      to: Address.parse(toAddress),
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      seqno: seqno! + index,
      timeout: getTransferExpirationTime(),
      bounce: isBounceable,
      amount: BigInt(amount),
      payload: ledgerPayload,
      walletSpecifiers,
      stateInit,
    };
  }));

  const signedMessages: ApiSignedTransfer[] = [];

  const attempts = ATTEMPTS + preparedParams.length;
  let index = 0;
  let attempt = 0;

  while (index < preparedParams.length && attempt < attempts) {
    const params = preparedParams[index];
    const message = messages[index];

    try {
      const base64 = (await tonTransport!.signTransaction(path, params)).toBoc().toString('base64');
      signedMessages.push({
        base64,
        seqno: params.seqno,
        params: {
          amount: message.amount,
          fromAddress: fromAddress!,
          toAddress: message.toAddress,
          comment: message.payload?.type === 'comment' ? message.payload.comment : undefined,
          fee: 0n,
          slug: TONCOIN_SLUG,
        },
      });
      index++;
    } catch (err: any) {
      handleLedgerErrors(err);
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
      const walletInfo = await getLedgerWalletInfo(network, index);

      if (alreadyImportedAddresses.includes(walletInfo.address)) {
        index += 1;
        continue;
      }

      if (walletInfo.balance !== 0n) {
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

export async function getLedgerWalletInfo(network: ApiNetwork, accountIndex: number): Promise<LedgerWalletInfo> {
  const { address, publicKey } = await getLedgerWalletAddress(accountIndex);
  const balance = (await callApi('getWalletBalance', network, address))!;

  return {
    index: accountIndex,
    address,
    publicKey: publicKey!.toString('hex'),
    balance,
    version: WALLET_VERSION,
    driver: 'HID',
    deviceId: transport!.deviceModel?.id,
    deviceName: transport!.deviceModel?.productName,
  };
}

export function getLedgerWalletAddress(index: number, isTestnet?: boolean) {
  const path = getLedgerAccountPathByIndex(index, isTestnet);

  return tonTransport!.getAddress(path, {
    chain: CHAIN,
    bounceable: WALLET_IS_BOUNCEABLE,
    walletVersion: INTERNAL_WALLET_VERSION,
  });
}

export async function verifyAddress(accountId: string) {
  const path = await getLedgerAccountPath(accountId);

  await tonTransport!.validateAddress(path, {
    bounceable: IS_BOUNCEABLE,
    walletVersion: INTERNAL_WALLET_VERSION,
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

export async function getTonAppInfo() {
  const version = await tonTransport!.getVersion();
  const isUnsafeSupported = compareVersions(version, VERSION_WITH_UNSAFE) >= 0;
  const isJettonIdSupported = compareVersions(version, VERSION_WITH_JETTON_ID) >= 0
    && transport!.deviceModel?.id !== 'nanoS';
  return { version, isUnsafeSupported, isJettonIdSupported };
}

function handleLedgerErrors(err: any) {
  if (err?.message.includes('(0xbd00)')) {
    throw new ApiHardwareBlindSigningNotEnabled();
  }
  if (err?.statusCode === StatusCodes.CONDITIONS_OF_USE_NOT_SATISFIED) {
    throw new ApiUserRejectsError();
  }
}
