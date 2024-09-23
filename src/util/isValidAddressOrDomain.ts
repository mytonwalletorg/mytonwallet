import type { ApiChain } from '../api/types';

import { getChainConfig } from '../config';
import dns from './dns';

export function isValidAddressOrDomain(address: string, chain: ApiChain) {
  const config = getChainConfig(chain);
  return address && (config.addressRegex.test(address) || (config.isDnsSupported && dns.isDnsDomain(address)));
}
