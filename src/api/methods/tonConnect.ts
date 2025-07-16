import type { ApiTonConnectProof } from '../tonConnect/types';

import { parseAccountId } from '../../util/account';
import { fetchPrivateKey } from '../chains/ton';
import { getSigner } from '../chains/ton/util/signer';
import { fetchStoredTonAccount } from '../common/accounts';

export { startSseConnection } from '../tonConnect/sse';

export async function signTonProof(accountId: string, proof: ApiTonConnectProof, password: string) {
  const { network } = parseAccountId(accountId);
  const account = await fetchStoredTonAccount(accountId);
  const privateKey = 'mnemonicEncrypted' in account
    ? await fetchPrivateKey(accountId, password, account)
    : undefined;

  const signer = getSigner(network, account, privateKey);
  const signature = await signer.signTonProof(proof);
  return signature.toString('base64');
}
