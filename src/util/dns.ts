import type { ApiNft } from '../api/types';

import { TON_DNS_COLLECTION, TON_DNS_RENEWAL_WARNING_DAYS, TON_DNS_ZONES } from '../config';
import { getCountDaysToDate } from './dateFormat';

export function isDnsDomain(value: string) {
  return getDnsDomainZone(value) !== undefined;
}

export function getDnsDomainZone(domain: string) {
  for (const zone of TON_DNS_ZONES) {
    const { suffixes, baseFormat } = zone;

    // Iterating the zones in reverse to prioritize longer zones when multiple zones match (assuming the zones go from
    // the shortest to the longest). For example, `test.ton.vip` matches both `vip` and `ton.vip`, and `ton.vip` must be
    // used.
    for (let i = suffixes.length - 1; i >= 0; i--) {
      const suffix = suffixes[i];
      if (!domain.endsWith(`.${suffix}`)) {
        continue;
      }

      const base = domain.slice(0, -suffix.length - 1);
      if (!baseFormat.test(base)) {
        continue;
      }

      return { base, zone };
    }
  }

  return undefined;
}

export function getDnsZoneByCollection(collectionAddress: string) {
  return TON_DNS_ZONES.find((zone) => zone.resolver === collectionAddress);
}

export function isTonDnsNft(nft: ApiNft | undefined): nft is ApiNft {
  return nft?.collectionAddress === TON_DNS_COLLECTION;
}

export function getTonDnsExpirationDate(nft: ApiNft | undefined, dnsExpiration: Record<string, number> | undefined) {
  return isTonDnsNft(nft) ? dnsExpiration?.[nft.address] : undefined;
}

export function filterExpiringDomains(
  nftAddresses: string[],
  nftByAddress?: Record<string, ApiNft>,
  dnsExpiration?: Record<string, number>,
) {
  const expiringDomains: ApiNft[] = [];

  if (nftByAddress && dnsExpiration) {
    for (const address of nftAddresses) {
      const nft = nftByAddress[address];
      if (getCountDaysToDate(getTonDnsExpirationDate(nft, dnsExpiration) ?? Infinity) <= TON_DNS_RENEWAL_WARNING_DAYS) {
        expiringDomains.push(nft);
      }
    }
  }

  return expiringDomains;
}

export function getDomainsExpirationDate(
  nfts: (string | ApiNft)[],
  nftByAddress?: Record<string, ApiNft>,
  dnsExpiration?: Record<string, number>,
) {
  if (!dnsExpiration) {
    return undefined;
  }

  return nfts.reduce<number | undefined>(
    (minDate, nftOrAddress) => {
      const nft = typeof nftOrAddress === 'string' ? nftByAddress?.[nftOrAddress] : nftOrAddress;
      const expirationDate = getTonDnsExpirationDate(nft, dnsExpiration);
      return expirationDate
        ? Math.min(expirationDate, minDate ?? Infinity)
        : minDate;
    },
    undefined,
  );
}
