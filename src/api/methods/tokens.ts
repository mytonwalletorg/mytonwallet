import { pause } from '../../util/schedulers';
import { ApiToken, OnApiUpdate } from '../types';
import { BRILLIANT_API_BASE_URL, DEBUG } from '../../config';
import { handleFetchErrors } from '../common/utils';
import { checkAccountIsAuthorized } from './helpers';
import { Storage } from '../storages/types';

const POLLING_INTERVAL = 30000;

let onUpdate: OnApiUpdate;
let storage: Storage;

export function initTokens(_onUpdate: OnApiUpdate, _storage: Storage) {
  onUpdate = _onUpdate;
  storage = _storage;
}

export async function setupTokensPolling() {
  while (await checkAccountIsAuthorized(storage)) {
    try {
      const data = await fetch(`${BRILLIANT_API_BASE_URL}/tokens`);
      handleFetchErrors(data);

      const tokensRaw = await data.json();
      if (tokensRaw && Object.keys(tokensRaw).length > 0) {
        const tokens = Object.keys(tokensRaw).reduce((acc, key) => {
          acc[tokensRaw[key].slug] = tokensRaw[key];

          return acc;
        }, {} as Record<string, ApiToken>);

        onUpdate({
          type: 'updateTokens',
          tokens,
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
