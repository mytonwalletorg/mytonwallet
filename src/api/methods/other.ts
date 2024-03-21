import nacl, { randomBytes } from 'tweetnacl';

import type { ApiBlockchainKey, ApiNetwork } from '../types';

import { parseAccountId } from '../../util/account';
import { setIsAppFocused } from '../../util/pauseOrFocus';
import blockchains from '../blockchains';
import { fetchStoredAccount, fetchStoredAccounts, updateStoredAccount } from '../common/accounts';
import { storage } from '../storages';

const SIGN_MESSAGE = Buffer.from('MyTonWallet_AuthToken_n6i0k4w8pb');
let clientId: string | undefined;

export function checkApiAvailability(options: {
  accountId: string;
} | {
  network: ApiNetwork;
  blockchainKey: ApiBlockchainKey;
}) {
  let network: ApiNetwork;
  let blockchainKey: ApiBlockchainKey;
  if ('network' in options) {
    ({ network, blockchainKey } = options);
  } else {
    ({ network, blockchain: blockchainKey } = parseAccountId(options.accountId));
  }

  const blockchain = blockchains[blockchainKey];

  return blockchain.checkApiAvailability(network);
}

export async function getBackendAuthToken(accountId: string, password: string) {
  const account = await fetchStoredAccount(accountId);
  let authToken = account.authToken;

  if (!authToken) {
    const privateKey = await blockchains.ton.fetchPrivateKey(accountId, password);
    const signature = nacl.sign.detached(SIGN_MESSAGE, privateKey!);
    authToken = Buffer.from(signature).toString('base64');

    await updateStoredAccount(accountId, { authToken });
  }

  if (!account.isInitialized) {
    authToken += `:${account.publicKey}`;
  }

  return authToken;
}

export async function getClientId() {
  clientId = await storage.getItem('clientId');
  if (!clientId) {
    clientId = Buffer.from(randomBytes(10)).toString('hex');
    await storage.setItem('clientId', clientId);
  }
  return clientId;
}

export async function fetchAccountConfigForDebugPurposesOnly() {
  try {
    const [accounts, mnemonicsEncrypted] = await Promise.all([
      fetchStoredAccounts(),
      storage.getItem('mnemonicsEncrypted'),
    ]);

    return JSON.stringify({ accounts, mnemonicsEncrypted });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);

    return undefined;
  }
}

export function ping() {
  return true;
}

export { setIsAppFocused };
