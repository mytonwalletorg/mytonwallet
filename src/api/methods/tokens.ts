import { pause } from '../../util/schedulers';
import { ApiToken, OnApiUpdate } from '../types';
import { BRILLIANT_API_BASE_URL, DEBUG } from '../../config';
import { checkAccountIsAuthorized, resolveBlockchainKey, isUpdaterAlive } from './helpers';
import { Storage } from '../storages/types';
import blockchains from '../blockchains';
import { buildCollectionByKey } from '../../util/iteratees';
import { cloneDeep } from '../blockchains/ton/util';

const POLLING_INTERVAL = 30000;

let onUpdate: OnApiUpdate;
let storage: Storage;

export function initTokens(_onUpdate: OnApiUpdate, _storage: Storage) {
  onUpdate = _onUpdate;
  storage = _storage;
}

export async function setupTokensPolling(accountId: string) {
  const blockchain = blockchains[resolveBlockchainKey(accountId)!];

  // TODO Wait for `setupBalancePolling` to be executed once
  await blockchain.getAccountTokenBalances(storage, accountId);

  while (isUpdaterAlive(onUpdate) && await checkAccountIsAuthorized(storage, accountId)) {
    try {
      const tokens = blockchain.getKnownTokens();

      if (tokens && Object.keys(tokens).length > 0) {
        const data = await fetch(`${BRILLIANT_API_BASE_URL}/prices`);
        if (data.ok) {
          const prices = (await data.json()) as Record<string, ApiToken>;
          const pricesBySymbol = buildCollectionByKey(Object.values(prices), 'symbol');
          Object.values(tokens).forEach((token) => {
            if (pricesBySymbol[token.symbol]) {
              token.quote = pricesBySymbol[token.symbol].quote;
            }
          });
        }

        onUpdate({
          type: 'updateTokens',
          tokens: cloneDeep(tokens),
        });
      }
    } catch (err) {
      if (DEBUG) {
        // eslint-disable-next-line no-console
        console.error('Error fetching tokens', err);
      }
    }

    await pause(POLLING_INTERVAL);
  }
}
