import { Dictionary } from '@ton/core';
import type { Cell } from '@ton/ton';
import { beginCell } from '@ton/ton';

import { sha256BigInt as toKey } from '../../../util/other';

const ONCHAIN_CONTENT_PREFIX = 0x00;

export function buildOnchainMetadata(data: any): Cell {
  const dict = Dictionary.empty(
    Dictionary.Keys.BigUint(256),
    Dictionary.Values.Cell(),
  );
  Object.entries(data).forEach(([key, value]) => {
    if (typeof (value) === 'number') {
      dict.set(toKey(key), beginCell().storeUint(0, 8).storeUint(value, 8).endCell());
    } else {
      dict.set(toKey(key), beginCell().storeUint(0, 8).storeStringTail(value as string).endCell());
    }
  });

  return beginCell()
    .storeInt(ONCHAIN_CONTENT_PREFIX, 8)
    .storeDict(dict)
    .endCell();
}
