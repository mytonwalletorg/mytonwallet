import type { ApiChain } from '../api/types';

import { getChainConfig } from './chain';
import dns from './dns';

export function isValidAddressOrDomain(address: string, chain: ApiChain, allowPrefix?: boolean) {
  const config = getChainConfig(chain);
  return address && (
    config[allowPrefix ? 'addressPrefixRegex' : 'addressRegex'].test(address)
    || (config.isDnsSupported && dns.isDnsDomain(address))
  );
}
