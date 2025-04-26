import type { ApiNetwork, ApiTokenWithPrice, OnApiUpdate } from '../../types';

import { buildCollectionByKey } from '../../../util/iteratees';
import { logDebugError } from '../../../util/logs';
import { updateTokens } from '../../common/tokens';
import { getAccountStates } from './toncenter';

export async function updateTokenHashes(network: ApiNetwork, tokens: ApiTokenWithPrice[], onUpdate?: OnApiUpdate) {
  const tokensToFetch = tokens.filter((token) => (
    token.chain === 'ton'
    && !token.codeHash
    && ['LP', 'STAKED', 'POOL'].some((option) => token.symbol.toUpperCase().includes(option))
  ));

  if (!tokensToFetch.length) {
    return;
  }

  const tokensByAddress = buildCollectionByKey(tokensToFetch, 'tokenAddress');

  try {
    const states = await getAccountStates(network, tokensToFetch.map((token) => token.tokenAddress!));

    for (const address of Object.keys(states)) {
      if (!tokensByAddress[address]) continue;
      tokensByAddress[address].codeHash = Buffer.from(states[address].code_hash, 'base64').toString('hex');
    }

    await updateTokens(Object.values(tokensByAddress).filter((token) => token.codeHash), onUpdate);
  } catch (err) {
    logDebugError('Failed to fetch contract code hashes for tokens', err);
  }
}
