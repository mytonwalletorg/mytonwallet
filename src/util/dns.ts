import { IS_CORE_WALLET, TON_DNS_ZONES } from '../config';

export function isDnsDomain(value: string) {
  return getDnsDomainZone(value) !== undefined;
}

export function getDnsDomainZone(domain: string) {
  for (const zone of TON_DNS_ZONES) {
    const { suffixes, baseFormat, isUnofficial } = zone;

    if (IS_CORE_WALLET && isUnofficial) {
      continue;
    }

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
  if (IS_CORE_WALLET) {
    return TON_DNS_ZONES.find((zone) => zone.resolver === collectionAddress && !zone.isUnofficial);
  }
  return TON_DNS_ZONES.find((zone) => zone.resolver === collectionAddress);
}
