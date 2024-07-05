import type {
  Address, Cell, Contract, ContractProvider,
} from '@ton/core';
import {
  beginCell, contractAddress,
} from '@ton/core';

export type DnsItemConfig = {};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function dnsItemConfigToCell(config: DnsItemConfig): Cell {
  return beginCell().endCell();
}

export class DnsItem implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new DnsItem(address);
  }

  static createFromConfig(config: DnsItemConfig, code: Cell, workchain = 0) {
    const data = dnsItemConfigToCell(config);
    const init = { code, data };
    return new DnsItem(contractAddress(workchain, init), init);
  }

  // eslint-disable-next-line class-methods-use-this
  async getDomain(provider: ContractProvider) {
    const res = await provider.get('get_domain', []);
    const domain = res.stack.readString();
    return domain;
  }

  // eslint-disable-next-line class-methods-use-this
  async getTelemintDomain(provider: ContractProvider) {
    const res = await provider.get('get_domain_full', []);
    const domain = res.stack.readString();
    const parts = domain.replace(/\\u0000/g, '.').replace(/\.$/, '').split('.');
    parts.reverse();
    return parts.join('.');
  }

  // eslint-disable-next-line class-methods-use-this
  async getNftData(provider: ContractProvider) {
    const res = await provider.get('get_nft_data', []);
    const index = res.stack.readBigNumber();
    const collectionAddress = res.stack.readAddress();
    const owner = res.stack.readAddressOpt();

    return {
      index,
      collectionAddress,
      owner,
    };
  }
}
