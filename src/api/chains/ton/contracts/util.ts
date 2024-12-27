import type { Cell, TupleReader } from '@ton/core';

import safeExec from '../../../../util/safeExec';

export function readCellOpt(stack: TupleReader): Cell | undefined {
  return safeExec(() => stack.readCellOpt(), {
    shouldIgnoreError: true,
  }) ?? undefined;
}
