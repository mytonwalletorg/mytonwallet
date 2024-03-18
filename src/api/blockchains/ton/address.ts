import { Address } from '@ton/core';

import type { ApiNetwork } from '../../types';

import dns from '../../../util/dns';
import { DnsCategory, dnsResolve } from './util/dns';
import { getTonClient, toBase64Address } from './util/tonCore';

const TON_DNS_COLLECTION = 'EQC3dNlesgVD8YbAazcauIrXBPfiVhMMr5YYk2in0Mtsz0Bz';
const VIP_DNS_COLLECTION = 'EQBWG4EBbPDv4Xj7xlPwzxd7hSyHMzwwLB5O6rY-0BBeaixS';

export async function resolveAddress(network: ApiNetwork, address: string): Promise<{
  address: string;
  domain?: string;
} | undefined> {
  if (!dns.isDnsDomain(address)) {
    return { address };
  }

  const domain = address;

  try {
    let base: string;
    let collection: string;
    if (dns.isVipDnsDomain(domain)) {
      base = dns.removeVipZone(domain)!;
      collection = VIP_DNS_COLLECTION;
    } else {
      base = dns.removeTonZone(domain);
      collection = TON_DNS_COLLECTION;
    }

    const result = await dnsResolve(
      getTonClient(network),
      collection,
      base,
      DnsCategory.Wallet,
    );

    if (!(result instanceof Address)) {
      return undefined;
    }

    return { address: toBase64Address(result, undefined, network), domain };
  } catch (err: any) {
    if (err.message !== 'http provider parse response error') {
      throw err;
    }
    return undefined;
  }
}

export function normalizeAddress(address: string, network?: ApiNetwork) {
  return toBase64Address(address, true, network);
}
