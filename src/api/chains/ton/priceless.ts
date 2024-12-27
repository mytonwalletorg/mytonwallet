import type { ApiNetwork, ApiToken, OnApiUpdate } from '../../types';

import { buildCollectionByKey } from '../../../util/iteratees';
import { logDebugError } from '../../../util/logs';
import { getAccountStates } from './util/apiV3';
import { addTokens } from '../../common/tokens';

export async function updateTokenHashes(network: ApiNetwork, tokens: ApiToken[], onUpdate?: OnApiUpdate) {
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

    await addTokens(Object.values(tokensByAddress).filter((token) => token.codeHash), onUpdate, true);
  } catch (err) {
    logDebugError('Failed to fetch contract code hashes for tokens', err);
  }
}
