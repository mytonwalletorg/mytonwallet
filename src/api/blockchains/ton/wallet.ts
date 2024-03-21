import { beginCell, storeStateInit } from '@ton/core';

import type { ApiNetwork, ApiWalletVersion } from '../../types';
import type { ContractInfo, WalletInfo } from './types';
import type { TonWallet } from './util/tonCore';
import { WORKCHAIN } from '../../types';

import { DEFAULT_WALLET_VERSION } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { pick } from '../../../util/iteratees';
import withCacheAsync from '../../../util/withCacheAsync';
import { stringifyTxId } from './util';
import {
  getTonClient, toBase64Address, walletClassMap,
} from './util/tonCore';
import { fetchStoredAccount, fetchStoredAddress } from '../../common/accounts';
import { base64ToBytes, hexToBytes, sha256 } from '../../common/utils';
import { ALL_WALLET_VERSIONS, KnownContracts } from './constants';

export const isAddressInitialized = withCacheAsync(
  async (network: ApiNetwork, walletOrAddress: TonWallet | string) => {
    return (await getWalletInfo(network, walletOrAddress)).isInitialized;
  },
);

export const isActiveSmartContract = withCacheAsync(async (network: ApiNetwork, address: string) => {
  const { isInitialized, isWallet } = await getWalletInfo(network, address);
  return isInitialized ? !isWallet : undefined;
}, (value) => value !== undefined);

export function publicKeyToAddress(
  network: ApiNetwork,
  publicKey: Uint8Array,
  walletVersion: ApiWalletVersion,
) {
  const wallet = buildWallet(network, publicKey, walletVersion);
  return toBase64Address(wallet.address, false, network);
}

export function buildWallet(network: ApiNetwork, publicKey: Uint8Array, walletVersion: ApiWalletVersion): TonWallet {
  const client = getTonClient(network);
  const WalletClass = walletClassMap[walletVersion]!;
  return client.open(
    WalletClass.create({
      publicKey: Buffer.from(publicKey),
      workchain: WORKCHAIN,
    }),
  );
}

export async function getWalletInfo(network: ApiNetwork, walletOrAddress: TonWallet | string): Promise<{
  isInitialized: boolean;
  isWallet: boolean;
  seqno: number;
  balance: bigint;
  lastTxId?: string;
}> {
  const address = typeof walletOrAddress === 'string'
    ? walletOrAddress
    : toBase64Address(walletOrAddress.address, undefined, network);

  const {
    account_state: accountState,
    wallet: isWallet,
    seqno = 0,
    balance,
    last_transaction_id: {
      lt,
      hash,
    },
  } = await getTonClient(network).getWalletInfo(address);

  return {
    isInitialized: accountState === 'active',
    isWallet,
    seqno,
    balance: BigInt(balance || '0'),
    lastTxId: lt === '0'
      ? undefined
      : stringifyTxId({ lt, hash }),
  };
}

export async function getContractInfo(network: ApiNetwork, address: string): Promise<{
  isInitialized: boolean;
  isLedgerAllowed: boolean;
  isSwapAllowed?: boolean;
  isWallet?: boolean;
  contractInfo?: ContractInfo;
  codeHash?: string;
}> {
  const data = await getTonClient(network).getAddressInfo(address);

  const { code, state } = data;

  const codeHash = Buffer.from(await sha256(base64ToBytes(code))).toString('hex');
  const contractInfo = Object.values(KnownContracts).find((info) => info.hash === codeHash);

  const isInitialized = state === 'active';
  const isWallet = state === 'active' ? contractInfo?.type === 'wallet' : undefined;
  const isLedgerAllowed = Boolean(!isInitialized || contractInfo?.isLedgerAllowed);
  const isSwapAllowed = contractInfo?.isSwapAllowed;

  return {
    isInitialized,
    isWallet,
    isLedgerAllowed,
    isSwapAllowed,
    contractInfo,
    codeHash,
  };
}

export async function getAccountBalance(accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(accountId);

  return getWalletBalance(network, address);
}

export async function getWalletBalance(network: ApiNetwork, walletOrAddress: TonWallet | string): Promise<bigint> {
  return (await getWalletInfo(network, walletOrAddress)).balance;
}

export async function getWalletSeqno(network: ApiNetwork, walletOrAddress: TonWallet | string): Promise<number> {
  const { seqno } = await getWalletInfo(network, walletOrAddress);
  return seqno || 0;
}

export async function pickBestWallet(network: ApiNetwork, publicKey: Uint8Array): Promise<{
  wallet: TonWallet;
  version: ApiWalletVersion;
  balance: bigint;
}> {
  const allWallets = await getWalletVersionInfos(network, publicKey);

  const withBiggestBalance = allWallets.reduce<typeof allWallets[0] | undefined>((best, current) => {
    return best && best.balance > current.balance ? best : current;
  }, undefined);

  if (!withBiggestBalance || !withBiggestBalance.balance) {
    const version = DEFAULT_WALLET_VERSION;
    const wallet = buildWallet(network, publicKey, version);
    return { wallet, version, balance: 0n };
  }

  return withBiggestBalance;
}

export function getWalletVersionInfos(
  network: ApiNetwork,
  publicKey: Uint8Array,
  versions: ApiWalletVersion[] = ALL_WALLET_VERSIONS,
): Promise<WalletInfo[]> {
  return Promise.all(versions.map(async (version) => {
    const wallet = buildWallet(network, publicKey, version);
    const address = toBase64Address(wallet.address, false, network);
    const walletInfo = await getWalletInfo(network, wallet);

    return {
      wallet,
      address,
      version,
      ...pick(walletInfo, ['isInitialized', 'balance', 'lastTxId']),
    };
  }));
}

export function getWalletVersions(
  network: ApiNetwork,
  publicKey: Uint8Array,
  versions: ApiWalletVersion[] = ALL_WALLET_VERSIONS,
): {
    wallet: TonWallet;
    address: string;
    version: ApiWalletVersion;
  }[] {
  return versions.map((version) => {
    const wallet = buildWallet(network, publicKey, version);
    const address = toBase64Address(wallet.address, false, network);

    return {
      wallet,
      address,
      version,
    };
  });
}

export async function getWalletStateInit(accountId: string) {
  const wallet = await pickAccountWallet(accountId);

  return beginCell()
    .storeWritable(storeStateInit(wallet!.init))
    .endCell();
}

export function pickWalletByAddress(network: ApiNetwork, publicKey: Uint8Array, address: string) {
  address = toBase64Address(address, false, network);

  const allWallets = getWalletVersions(network, publicKey);

  return allWallets.find((w) => w.address === address)!;
}

export async function pickAccountWallet(accountId: string) {
  const { network } = parseAccountId(accountId);

  const { publicKey, version } = await fetchStoredAccount(accountId);

  const publicKeyBytes = hexToBytes(publicKey);

  return buildWallet(network, publicKeyBytes, version);
}

export function resolveWalletVersion(wallet: TonWallet) {
  return Object.entries(walletClassMap)
    .find(([, walletClass]) => wallet instanceof walletClass)?.[0];
}
