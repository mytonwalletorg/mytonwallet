import { beginCell, Cell, storeStateInit } from '@ton/core';

import type { ApiNetwork, ApiTonWallet, ApiWalletInfo } from '../../types';
import type { ApiTonWalletVersion, ContractInfo } from './types';
import type { TonWallet } from './util/tonCore';

import { DEFAULT_WALLET_VERSION } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { extractKey, findLast } from '../../../util/iteratees';
import withCacheAsync from '../../../util/withCacheAsync';
import { stringifyTxId } from './util';
import { getWalletInfos } from './util/apiV3';
import { fetchJettonBalances } from './util/tonapiio';
import {
  getTonClient, toBase64Address, walletClassMap,
} from './util/tonCore';
import { fetchStoredTonWallet } from '../../common/accounts';
import { base64ToBytes, hexToBytes, sha256 } from '../../common/utils';
import { ALL_WALLET_VERSIONS, KnownContracts, WORKCHAIN } from './constants';

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
  walletVersion: ApiTonWalletVersion,
) {
  const wallet = buildWallet(network, publicKey, walletVersion);
  return toBase64Address(wallet.address, false, network);
}

export function buildWallet(
  network: ApiNetwork,
  publicKey: Uint8Array | string,
  walletVersion: ApiTonWalletVersion,
): TonWallet {
  if (typeof publicKey === 'string') {
    publicKey = hexToBytes(publicKey);
  }
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
  isSwapAllowed?: boolean;
  isWallet?: boolean;
  contractInfo?: ContractInfo;
  codeHash?: string;
}> {
  const data = await getTonClient(network).getAddressInfo(address);

  const { code, state } = data;

  const codeHashOld = Buffer.from(await sha256(base64ToBytes(code))).toString('hex');
  const contractInfo = Object.values(KnownContracts).find((info) => info.hash === codeHashOld);
  // For inactive addresses, `code` is an empty string. Cell.fromBase64 throws when `code` is an empty string.
  const codeHash = code && Cell.fromBase64(code).hash().toString('hex');

  const isInitialized = state === 'active';
  const isWallet = state === 'active' ? contractInfo?.type === 'wallet' : undefined;
  const isSwapAllowed = contractInfo?.isSwapAllowed;

  return {
    isInitialized,
    isWallet,
    isSwapAllowed,
    contractInfo,
    codeHash,
  };
}

export async function getAccountBalance(accountId: string) {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);

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
  version: ApiTonWalletVersion;
  balance: bigint;
  lastTxId?: string;
}> {
  const allWallets = await getWalletVersionInfos(network, publicKey);
  const defaultWallet = allWallets.filter(({ version }) => version === DEFAULT_WALLET_VERSION)[0];

  if (defaultWallet.lastTxId) {
    return defaultWallet;
  }

  const withBiggestBalance = allWallets.reduce<typeof allWallets[0] | undefined>((best, current) => {
    return current.balance > (best?.balance ?? 0n) ? current : best;
  }, undefined);

  if (withBiggestBalance) {
    return withBiggestBalance;
  }

  const withLastTx = findLast(allWallets, ({ lastTxId }) => !!lastTxId);

  if (withLastTx) {
    return withLastTx;
  }

  // Workaround for NOT holders who do not have transactions
  const v4Wallet = allWallets.find(({ version }) => version === 'v4R2')!;
  const v4JettonBalances = await fetchJettonBalances(network, v4Wallet.address);
  if (v4JettonBalances.length > 0) {
    return v4Wallet;
  }

  return defaultWallet;
}

export async function getWalletVersionInfos(
  network: ApiNetwork,
  publicKey: Uint8Array,
  versions: ApiTonWalletVersion[] = ALL_WALLET_VERSIONS,
): Promise<(ApiWalletInfo & { wallet: TonWallet })[]> {
  const items = versions.map((version) => {
    const wallet = buildWallet(network, publicKey, version);
    const address = toBase64Address(wallet.address, false, network);
    return { wallet, address, version };
  });

  const walletInfos = await getWalletInfos(network, extractKey(items, 'address'));

  return items.map((item) => {
    return {
      ...walletInfos[item.address] ?? {
        balance: 0n,
        isInitialized: false,
      },
      ...item,
    };
  });
}

export function getWalletVersions(
  network: ApiNetwork,
  publicKey: Uint8Array,
  versions: ApiTonWalletVersion[] = ALL_WALLET_VERSIONS,
): {
    wallet: TonWallet;
    address: string;
    version: ApiTonWalletVersion;
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

export async function getWalletStateInit(accountId: string, storedWallet: ApiTonWallet) {
  const wallet = await getTonWallet(accountId, storedWallet);

  return beginCell()
    .storeWritable(storeStateInit(wallet!.init))
    .endCell();
}

export function pickWalletByAddress(network: ApiNetwork, publicKey: Uint8Array, address: string) {
  address = toBase64Address(address, false, network);

  const allWallets = getWalletVersions(network, publicKey);

  return allWallets.find((w) => w.address === address)!;
}

export async function getTonWallet(accountId: string, tonWallet?: ApiTonWallet) {
  const { network } = parseAccountId(accountId);
  const { publicKey, version } = tonWallet ?? await fetchStoredTonWallet(accountId);

  const publicKeyBytes = hexToBytes(publicKey);
  return buildWallet(network, publicKeyBytes, version);
}

export function resolveWalletVersion(wallet: TonWallet) {
  return Object.entries(walletClassMap)
    .find(([, walletClass]) => wallet instanceof walletClass)?.[0];
}
