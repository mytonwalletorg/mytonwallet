import type { ApiNetwork } from '../../types';

import dns from '../../../util/dns';
import { getTonWeb, toBase64Address } from './util/tonweb';

const { DnsCollection } = require('tonweb/src/contract/dns/DnsCollection');

const VIP_DNS_COLLECTION = 'EQBWG4EBbPDv4Xj7xlPwzxd7hSyHMzwwLB5O6rY-0BBeaixS';

export async function resolveAddress(network: ApiNetwork, address: string): Promise<{
  address: string;
  domain?: string;
} | undefined> {
  if (!dns.isDnsDomain(address)) {
    return { address };
  }

  const domain = address;
  const tonweb = await getTonWeb(network);

  try {
    if (dns.isVipDnsDomain(domain)) {
      const base = dns.removeVipZone(domain)!;

      return (await new DnsCollection(tonweb.provider, {
        address: VIP_DNS_COLLECTION,
      }).resolve(base, 'wallet'))?.toString(true, true, true);
    }

    const addressObj = await tonweb.dns.getWalletAddress(domain);
    if (!addressObj) {
      return undefined;
    }

    return { address: toBase64Address(addressObj), domain };
  } catch (err: any) {
    if (err.message !== 'http provider parse response error') {
      throw err;
    }
    return undefined;
  }
}

export function normalizeAddress(address: string) {
  return toBase64Address(address, true);
}
