import {
  Configuration,
  EventApi,
  JettonApi,
  RawBlockchainApi,
} from 'tonapi-sdk-js';
import { DEBUG } from '../../../../config';
import { ApiNetwork } from '../../../types';

const TONAPIIO_MAINNET_URL = process.env.TONAPIIO_MAINNET_URL || 'https://tonapi.io';
const TONAPIIO_TESTNET_URL = process.env.TONAPIIO_TESTNET_URL || 'https://testnet.tonapi.io';

const configurationMainnet = new Configuration({
  basePath: TONAPIIO_MAINNET_URL,
});
const configurationTestnet = new Configuration({
  basePath: TONAPIIO_TESTNET_URL,
});

export const tonapiioByNetwork = {
  mainnet: {
    configuration: configurationMainnet,
    eventApi: new EventApi(configurationMainnet),
    jettonApi: new JettonApi(configurationMainnet),
    blockchainApi: new RawBlockchainApi(configurationMainnet),
  },
  testnet: {
    configuration: configurationTestnet,
    eventApi: new EventApi(configurationTestnet),
    jettonApi: new JettonApi(configurationTestnet),
    blockchainApi: new RawBlockchainApi(configurationTestnet),
  },
};

export function fetchJettonBalances(network: ApiNetwork, account: string) {
  const api = tonapiioByNetwork[network].jettonApi;
  return tonapiioErrorHandler(async () => {
    return (await api.getJettonsBalances({ account } as any)).balances;
  }, []);
}

export function fetchAccountEvents(network: ApiNetwork, account: string, limit: number, beforeLt?: number) {
  const api = tonapiioByNetwork[network].eventApi;
  return tonapiioErrorHandler(async () => {
    return (await api.accountEvents({ account, limit, beforeLt })).events;
  }, []);
}

export function fetchAccountTransactions(
  network: ApiNetwork, account: string, limit: number, minLt?: number, maxLt?: number,
) {
  const api = tonapiioByNetwork[network].blockchainApi;
  return tonapiioErrorHandler(async () => {
    return (await api.getTransactions({
      account,
      limit,
      maxLt,
      minLt,
    })).transactions;
  }, []);
}

async function tonapiioErrorHandler<T>(fn: () => Promise<T>, defaultValue: T): Promise<T> {
  try {
    return (await fn()) || defaultValue;
  } catch (err) {
    // TODO Remove when exception is fixed in tonapiio
    if (err instanceof TypeError && (
      err.message === "Cannot read properties of null (reading 'map')" // Chrome
      || err.message.includes('null is not an object') // Safari
      || err.message.includes('t.transactions is null') // Firefox
    )) {
      return defaultValue;
    } else if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[tonapiioErrorHandler]', err);
    }
    return defaultValue;
  }
}
