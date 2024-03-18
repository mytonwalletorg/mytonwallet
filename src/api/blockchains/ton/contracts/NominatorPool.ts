import type {
  Cell, Contract, ContractProvider, TupleItem,
} from '@ton/core';
import {
  Address, beginCell, contractAddress, TupleReader,
} from '@ton/core';

export type NominatorPoolConfig = {};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function nominatorPoolConfigToCell(config: NominatorPoolConfig): Cell {
  return beginCell().endCell();
}

export class NominatorPool implements Contract {
  constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

  static createFromAddress(address: Address) {
    return new NominatorPool(address);
  }

  static createFromConfig(config: NominatorPoolConfig, code: Cell, workchain = 0) {
    const data = nominatorPoolConfigToCell(config);
    const init = { code, data };
    return new NominatorPool(contractAddress(workchain, init), init);
  }

  // eslint-disable-next-line class-methods-use-this
  async getListNominators(provider: ContractProvider): Promise<{
    address: Address;
    amount: bigint;
    pendingDepositAmount: bigint;
    withdrawRequested: boolean;
  }[]> {
    const res = await provider.get('list_nominators', []);

    const items = (res.stack as any).items[0].items;

    return items.map((item: { items: TupleItem[] }) => {
      const tuple = new TupleReader(item.items);

      const hash = tuple.readBigNumber().toString(16).padStart(64, '0');
      const address = Address.parse(`0:${hash}`);
      const amount = tuple.readBigNumber();
      const pendingDepositAmount = tuple.readBigNumber();
      const withdrawRequested = Boolean(tuple.readNumber());

      return {
        address,
        amount,
        pendingDepositAmount,
        withdrawRequested,
      };
    });
  }
}
