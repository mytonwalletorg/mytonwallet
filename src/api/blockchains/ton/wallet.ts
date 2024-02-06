import { beginCell, storeStateInit } from '@ton/core';

import type { ApiNetwork, ApiWalletVersion } from '../../types';
import type { ContractInfo } from './types';
import type { TonWallet } from './util/tonCore';
import { WORKCHAIN } from '../../types';

import { parseAccountId } from '../../../util/account';
import { compact } from '../../../util/iteratees';
import withCacheAsync from '../../../util/withCacheAsync';
import { stringifyTxId } from './util';
import { getTonClient, toBase64Address, walletClassMap } from './util/tonCore';
import { fetchStoredAccount, fetchStoredAddress } from '../../common/accounts';
import { base64ToBytes, hexToBytes, sha256 } from '../../common/utils';
import { KnownContracts } from './constants';

const DEFAULT_WALLET_VERSION: ApiWalletVersion = 'v4R2';

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
  walletVersion: ApiWalletVersion = DEFAULT_WALLET_VERSION,
) {
  const wallet = buildWallet(network, publicKey, walletVersion);
  return toBase64Address(wallet.address, false);
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
    : toBase64Address(walletOrAddress.address);

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
  isWallet?: boolean;
  contractInfo?: ContractInfo;
}> {
  const data = await getTonClient(network).getAddressInfo(address);

  const { code, state } = data;

  const codeHash = Buffer.from(await sha256(base64ToBytes(code))).toString('hex');
  const contractInfo = Object.values(KnownContracts).find((info) => info.hash === codeHash);

  const isInitialized = state === 'active';
  const isWallet = state === 'active' ? contractInfo?.type === 'wallet' : undefined;
  const isLedgerAllowed = !isInitialized || isWallet || contractInfo?.name === 'nominatorPool';

  return {
    isInitialized,
    isWallet,
    isLedgerAllowed,
    contractInfo,
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

export async function pickBestWallet(network: ApiNetwork, publicKey: Uint8Array) {
  const walletClasses = Object.values(walletClassMap);
  const allWallets = await Promise.all(walletClasses.map(async (WalletClass) => {
    const wallet = WalletClass.create({ publicKey: Buffer.from(publicKey), workchain: WORKCHAIN });
    const balance = await getTonClient(network).getBalance(wallet.address);
    if (balance === 0n) {
      return undefined;
    }

    return {
      wallet,
      balance: BigInt(balance),
    };
  }));
  const walletsWithBalances = compact(allWallets);
  const withBiggestBalance = walletsWithBalances.reduce<typeof walletsWithBalances[0] | undefined>((best, current) => {
    return best && best?.balance > current.balance ? best : current;
  }, undefined);

  return withBiggestBalance?.wallet || buildWallet(network, publicKey, DEFAULT_WALLET_VERSION);
}

export async function getWalletStateInit(accountId: string) {
  const wallet = await pickAccountWallet(accountId);

  return beginCell()
    .storeWritable(storeStateInit(wallet!.init))
    .endCell();
}

export function pickWalletByAddress(network: ApiNetwork, publicKey: Uint8Array, address: string) {
  address = toBase64Address(address, false);

  const client = getTonClient(network);

  const walletClasses = Object.values(walletClassMap);
  const allWallets = walletClasses.map((WalletClass) => {
    const wallet = WalletClass.create({ publicKey: Buffer.from(publicKey), workchain: WORKCHAIN });
    return {
      wallet: client.open(wallet),
      address: toBase64Address(wallet.address, false),
    };
  });

  return allWallets.find((w) => w.address === address)?.wallet;
}

// TODO Cache
export async function pickAccountWallet(accountId: string) {
  const { network } = parseAccountId(accountId);

  const { address, publicKey, version } = await fetchStoredAccount(accountId);

  const publicKeyBytes = hexToBytes(publicKey);

  if (version) {
    return buildWallet(network, publicKeyBytes, version);
  }

  return pickWalletByAddress(network, publicKeyBytes, address);
}

export function resolveWalletVersion(wallet: TonWallet) {
  return Object.entries(walletClassMap)
    .find(([, walletClass]) => wallet instanceof walletClass)?.[0];
}
