/* Source https://github.com/toncenter/tonweb/blob/master/src/contract/dns/DnsUtils.js */
import type { Cell, Slice } from '@ton/core';
import { Address, Builder } from '@ton/core';

import type { TonClient } from './TonClient';

import { sha256 } from '../../../common/utils';

export type DnsResult = Cell | Address | string | undefined;

export enum DnsCategory {
  DnsNextResolver = 'dns_next_resolver',
  Wallet = 'wallet',
  Site = 'site',
  BagId = 'storage',
}

async function categoryToBigInt(category?: string) {
  if (!category) return 0n; // all categories
  const categoryBytes = new TextEncoder().encode(category);
  const categoryHashHex = Buffer.from(await sha256(categoryBytes)).toString('hex');
  return BigInt(`0x${categoryHashHex}`);
}

function parseSmartContractAddressImpl(cell: Cell, prefix0: number, prefix1: number): Address | undefined {
  const slice = cell.asSlice();

  const byte0 = slice.loadUint(8);
  const byte1 = slice.loadUint(8);

  if (byte0 !== prefix0 || byte1 !== prefix1) {
    throw new Error('Invalid dns record value prefix');
  }

  return parseAddress(slice);
}

function parseSmartContractAddressRecord(cell: Cell): Address | undefined {
  return parseSmartContractAddressImpl(cell, 0x9f, 0xd3);
}

function parseNextResolverRecord(cell: Cell): Address | undefined {
  return parseSmartContractAddressImpl(cell, 0xba, 0x93);
}

function parseStorageBagIdRecord(cell: Cell): string {
  const slice = cell.asSlice();
  const byte0 = slice.loadUint(8);
  const byte1 = slice.loadUint(8);

  if (byte0 !== 0x74 || byte1 !== 0x73) {
    throw new Error('Invalid dns record value prefix');
  }

  const buffer = slice.loadBuffer(4);
  return buffer.toString('hex');
}

function parseSiteRecord(cell: Cell): string {
  const slice = cell.asSlice();
  const byte0 = slice.loadUint(8);
  const byte1 = slice.loadUint(8);

  if (byte0 === 0xad || byte1 === 0x01) {
    return parseAdnlAddressRecord(cell);
  } else {
    return parseStorageBagIdRecord(cell);
  }
}

function parseAdnlAddressRecord(cell: Cell): string {
  const slice = cell.asSlice();
  const byte0 = slice.loadUint(8);
  const byte1 = slice.loadUint(8);

  if (byte0 !== 0xad || byte1 !== 0x01) {
    throw new Error('Invalid dns record value prefix');
  }

  const buffer = slice.loadBuffer(4);
  return buffer.toString('hex');
}

async function dnsResolveImpl(
  client: TonClient,
  dnsAddress: string,
  rawDomainBytes: Uint8Array,
  category?: DnsCategory,
  oneStep?: boolean,
): Promise<DnsResult> {
  const len = rawDomainBytes.length * 8;

  const domainCell = new Builder()
    .storeBuffer(Buffer.from(rawDomainBytes))
    .asCell();

  const categoryBN = await categoryToBigInt(category);
  const { stack } = await client.callGetMethod(Address.parse(dnsAddress), 'dnsresolve', [
    { type: 'slice', cell: domainCell },
    { type: 'int', value: BigInt(categoryBN.toString()) },
  ]);

  const resultLen = stack.readNumber();

  let cell: Cell | undefined;

  try {
    cell = stack.readCell();
  } catch (err) {
    // Do nothing
  }

  if (resultLen === 0) {
    return undefined; // domain cannot be resolved
  }

  if (resultLen % 8 !== 0) {
    throw new Error('domain split not at a component boundary');
  }
  // if (rawDomainBytes[resultLen] !== 0) {
  //     throw new Error('domain split not at a component boundary');
  // }
  if (resultLen > len) {
    throw new Error(`invalid response ${resultLen}/${len}`);
  } else if (resultLen === len) {
    if (category === DnsCategory.DnsNextResolver) {
      return cell ? parseNextResolverRecord(cell) : undefined;
    } else if (category === DnsCategory.Wallet) {
      return cell ? parseSmartContractAddressRecord(cell) : undefined;
    } else if (category === DnsCategory.Site) {
      return cell ? parseSiteRecord(cell) : undefined;
    } else if (category === DnsCategory.BagId) {
      return cell ? parseStorageBagIdRecord(cell) : undefined;
    } else {
      return cell;
    }
  } else if (!cell) {
    return undefined; // domain cannot be resolved
  } else {
    const nextAddress = parseNextResolverRecord(cell)!;
    if (oneStep) {
      if (category === DnsCategory.DnsNextResolver) {
        return nextAddress;
      } else {
        return undefined;
      }
    } else {
      return dnsResolveImpl(client, nextAddress.toString(), rawDomainBytes.slice(resultLen / 8), category, false);
    }
  }
}

function domainToBytes(domain: string): Uint8Array {
  if (!domain || !domain.length) {
    throw new Error('empty domain');
  }
  if (domain === '.') {
    return new Uint8Array([0]);
  }

  domain = domain.toLowerCase();

  for (let i = 0; i < domain.length; i++) {
    if (domain.charCodeAt(i) <= 32) {
      throw new Error('bytes in range 0..32 are not allowed in domain names');
    }
  }

  for (let i = 0; i < domain.length; i++) {
    const s = domain.substring(i, i + 1);
    for (let c = 127; c <= 159; c++) { // another control codes range
      if (s === String.fromCharCode(c)) {
        throw new Error('bytes in range 127..159 are not allowed in domain names');
      }
    }
  }

  const arr = domain.split('.');

  arr.forEach((part) => {
    if (!part.length) {
      throw new Error('domain name cannot have an empty component');
    }
  });

  let rawDomain = `${arr.reverse().join('\0')}\0`;
  if (rawDomain.length < 126) {
    rawDomain = `\0${rawDomain}`;
  }

  return new TextEncoder().encode(rawDomain);
}

export function dnsResolve(
  client: TonClient,
  rootDnsAddress: string,
  domain: string,
  category?: DnsCategory,
  oneStep?: boolean,
): Promise<DnsResult> {
  const rawDomainBytes = domainToBytes(domain);

  return dnsResolveImpl(client, rootDnsAddress, rawDomainBytes, category, oneStep);
}

function parseAddress(slice: Slice): Address | undefined {
  slice.loadUint(3);
  let n = slice.loadUintBig(8);
  if (n > 127n) { // Maybe it's not necessary?
    n -= 256n;
  }

  const hashPart = slice.loadUintBig(256);
  if (`${n.toString(10)}:${hashPart.toString(16)}` === '0:0') {
    return undefined;
  }
  const s = `${n.toString(10)}:${hashPart.toString(16).padStart(64, '0')}`;
  return Address.parse(s);
}
