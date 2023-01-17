import { Storage } from '../../storages/types';
import { getTonWeb } from './util/tonweb';
import dns from '../../../util/dns';
import { ApiNetwork } from '../../types';
import { toInternalAccountId } from '../../common/helpers';

const { DnsCollection } = require('tonweb/src/contract/dns/DnsCollection');

const VIP_DNS_COLLECTION = 'EQBWG4EBbPDv4Xj7xlPwzxd7hSyHMzwwLB5O6rY-0BBeaixS';

export async function resolveAddress(network: ApiNetwork, address: string) {
  if (!dns.isDnsDomain(address)) {
    return address;
  }

  const domain = address;
  const tonweb = await getTonWeb(network);

  try {
    if (dns.isVipDnsDomain(domain)) {
      const base = dns.removeZone(domain);
      return (await new DnsCollection(tonweb.provider, {
        address: VIP_DNS_COLLECTION,
      }).resolve(base, 'wallet'))?.toString(true, true, true);
    }

    return (await tonweb.dns.getWalletAddress(domain))?.toString(true, true, true);
  } catch (err: any) {
    if (err.message !== 'http provider parse response error') {
      throw err;
    }
    return undefined;
  }
}

export async function fetchAddress(storage: Storage, accountId: string): Promise<string> {
  const internalId = toInternalAccountId(accountId);
  const addressesJson = (await storage.getItem('addresses'))!;
  const addresses = JSON.parse(addressesJson);
  return addresses[internalId];
}
