import { StatusCodes } from '@ledgerhq/errors';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';
import type { StateInit } from '@ton/core';
import { loadStateInit } from '@ton/core';
import type { TonPayloadFormat } from '@ton-community/ton-ledger';
import { KNOWN_JETTONS, parseMessage, TonTransport } from '@ton-community/ton-ledger';
import type { HIDTransport } from 'mtw-capacitor-usb-hid';
import { Address } from '@ton/core/dist/address/Address';
import { Builder } from '@ton/core/dist/boc/Builder';
import { Cell } from '@ton/core/dist/boc/Cell';
import { SendMode } from '@ton/core/dist/types/SendMode';

import type { Workchain } from '../../api/chains/ton';
import type { ApiSubmitTransferOptions } from '../../api/methods/types';
import type { ApiTonConnectProof } from '../../api/tonConnect/types';
import type {
  ApiDappTransfer,
  ApiJettonStakingState,
  ApiLocalTransactionParams,
  ApiNetwork,
  ApiNft,
  ApiSignedTransfer,
  ApiStakingState,
} from '../../api/types';
import type BleTransport from '../../lib/ledger-hw-transport-ble/BleTransport';
import type { LedgerTransport, LedgerWalletInfo } from './types';
import { ApiLiquidUnstakeMode, ApiTransactionError } from '../../api/types';

import {
  BURN_ADDRESS, IS_CAPACITOR, LIQUID_JETTON, LIQUID_POOL,
  NOTCOIN_EXCHANGERS, NOTCOIN_VOUCHERS_ADDRESS, TONCOIN,
} from '../../config';
import { callApi } from '../../api';
import {
  DEFAULT_IS_BOUNCEABLE,
  NFT_TRANSFER_AMOUNT,
  NFT_TRANSFER_FORWARD_AMOUNT,
  STAKE_COMMENT,
  TOKEN_TRANSFER_AMOUNT,
  TOKEN_TRANSFER_FORWARD_AMOUNT,
  TON_GAS,
  TRANSFER_TIMEOUT_SEC,
  UNSTAKE_COMMENT,
  WALLET_IS_BOUNCEABLE,
  WORKCHAIN,
} from '../../api/chains/ton/constants';
import {
  buildJettonClaimPayload,
  buildJettonUnstakePayload,
  buildLiquidStakingWithdrawCustomPayload,
  commentToBytes,
  packBytesAsSnakeCell,
  toBase64Address,
} from '../../api/chains/ton/util/tonCore';
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
import { IS_ANDROID_APP } from '../windowEnvironment';
import { isLedgerConnectionBroken, isValidLedgerComment } from './utils';

import { StakingPool } from '../../api/chains/ton/contracts/JettonStaking/StakingPool';

type BleConnectorClass = typeof import('./bleConnector').BleConnector;
type HIDTransportClass = typeof import('mtw-capacitor-usb-hid/dist/esm').HIDTransport;
type ListLedgerDevicesFunction = typeof import('mtw-capacitor-usb-hid/dist/esm').listLedgerDevices;

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

export type PossibleWalletVersion = 'v3R2' | 'v4R2';

enum LedgerWalletVersion {
  v3R2 = 'v3r2',
  v4R2 = 'v4',
}

const INTERNAL_WORKCHAIN = 0; // workchain === -1 ? 255 : 0;
const DEFAULT_WALLET_VERSION: PossibleWalletVersion = 'v4R2';

const ATTEMPTS = 10;
const PAUSE = 125;
const IS_BOUNCEABLE = false;
const VERSION_WITH_UNSAFE = '2.1.0';
const VERSION_WITH_JETTON_ID = '2.2.0';
const VESTING_SUBWALLET_ID = 0x10C;

const knownJettonAddresses = KNOWN_JETTONS.map(
  ({ masterAddress }) => masterAddress.toString({ bounceable: true, urlSafe: true }),
);

let transport: TransportWebHID | TransportWebUSB | BleTransport | HIDTransport | undefined;
let tonTransport: TonTransport | undefined;
let isHidSupported = false;
let isWebUsbSupported = false;
let isBluetoothSupported = false;
let currentLedgerTransport: LedgerTransport | undefined;

let hidImportPromise: Promise<{
  transport: HIDTransportClass;
  listLedgerDevices: ListLedgerDevicesFunction;
}>;
let bleImportPromise: Promise<BleConnectorClass>;
let BleConnector: BleConnectorClass;
let MtwHidTransport: HIDTransportClass;
let listLedgerDevices: ListLedgerDevicesFunction;

async function ensureBleConnector() {
  if (!IS_CAPACITOR) return undefined;

  if (!bleImportPromise) {
    bleImportPromise = import('./bleConnector').then((module) => {
      return module.BleConnector;
    });
    BleConnector = await bleImportPromise;
  }

  return bleImportPromise;
}

async function ensureHidTransport() {
  if (!IS_ANDROID_APP) return undefined;

  if (!hidImportPromise) {
    hidImportPromise = import('mtw-capacitor-usb-hid/dist/esm').then((module) => {
      return {
        transport: module.HIDTransport,
        listLedgerDevices: module.listLedgerDevices,
      };
    });
    const result = await hidImportPromise;
    MtwHidTransport = result.transport;
    listLedgerDevices = result.listLedgerDevices;
  }

  return hidImportPromise;
}

void ensureBleConnector();
void ensureHidTransport();

export async function detectAvailableTransports() {
  await ensureBleConnector();
  await ensureHidTransport();
  [isHidSupported, isBluetoothSupported, isWebUsbSupported] = await Promise.all([
    IS_ANDROID_APP ? MtwHidTransport.isSupported() : TransportWebHID.isSupported(),
    BleConnector ? BleConnector.isSupported() : Promise.resolve(false),
    TransportWebUSB.isSupported(),
  ]);

  return {
    isUsbAvailable: isHidSupported || isWebUsbSupported,
    isBluetoothAvailable: isBluetoothSupported,
  };
}

function getInternalWalletVersion(version: PossibleWalletVersion) {
  return LedgerWalletVersion[version];
}

export async function importLedgerWallet(network: ApiNetwork, accountIndex: number) {
  const walletInfo = await getLedgerWalletInfo(network, accountIndex);
  return callApi('importLedgerWallet', network, walletInfo);
}

export async function reconnectLedger() {
  try {
    if (await tonTransport?.isAppOpen()) {
      return true;
    }
  } catch {
    // Do nothing
  }

  const isLedgerConnected = await connectLedger();
  if (!isLedgerConnected) return false;

  try {
    return await waitLedgerTonApp();
  } catch (err: any) {
    if (isLedgerConnectionBroken(err.name)) {
      return reconnectLedger();
    }

    throw err;
  }
}

export async function connectLedger(preferredTransport?: LedgerTransport) {
  if (preferredTransport) currentLedgerTransport = preferredTransport;

  try {
    switch (currentLedgerTransport) {
      case 'bluetooth':
        transport = await connectBLE();
        break;

      case 'usb':
      default:
        if (isHidSupported) {
          transport = await connectHID();
        } else if (isWebUsbSupported) {
          transport = await connectWebUsb();
        }
        break;
    }

    if (!transport) {
      logDebugError('connectLedger: BLE and/or HID are not supported');
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
      const isTonOpen = await tonTransport?.isAppOpen();

      if (isTonOpen) {
        if (transport?.deviceModel?.id.startsWith('nanoS')) {
          // Workaround for Ledger Nano S or Nano S Plus, this is a way to check if it is unlocked.
          // There will be an error with code 0x530c.
          await tonTransport?.getAddress(getLedgerAccountPathByIndex(0), {
            walletVersion: LedgerWalletVersion[DEFAULT_WALLET_VERSION],
          });
        }

        return true;
      }
    } catch (err: any) {
      if (isLedgerConnectionBroken(err.name)) {
        tonTransport = undefined;
        throw err;
      }
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

function connectHID() {
  if (IS_ANDROID_APP) {
    return connectCapacitorHID();
  }

  return connectWebHID();
}

async function connectWebHID() {
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

async function connectWebUsb() {
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

async function connectCapacitorHID(): Promise<HIDTransport> {
  for (let i = 0; i < ATTEMPTS; i++) {
    const [device] = await listLedgerDevices();

    if (!device) {
      await pause(PAUSE);
      continue;
    }

    return MtwHidTransport.open(device);
  }

  throw new Error('Failed to connect');
}

async function connectBLE(): Promise<BleTransport> {
  if (!BleConnector) {
    throw new Error('BLE is not supported on this device.');
  }

  const connection = await BleConnector.connect();
  return connection.bleTransport;
}

export async function submitLedgerStake(
  accountId: string,
  amount: bigint,
  state: ApiStakingState,
  realFee?: bigint,
) {
  const address = await callApi('fetchAddress', accountId, 'ton');

  let result: string | { error: ApiTransactionError } | undefined;
  const localTransactionParams: Partial<ApiLocalTransactionParams> = { type: 'stake' };

  switch (state.type) {
    case 'nominators': {
      result = await submitLedgerTransfer({
        accountId,
        password: '',
        toAddress: state.pool,
        amount: amount + TON_GAS.stakeNominators,
        comment: STAKE_COMMENT,
        realFee,
      }, TONCOIN.slug, localTransactionParams);
      break;
    }
    case 'liquid': {
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
        amount: amount + TON_GAS.stakeLiquid,
        realFee,
      }, TONCOIN.slug, localTransactionParams, payload);
      break;
    }
    case 'jetton': {
      const {
        pool: poolAddress,
        period,
        tokenAddress,
        tokenSlug,
      } = state;

      Object.assign(localTransactionParams, {
        inMsgHash: undefined,
        slug: tokenSlug,
        toAddress: poolAddress,
      });

      result = await submitLedgerTransfer({
        accountId,
        password: '',
        toAddress: poolAddress,
        tokenAddress,
        amount,
        data: StakingPool.stakePayload(period),
        forwardAmount: TON_GAS.stakeJettonsForward,
        realFee,
      }, TONCOIN.slug, localTransactionParams);
      break;
    }
  }

  if (result) {
    await callApi('updateAccountMemoryCache', accountId, address!, { stakedAt: Date.now() });
  }

  return result;
}

export async function submitLedgerUnstake(accountId: string, state: ApiStakingState, amount: bigint, realFee?: bigint) {
  const { network } = parseAccountId(accountId);
  const address = (await callApi('fetchAddress', accountId, 'ton'))!;

  let result: string | { error: ApiTransactionError } | undefined;
  const localTransactionParams: Partial<ApiLocalTransactionParams> = { type: 'unstakeRequest' };

  switch (state.type) {
    case 'nominators': {
      const poolAddress = toBase64Address(state.pool, true, network);
      result = await submitLedgerTransfer({
        accountId,
        password: '',
        toAddress: poolAddress,
        amount: TON_GAS.unstakeNominators,
        comment: UNSTAKE_COMMENT,
        realFee,
      }, TONCOIN.slug, localTransactionParams);
      break;
    }
    case 'liquid': {
      const tokenWalletAddress = await callApi('resolveTokenWalletAddress', network, address, LIQUID_JETTON);
      const mode = !state.instantAvailable
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
        amount: TON_GAS.unstakeLiquid,
        realFee,
      }, TONCOIN.slug, localTransactionParams, payload);
      break;
    }
    case 'jetton': {
      const { stakeWalletAddress } = state;
      const payload: TonPayloadFormat = {
        type: 'unsafe',
        message: buildJettonUnstakePayload(amount, true),
      };

      result = await submitLedgerTransfer({
        accountId,
        password: '',
        toAddress: stakeWalletAddress,
        amount: TON_GAS.unstakeJettons,
        realFee,
      }, TONCOIN.slug, localTransactionParams, payload);
      break;
    }
  }

  return result;
}

export function submitLedgerStakingClaim(
  accountId: string,
  state: ApiJettonStakingState,
  realFee?: bigint,
) {
  const payload: TonPayloadFormat = {
    type: 'unsafe',
    message: buildJettonClaimPayload(state.poolWallets!),
  };

  return submitLedgerTransfer({
    accountId,
    amount: TON_GAS.claimJettons,
    password: '',
    toAddress: state.stakeWalletAddress,
    realFee,
  }, TONCOIN.slug, undefined, payload);
}

export async function submitLedgerTransfer(
  options: ApiSubmitTransferOptions & { data?: Cell },
  slug: string,
  localTransactionParams?: Partial<ApiLocalTransactionParams>,
  payload?: TonPayloadFormat,
) {
  const {
    accountId,
    tokenAddress,
    comment,
    realFee,
    data,
    forwardAmount,
  } = options;
  let { toAddress, amount } = options;
  const { network } = parseAccountId(accountId);

  const pendingTransferId = await callApi('waitAndCreateTonPendingTransfer', accountId);
  const fromAddress = await callApi('fetchAddress', accountId, 'ton');

  const [path, walletInfo, appInfo, account] = await Promise.all([
    getLedgerAccountPath(accountId),
    callApi('getWalletInfo', network, fromAddress!),
    getTonAppInfo(),
    callApi('fetchLedgerAccount', accountId),
  ]);

  const { seqno, balance } = walletInfo!;

  const parsedAddress = Address.parseFriendly(toAddress);
  let isBounceable = parsedAddress.isBounceable;
  const normalizedAddress = parsedAddress.address.toString({ urlSafe: true, bounceable: DEFAULT_IS_BOUNCEABLE });

  const { isUnsafeSupported, isJettonIdSupported } = appInfo;

  if (tokenAddress) {
    ({ toAddress, amount, payload } = await buildLedgerTokenTransfer({
      network,
      tokenAddress,
      fromAddress: fromAddress!,
      toAddress,
      amount,
      data: comment || data,
      isJettonIdSupported,
      forwardAmount,
    }));
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

  const walletSpecifiers = account!.ton.version === 'v3R2'
    ? { includeWalletOp: false }
    : undefined;

  try {
    const signedCell = await tonTransport!.signTransaction(path, {
      to: Address.parse(toAddress),
      sendMode,
      seqno: seqno!,
      timeout: getTransferExpirationTime(),
      bounce: isBounceable,
      amount: BigInt(amount),
      payload,
      walletSpecifiers,
    });

    const message: ApiSignedTransfer = {
      base64: signedCell.toBoc().toString('base64'),
      seqno: seqno!,
      params: {
        amount: options.amount,
        fromAddress: fromAddress!,
        toAddress: normalizedAddress,
        comment,
        fee: realFee ?? 0n,
        slug,
        ...localTransactionParams,
      },
    };

    return await callApi('sendSignedTransferMessage', accountId, message, pendingTransferId!);
  } catch (err: any) {
    await callApi('cancelPendingTransfer', pendingTransferId!);

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
  realFee?: bigint;
}) {
  const {
    accountId, nftAddress, comment, nft, realFee,
  } = options;
  let { toAddress } = options;
  const { network } = parseAccountId(accountId);

  const pendingTransferId = await callApi('waitAndCreateTonPendingTransfer', accountId);

  const fromAddress = await callApi('fetchAddress', accountId, 'ton');

  const [path, walletInfo, appInfo, account] = await Promise.all([
    getLedgerAccountPath(accountId),
    callApi('getWalletInfo', network, fromAddress!),
    getTonAppInfo(),
    callApi('fetchLedgerAccount', accountId),
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

  const walletSpecifiers = account!.ton.version === 'v3R2'
    ? { includeWalletOp: false }
    : undefined;

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
      walletSpecifiers,
    });

    const message: ApiSignedTransfer = {
      base64: signedCell.toBoc().toString('base64'),
      seqno: seqno!,
      params: {
        amount: NFT_TRANSFER_AMOUNT,
        fromAddress: fromAddress!,
        toAddress: options.toAddress,
        comment,
        fee: realFee ?? 0n,
        slug: TONCOIN.slug,
        type: 'nftTransferred',
        nft,
        normalizedAddress: toBase64Address(nftAddress, true, network),
      },
    };

    return await callApi('sendSignedTransferMessage', accountId, message, pendingTransferId!);
  } catch (error) {
    await callApi('cancelPendingTransfer', pendingTransferId!);

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

export async function buildLedgerTokenTransfer({
  network,
  tokenAddress,
  fromAddress,
  toAddress,
  amount,
  data,
  isJettonIdSupported,
  forwardAmount = TOKEN_TRANSFER_FORWARD_AMOUNT,
}: {
  network: ApiNetwork;
  tokenAddress: string;
  fromAddress: string;
  toAddress: string;
  amount: bigint;
  data?: string | Cell;
  isJettonIdSupported?: boolean;
  forwardAmount?: bigint;
}) {
  const tokenWalletAddress = await callApi('resolveTokenWalletAddress', network, fromAddress, tokenAddress);
  const realTokenAddress = await callApi('resolveTokenAddress', network, tokenWalletAddress!);
  if (tokenAddress !== realTokenAddress) {
    throw new Error('Invalid contract');
  }

  // eslint-disable-next-line no-null/no-null
  const forwardPayload = typeof data === 'string' ? buildCommentPayload(data) : data ?? null;

  const payload: TonPayloadFormat = {
    type: 'jetton-transfer',
    queryId: 0n,
    amount,
    destination: Address.parse(toAddress),
    responseDestination: Address.parse(fromAddress),
    // eslint-disable-next-line no-null/no-null
    customPayload: null,
    forwardAmount,
    forwardPayload,
    // eslint-disable-next-line no-null/no-null
    knownJetton: isJettonIdSupported ? getKnownJettonId(tokenAddress) : null,
  };

  let toncoinAmount = TOKEN_TRANSFER_AMOUNT;
  if (forwardAmount !== TOKEN_TRANSFER_FORWARD_AMOUNT) {
    toncoinAmount += forwardAmount;
  }

  return {
    amount: toncoinAmount,
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

  const [path, appInfo, account] = await Promise.all([
    getLedgerAccountPath(accountId),
    getTonAppInfo(),
    callApi('fetchLedgerAccount', accountId),
  ]);
  const fromAddress = account!.ton.address;

  const { isUnsafeSupported, isJettonIdSupported } = appInfo;

  if (isTonConnect && !isUnsafeSupported) {
    throw new ApiUnsupportedVersionError('Please update Ledger TON app.');
  }

  const seqno = await callApi('getWalletSeqno', accountId, vestingAddress);
  let walletSpecifiers: TransactionParams['walletSpecifiers'];
  if (account!.ton.version === 'v3R2') {
    walletSpecifiers = { includeWalletOp: false };
  }
  if (vestingAddress) {
    walletSpecifiers = { subwalletId: VESTING_SUBWALLET_ID, includeWalletOp: false };
  }

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
      const tokenAddress = await callApi('resolveTokenAddress', network, toAddress);
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
          slug: TONCOIN.slug,
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
  const balance = (await callApi('getWalletBalance', 'ton', network, address))!;

  return {
    index: accountIndex,
    address,
    publicKey: publicKey!.toString('hex'),
    balance,
    version: DEFAULT_WALLET_VERSION,
    driver: 'HID',
    deviceId: transport!.deviceModel?.id,
    deviceName: transport!.deviceModel?.productName,
  };
}

export function getLedgerWalletAddress(index: number, isTestnet?: boolean) {
  const path = getLedgerAccountPathByIndex(index, isTestnet);

  return tonTransport!.getAddress(path, {
    chain: INTERNAL_WORKCHAIN,
    bounceable: WALLET_IS_BOUNCEABLE,
    walletVersion: LedgerWalletVersion[DEFAULT_WALLET_VERSION],
  });
}

export async function verifyAddress(accountId: string) {
  const [account, path] = await Promise.all([
    callApi('fetchLedgerAccount', accountId),
    getLedgerAccountPath(accountId),
  ]);

  await tonTransport!.validateAddress(path, {
    bounceable: IS_BOUNCEABLE,
    walletVersion: getInternalWalletVersion(account!.ton.version as PossibleWalletVersion),
  });
}

async function getLedgerAccountPath(accountId: string) {
  const account = await callApi('fetchLedgerAccount', accountId);
  const index = account!.ton.index;

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
