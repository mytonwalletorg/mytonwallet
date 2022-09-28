// eslint-disable-next-line max-classes-per-file
import { HttpProvider } from 'tonweb/dist/types/providers/http-provider';
import { Address } from 'tonweb/dist/types/utils/address';
import TonWeb from 'tonweb';
import { IS_TESTNET } from '../../../../config';

const TONHTTPAPI_MAINNET_URL = process.env.TONHTTPAPI_MAINNET_URL || 'https://toncenter.com/api/v2/jsonRPC';
const TONHTTPAPI_TESTNET_URL = process.env.TONHTTPAPI_TESTNET_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC';

export declare class Dns {
  readonly provider: HttpProvider;

  constructor(provider: HttpProvider);
  getWalletAddress(domain: string): Promise<Address | null>;
}

export declare class MyTonWeb extends TonWeb {
  dns: Dns;
}

let tonWebCache: MyTonWeb;

export function getTonWeb() {
  if (!tonWebCache) {
    tonWebCache = new TonWeb(new TonWeb.HttpProvider(
      IS_TESTNET ? TONHTTPAPI_TESTNET_URL : TONHTTPAPI_MAINNET_URL,
    )) as MyTonWeb;
  }

  return tonWebCache;
}

export function oneCellFromBoc(boc: Uint8Array) {
  return TonWeb.boc.Cell.oneFromBoc(boc);
}

export function toBase64Address(address: string) {
  return new TonWeb.utils.Address(address).toString(true, true, true);
}
