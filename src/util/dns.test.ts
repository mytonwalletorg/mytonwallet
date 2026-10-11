import { TON_DNS_ZONES } from '../config';
import {
  getDnsDomainZone,
  getDnsZoneByCollection,
  isTonChainDns,
} from './dns';

const correctDomains = [
  {
    zone: TON_DNS_ZONES.find((zone) => zone.suffixes[0] === 'ton'),
    domains: [
      { full: 'foo-bar.ton', base: 'foo-bar' },
      { full: 'sub.domain.ton', base: 'sub.domain' },
      { full: 'sub.sub.domain.ton', base: 'sub.sub.domain' },
    ],
  },
  {
    zone: TON_DNS_ZONES.find((zone) => zone.suffixes[0] === 'vip'),
    domains: [
      { full: 'boss777.vip', base: 'boss777' },
      { full: 'boss777.ton.vip', base: 'boss777' },
      { full: 'boss777.vip.ton', base: 'boss777' },
      { full: 'sub.domain.vip', base: 'sub.domain' },
      { full: 'sub.sub.domain.vip', base: 'sub.sub.domain' },
    ],
  },
  {
    zone: TON_DNS_ZONES.find((zone) => zone.suffixes[0] === 'grm'),
    domains: [
      { full: 'tele.grm', base: 'tele' },
      { full: 'sub.domain.grm', base: 'sub.domain' },
      { full: 'sub.sub.domain.grm', base: 'sub.sub.domain' },
    ],
  },
];

const incorrectDomains = [
  // Unknown TLD
  'mywallet.me',
  'tele.gram',
  'sub.domain.gram',
  'sub.sub.domain.gram',

  // Forbidden symbols
  'foo_bar.ton',
  'h@cker.t.me',
  'foo-bar.vip',
  ' domain.ton',

  // Too short
  'ton',
  'a.ton',
  't.me',
  'b.t.me',

  // Too long
  '0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999'
  + '000000000011111111112222222222.ton',
  '0123456789012345678901234567890123456789.t.me',
  '012345678901234567890123456789.vip',
  '0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999'
  + '000000000011111111112222222222.gram',
  '0000000000111111111122222222223333333333444444444455555555556666666666777777777788888888889999999999'
  + '000000000011111111112222222222.grm',

  // Too deep
  'one.two.three.domain.ton',
  'one.two.three.domain.t.me',
  'one.two.three.domain.vip',
  'one.two.three.domain.gram',
  'one.two.three.domain.grm',
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
