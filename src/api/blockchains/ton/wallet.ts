import TonWeb from 'tonweb';
import { WalletContract } from 'tonweb/dist/types/contract/wallet/wallet-contract';
import { compact } from '../../../util/iteratees';
import { Storage } from '../../storages/types';
import { hexToBytes } from '../../common/utils';
import { getTonWeb } from './util/tonweb';
import { fetchPublicKey } from './auth';
import { fetchAddress } from './address';
import { ApiNetwork } from '../../types';
import { parseAccountId } from '../../../util/account';

const DEFAULT_WALLET_VERSION = 'v3R2';

export async function publicKeyToAddress(
  network: ApiNetwork,
  publicKey: Uint8Array,
  walletVersion: keyof typeof TonWeb.Wallets['all'] = DEFAULT_WALLET_VERSION,
) {
  const wallet = buildWallet(network, publicKey, walletVersion);
  const address = await wallet.getAddress();

  return address.toString(true, true, true);
}

export function buildWallet(
  network: ApiNetwork,
  publicKey: Uint8Array,
  walletVersion: keyof typeof TonWeb.Wallets['all'],
) {
  const tonWeb = getTonWeb(network);
  const WalletClass = tonWeb.wallet.all[walletVersion];
  return new WalletClass(tonWeb.provider, { publicKey, wc: 0 });
}

export async function getWalletInfo(network: ApiNetwork, walletOrAddress: WalletContract | string) {
  const address = typeof walletOrAddress === 'string'
    ? walletOrAddress
    : (await walletOrAddress.getAddress()).toString(true, true, true);

  return getTonWeb(network).provider.getWalletInfo(address);
}

export async function getAccountBalance(storage: Storage, accountId: string) {
  const { network } = parseAccountId(accountId);
  const wallet = await pickAccountWallet(storage, accountId);
  if (!wallet) {
    return undefined;
  }

  return getWalletBalance(network, wallet);
}

export async function getWalletBalance(
  network: ApiNetwork, walletOrAddress: WalletContract | string,
): Promise<string> {
  const { balance } = await getWalletInfo(network, walletOrAddress);

  return balance || '0';
}

export async function isWalletInitialized(network: ApiNetwork, walletOrAddress: WalletContract | string) {
  const { account_state: accountState } = await getWalletInfo(network, walletOrAddress);
  return accountState === 'active';
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

export async function pickWalletByAddress(network: ApiNetwork, publicKey: Uint8Array, address: string) {
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
  const [publicKeyHex, address] = await Promise.all([
    fetchPublicKey(storage, accountId),
    fetchAddress(storage, accountId),
  ]);
  const publicKey = hexToBytes(publicKeyHex);

  return pickWalletByAddress(network, publicKey, address);
}

export function resolveWalletVersion(wallet: WalletContract) {
  const tonWeb = getTonWeb(); // The network doesn't matter
  return Object.keys(tonWeb.wallet.all)
    .find((version) => wallet instanceof tonWeb.wallet.all[version as keyof typeof tonWeb.wallet.all]);
}
