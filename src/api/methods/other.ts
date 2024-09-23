import nacl from 'tweetnacl';

import type { AccountCache } from '../common/cache';
import type { ApiChain, ApiNetwork } from '../types';

import { setIsAppFocused } from '../../util/pauseOrFocus';
import chains from '../chains';
import { fetchStoredAccounts, fetchStoredTonWallet, updateStoredAccount } from '../common/accounts';
import { updateAccountCache } from '../common/cache';
import { storage } from '../storages';

const SIGN_MESSAGE = Buffer.from('MyTonWallet_AuthToken_n6i0k4w8pb');

export function checkApiAvailability(chain: ApiChain, network: ApiNetwork) {
  return chains[chain].checkApiAvailability(network);
}

export async function getBackendAuthToken(accountId: string, password: string) {
  const accountWallet = await fetchStoredTonWallet(accountId);
  let { authToken } = accountWallet;
  const { publicKey, isInitialized } = accountWallet;

  if (!authToken) {
    const privateKey = await chains.ton.fetchPrivateKey(accountId, password);
    const signature = nacl.sign.detached(SIGN_MESSAGE, privateKey!);
    authToken = Buffer.from(signature).toString('base64');

    await updateStoredAccount(accountId, {
      ton: {
        ...accountWallet,
        authToken,
      },
    });
  }

  if (!isInitialized) {
    authToken += `:${publicKey}`;
  }

  return authToken;
}

export async function fetchAccountConfigForDebugPurposesOnly() {
  try {
    const [accounts, stateVersion] = await Promise.all([
      fetchStoredAccounts(),
      storage.getItem('stateVersion'),
    ]);

    return JSON.stringify({ accounts, stateVersion });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);

    return undefined;
  }
}

export function ping() {
  return true;
}

export function updateAccountMemoryCache(accountId: string, address: string, partial: Partial<AccountCache>) {
  updateAccountCache(accountId, address, partial);
}

export { setIsAppFocused };
