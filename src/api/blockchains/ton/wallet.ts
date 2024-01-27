import type { WalletContract } from 'tonweb/dist/types/contract/wallet/wallet-contract';

import type { ApiNetwork, ApiWalletVersion } from '../../types';
import type { ContractInfo, GetAddressInfoResponse } from './types';

import { parseAccountId } from '../../../util/account';
import { compact } from '../../../util/iteratees';
import withCacheAsync from '../../../util/withCacheAsync';
import { stringifyTxId } from './util';
import { getTonWeb, toBase64Address } from './util/tonweb';
import { fetchStoredAccount, fetchStoredAddress } from '../../common/accounts';
import {
  base64ToBytes, bytesToBase64, hexToBytes, sha256,
} from '../../common/utils';
import { KnownContracts } from './constants';

const DEFAULT_WALLET_VERSION: ApiWalletVersion = 'v4R2';

export const isAddressInitialized = withCacheAsync(
  async (network: ApiNetwork, walletOrAddress: WalletContract | string) => {
    return (await getWalletInfo(network, walletOrAddress)).isInitialized;
  },
);

export const isActiveSmartContract = withCacheAsync(async (network: ApiNetwork, address: string) => {
  const { isInitialized, isWallet } = await getWalletInfo(network, address);
  return isInitialized ? !isWallet : undefined;
}, (value) => value !== undefined);

export async function publicKeyToAddress(
  network: ApiNetwork,
  publicKey: Uint8Array,
  walletVersion: ApiWalletVersion = DEFAULT_WALLET_VERSION,
) {
  const wallet = buildWallet(network, publicKey, walletVersion);
  const address = await wallet.getAddress();

  return toBase64Address(address, false);
}

export function buildWallet(network: ApiNetwork, publicKey: Uint8Array, walletVersion: ApiWalletVersion) {
  const tonWeb = getTonWeb(network);
  const WalletClass = tonWeb.wallet.all[walletVersion];
  return new WalletClass(tonWeb.provider, { publicKey, wc: 0 });
}

export async function getWalletInfo(network: ApiNetwork, walletOrAddress: WalletContract | string): Promise<{
  isInitialized: boolean;
  isWallet: boolean;
  seqno: number;
  balance: bigint;
  lastTxId?: string;
}> {
  const address = typeof walletOrAddress === 'string'
    ? walletOrAddress
    : toBase64Address(await walletOrAddress.getAddress());

  const {
    account_state: accountState,
    wallet: isWallet,
    seqno,
    balance,
    last_transaction_id: {
      lt,
      hash,
    },
  } = await getTonWeb(network).provider.getWalletInfo(address);

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
  const data: GetAddressInfoResponse = await getTonWeb(network).provider.getAddressInfo(address);

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

export async function getWalletBalance(network: ApiNetwork, walletOrAddress: WalletContract | string): Promise<bigint> {
  return (await getWalletInfo(network, walletOrAddress)).balance;
}

export async function getWalletSeqno(network: ApiNetwork, walletOrAddress: WalletContract | string): Promise<number> {
  const { seqno } = await getWalletInfo(network, walletOrAddress);
  return seqno || 0;
}

export async function pickBestWallet(network: ApiNetwork, publicKey: Uint8Array) {
  const tonWeb = getTonWeb(network);
  const walletClasses = Object.values(tonWeb.wallet.all);
  const allWallets = await Promise.all(walletClasses.map(async (WalletClass) => {
    const wallet = new WalletClass(tonWeb.provider, { publicKey, wc: 0 });
    const balance = await getWalletBalance(network, wallet);
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
  const { stateInit } = await wallet!.createStateInit();
  return bytesToBase64(await stateInit.toBoc());
}

export async function pickWalletByAddress(network: ApiNetwork, publicKey: Uint8Array, address: string) {
  address = toBase64Address(address, false);

  const tonWeb = getTonWeb(network);
  const walletClasses = tonWeb.wallet.list;
  const allWallets = await Promise.all(walletClasses.map(async (WalletClass) => {
    const wallet = new WalletClass(tonWeb.provider, { publicKey, wc: 0 });
    const walletAddress = toBase64Address(await wallet.getAddress(), false);

    return {
      wallet,
      address: walletAddress,
    };
  }));

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

export function resolveWalletVersion(wallet: WalletContract) {
  const tonWeb = getTonWeb(); // The network doesn't matter
  return Object.keys(tonWeb.wallet.all)
    .find((version) => wallet instanceof tonWeb.wallet.all[version as keyof typeof tonWeb.wallet.all]);
}
