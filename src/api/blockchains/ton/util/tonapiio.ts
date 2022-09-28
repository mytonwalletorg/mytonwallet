import {
  Configuration,
  EventApi,
  JettonApi,
  RawBlockchainApi,
} from 'tonapi-sdk-js';
import { DEBUG, IS_TESTNET } from '../../../../config';

const TONAPIIO_MAINNET_URL = process.env.TONAPIIO_MAINNET_URL || 'https://tonapi.io';
const TONAPIIO_TESTNET_URL = process.env.TONAPIIO_TESTNET_URL || 'https://testnet.tonapi.io';

export const apiConfiguration = new Configuration({
  basePath: IS_TESTNET ? TONAPIIO_TESTNET_URL : TONAPIIO_MAINNET_URL,
});

export const eventApi = new EventApi(apiConfiguration);
export const jettonApi = new JettonApi(apiConfiguration);
export const blockchainApi = new RawBlockchainApi(apiConfiguration);

export function fetchJettonBalances(account: string) {
  return tonapiioErrorHandler(async () => {
    return (await jettonApi.getJettonsBalances({ account } as any)).balances;
  }, []);
}

export function fetchAccountEvents(account: string, limit: number, beforeLt?: number) {
  return tonapiioErrorHandler(async () => {
    return (await eventApi.accountEvents({ account, limit, beforeLt })).events;
  }, []);
}

export function fetchAccountTransactions(account: string, limit: number, minLt?: number, maxLt?: number) {
  return tonapiioErrorHandler(async () => {
    return (await blockchainApi.getTransactions({
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
    if (err instanceof TypeError && err.message === "Cannot read properties of null (reading 'map')") {
      return defaultValue;
    } else if (DEBUG) {
      // eslint-disable-next-line no-console
      console.error('[tonapiioErrorHandler]', err);
    }
    return defaultValue;
  }
}
