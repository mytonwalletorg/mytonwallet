import nacl from 'tweetnacl';

import type { ApiBlockchainKey, ApiNetwork } from '../types';

import { parseAccountId } from '../../util/account';
import blockchains from '../blockchains';
import { fetchStoredAccount, updateStoredAccount } from '../common/accounts';

const SIGN_MESSAGE = Buffer.from('MyTonWallet_AuthToken_n6i0k4w8pb');

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
