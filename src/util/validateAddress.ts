import { Address } from '@ton/core';

import { resolveAddress } from '../api/chains/ton/address';
import { isDnsDomain } from './dns';
import withCache from './withCache';

export { isValidAddressOrDomain } from './isValidAddressOrDomain';

const resolveAddressWithCache = withCache(resolveAddress);

export async function resolveOrValidate(addressOrDomain: string) {
  if (isDnsDomain(addressOrDomain)) {
    try {
      const network = 'mainnet';
      const resolveResult = await resolveAddressWithCache(network, addressOrDomain);

      if (resolveResult === 'dnsNotResolved') {
        return {
          error: `Could not resolve TON domain: ${addressOrDomain}. Please check if the domain is valid and exists.`,
        };
      }

      if (resolveResult === 'invalidAddress') {
        return {
          error: `Invalid TON domain format: ${addressOrDomain}. Please use a valid .ton domain.`,
        };
      }

      return { resolvedAddress: resolveResult.address };
    } catch (domainError) {
      return {
        // eslint-disable-next-line @stylistic/max-len
        error: `Failed to resolve TON domain ${addressOrDomain}: ${domainError instanceof Error ? domainError.message : 'Unknown error'}`,
      };
    }
  } else {
    try {
      Address.parse(addressOrDomain);

      return { resolvedAddress: addressOrDomain };
    } catch (addressError) {
      return {
        error: `Invalid receiver address format: ${addressOrDomain}. Please use a valid TON address or .ton domain.`,
      };
    }
  }
}
