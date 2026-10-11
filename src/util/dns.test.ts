import { TON_DNS_ZONES } from '../config';
import {
  getDnsDomainZone,
  getDnsZoneByCollection,
  isTonChainDns,
} from './dns';

const correctDomains = [
  {
    zone: TON_DNS_ZONES.find((zone) => zone.suffixes[0] === 'ion'),
    domains: [
      { full: 'foo-bar.ion', base: 'foo-bar' },
      { full: 'sub.domain.ion', base: 'sub.domain' },
      { full: 'sub.sub.domain.ion', base: 'sub.sub.domain' },
    ],
  },
];

const incorrectDomains = [
  // Unknown or TON zones
  'mywallet.me',
  'foo-bar.ton',
  'boss777.vip',
  'tele.grm',
  'alice.t.me',

  // Forbidden symbols
  'foo_bar.ion',
  'h@cker.ion',
  ' domain.ion',

  // Too short
  'ion',
  'a.ion',

  // Too long
  '0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999'
  + '000000000011111111112222222222.ion',

  // Too deep
  'one.two.three.domain.ion',
];

describe('isTonBlockchainDns', () => {
  it.each(correctDomains.flatMap(({ domains }) => domains))(
    'returns true for $full',
    (domain) => {
      expect(isTonChainDns(domain.full)).toBe(true);
    },
  );

  it.each(incorrectDomains)(
    'returns false for %s',
    (domain) => {
      expect(isTonChainDns(domain)).toBe(false);
    },
  );
});

describe('getDnsDomainZone', () => {
  for (const { zone, domains } of correctDomains) {
    it.each(domains)(
      'recognizes $full',
      (domain) => {
        expect(getDnsDomainZone(domain.full)).toEqual({ base: domain.base, zone });
      },
    );
  }

  it.each(incorrectDomains)(
    'returns undefined for %s',
    (domain) => {
      expect(getDnsDomainZone(domain)).toBe(undefined);
    },
  );
});

describe('getDnsZoneByCollection', () => {
  it.each(TON_DNS_ZONES)(
    'finds $resolver',
    (zone) => {
      expect(getDnsZoneByCollection(zone.resolver)).toBe(zone);
    },
  );
});
