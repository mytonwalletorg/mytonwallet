import type { Address, Cell, ContractProvider } from '@ton/core';
import { beginCell } from '@ton/core';

import { JettonWallet } from '../JettonWallet';

enum OpCode {
  transfer_timelocked = 0xd750cec9,
}

export class TsUSDeWallet extends JettonWallet {
  constructor(readonly address: Address) {
    super(address);
  }

  static createFromAddress(address: Address) {
    return new TsUSDeWallet(address);
  }

  async getTimeLockData(provider: ContractProvider): Promise<{
    lockedBalance: bigint;
    unlockTime?: number;
  }> {
    try {
      const stack = (await provider.get('get_timelock_data', [])).stack;
      const lockedBalance = stack.readBigNumber();
      const unlockTime = stack.readNumber();
      return { lockedBalance, unlockTime };
    } catch (err: any) {
      if (err.message?.includes('exit_code: -13')) {
        return { lockedBalance: 0n };
      } else {
        throw err;
      }
    }
  }

  static transferTimelockedMessage(options: {
    jettonAmount: bigint;
    to: Address;
    responseAddress?: Address;
    customPayload?: Cell;
    forwardTonAmount: bigint;
    forwardPayload?: Cell;
  }) {
    return beginCell()
      .storeUint(OpCode.transfer_timelocked, 32)
      .storeUint(0, 64) // op, queryId
      .storeCoins(options.jettonAmount)
      .storeAddress(options.to)
      .storeAddress(options.responseAddress)
      .storeMaybeRef(options.customPayload)
      .storeCoins(options.forwardTonAmount)
      .storeMaybeRef(options.forwardPayload)
      .endCell();
  }
}
