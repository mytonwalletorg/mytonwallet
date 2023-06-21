import type { WalletContract } from 'tonweb/dist/types/contract/wallet/wallet-contract';

import type { Storage } from '../../storages/types';
import type { ApiNetwork, ApiWalletVersion } from '../../types';

import { parseAccountId } from '../../../util/account';
import { compact } from '../../../util/iteratees';
import { getTonWeb, toBase64Address } from './util/tonweb';
import { fetchStoredAccount, fetchStoredAddress, fetchStoredPublicKey } from '../../common/accounts';
import { bytesToBase64, hexToBytes } from '../../common/utils';

const DEFAULT_WALLET_VERSION: ApiWalletVersion = 'v4R2';

export async function publicKeyToAddress(
  network: ApiNetwork,
  publicKey: Uint8Array,
  walletVersion: ApiWalletVersion = DEFAULT_WALLET_VERSION,
) {
  const wallet = buildWallet(network, publicKey, walletVersion);
  const address = await wallet.getAddress();

  return address.toString(true, true, true);
}

export function buildWallet(network: ApiNetwork, publicKey: Uint8Array, walletVersion: ApiWalletVersion) {
  const tonWeb = getTonWeb(network);
  const WalletClass = tonWeb.wallet.all[walletVersion];
  return new WalletClass(tonWeb.provider, { publicKey, wc: 0 });
}

export async function getWalletInfo(network: ApiNetwork, walletOrAddress: WalletContract | string): Promise<{
  isInitialized: boolean;
  seqno: number;
  balance: string;
}> {
  const address = typeof walletOrAddress === 'string'
    ? walletOrAddress
    : (await walletOrAddress.getAddress()).toString(true, true, true);

  const {
    account_state: accountState,
    seqno,
    balance = '0',
  } = await getTonWeb(network).provider.getWalletInfo(address);
  const isInitialized = accountState === 'active';

  return {
    isInitialized,
    seqno,
    balance,
  };
}

export async function getAccountBalance(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  const address = await fetchStoredAddress(storage, accountId);

  return getWalletBalance(network, address);
}

export async function getWalletBalance(
  network: ApiNetwork, walletOrAddress: WalletContract | string,
): Promise<string> {
  const { balance } = await getWalletInfo(network, walletOrAddress);

  return balance || '0';
}

export async function getWalletSeqno(network: ApiNetwork, walletOrAddress: WalletContract | string): Promise<number> {
  const { seqno } = await getWalletInfo(network, walletOrAddress);
  return seqno || 0;
}

export async function isWalletInitialized(network: ApiNetwork, walletOrAddress: WalletContract | string) {
  return (await getWalletInfo(network, walletOrAddress)).isInitialized;
}

export async function pickBestWallet(network: ApiNetwork, publicKey: Uint8Array) {
  const tonWeb = getTonWeb(network);
  const walletClasses = Object.values(tonWeb.wallet.all);
  const allWallets = await Promise.all(walletClasses.map(async (WalletClass) => {
    const wallet = new WalletClass(tonWeb.provider, { publicKey, wc: 0 });
    const balance = await getWalletBalance(network, wallet);
    if (balance === '0') {
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

export async function getWalletStateInit(storage: Storage, accountId: string) {
  const wallet = await pickAccountWallet(storage, accountId);
  const { stateInit } = await wallet!.createStateInit();
  return bytesToBase64(await stateInit.toBoc());
}

export async function pickWalletByAddress(network: ApiNetwork, publicKey: Uint8Array, address: string) {
  address = toBase64Address(address);

  const tonWeb = getTonWeb(network);
  const walletClasses = tonWeb.wallet.list;
  const allWallets = await Promise.all(walletClasses.map(async (WalletClass) => {
    const wallet = new WalletClass(tonWeb.provider, { publicKey, wc: 0 });
    const walletAddress = (await wallet.getAddress()).toString(true, true, true);

    return {
      wallet,
      address: walletAddress,
    };
  }));

  return allWallets.find((w) => w.address === address)?.wallet;
}

// TODO Cache
export async function pickAccountWallet(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);

  const [publicKeyHex, address, account] = await Promise.all([
    fetchStoredPublicKey(storage, accountId),
    fetchStoredAddress(storage, accountId),
    fetchStoredAccount(storage, accountId),
  ]);

  const publicKey = hexToBytes(publicKeyHex);

  if (account?.version) {
    return buildWallet(network, publicKey, account.version);
  }

  return pickWalletByAddress(network, publicKey, address);
}

export function resolveWalletVersion(wallet: WalletContract) {
  const tonWeb = getTonWeb(); // The network doesn't matter
  return Object.keys(tonWeb.wallet.all)
    .find((version) => wallet instanceof tonWeb.wallet.all[version as keyof typeof tonWeb.wallet.all]);
}
