import * as tonWebMnemonic from 'tonweb-mnemonic';

import type { ApiDappRequestConfirmation } from '../tonConnect/types';
import type { ApiAccountWithMnemonic, ApiChain, ApiNetwork, ApiSignedTransfer } from '../types';

import { parseAccountId } from '../../util/account';
import chains from '../chains';
import { fetchPrivateKey as fetchTonPrivateKey } from '../chains/ton';
import { checkToAddress } from '../chains/ton/transfer';
import {
  fetchStoredAccount,
  fetchStoredAddress,
  fetchStoredTonWallet,
  getAccountWithMnemonic,
} from '../common/accounts';
import * as dappPromises from '../common/dappPromises';
import { getMnemonic } from '../common/mnemonic';
import { handleServerError } from '../errors';

const ton = chains.ton;

export async function fetchPrivateKey(accountId: string, password: string) {
  const account = await fetchStoredAccount<ApiAccountWithMnemonic>(accountId);
  const privateKey = await fetchTonPrivateKey(accountId, password, account);

  return Buffer.from(privateKey!).toString('hex');
}

export async function fetchMnemonic(accountId: string, password: string) {
  const account = await fetchStoredAccount<ApiAccountWithMnemonic>(accountId);
  return getMnemonic(accountId, password, account);
}

export function getMnemonicWordList() {
  return tonWebMnemonic.wordlists.default;
}

export async function verifyPassword(password: string) {
  const [accountId, account] = (await getAccountWithMnemonic()) ?? [];
  if (!accountId || !account) {
    throw new Error('The user is not authorized in the wallet');
  }

  return Boolean(await getMnemonic(accountId, password, account));
}

export function confirmDappRequest(promiseId: string, data: string | ApiSignedTransfer[]) {
  dappPromises.resolveDappPromise(promiseId, data);
}

export function confirmDappRequestConnect(promiseId: string, data: ApiDappRequestConfirmation) {
  dappPromises.resolveDappPromise(promiseId, data);
}

export function cancelDappRequest(promiseId: string, reason?: string) {
  dappPromises.rejectDappPromise(promiseId, reason);
}

export async function getWalletSeqno(accountId: string, address?: string) {
  const { network } = parseAccountId(accountId);
  if (!address) {
    ({ address } = await fetchStoredTonWallet(accountId));
  }
  return ton.getWalletSeqno(network, address);
}

export function fetchAddress(accountId: string, chain: ApiChain) {
  return fetchStoredAddress(accountId, chain);
}

export function isWalletInitialized(network: ApiNetwork, address: string) {
  const chain = chains.ton;

  return chain.isAddressInitialized(network, address);
}

export function getWalletBalance(chain: ApiChain, network: ApiNetwork, address: string) {
  return chains[chain].getWalletBalance(network, address);
}

export function getContractInfo(network: ApiNetwork, address: string) {
  const chain = chains.ton;

  return chain.getContractInfo(network, address);
}

export function getWalletInfo(network: ApiNetwork, address: string) {
  const chain = chains.ton;

  return chain.getWalletInfo(network, address);
}

export async function getAddressInfo(network: ApiNetwork, toAddress: string): Promise<{
  addressName?: string;
  isScam?: boolean;
  resolvedAddress?: string;
  isToAddressNew?: boolean;
  isBounceable?: boolean;
  isMemoRequired?: boolean;
} | { error: string }> {
  try {
    return await checkToAddress(network, toAddress);
  } catch (err: any) {
    return handleServerError(err);
  }
}

export async function getWalletStateInit(accountId: string) {
  const account = await fetchStoredAccount(accountId);
  return ton.getWalletStateInit(account.ton!)
    .toBoc({ idx: true, crc32: true })
    .toString('base64');
}
