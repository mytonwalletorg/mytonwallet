import type { ApiTransactionActivity } from '../../types';

import { makeMockSwapActivity, makeMockTransactionActivity } from '../../../../tests/mocks';
import { mergeActivities } from './transactions';

describe('mergeActivities', () => {
  it('merges and sorts activities', () => {
    const trxTxs = [
      makeMockTransactionActivity({ id: 'a', timestamp: 2 }),
      makeMockTransactionActivity({ id: 'b', timestamp: 1 }),
    ];
    const tokenTxs = [
      makeMockTransactionActivity({ id: 'c', timestamp: 3 }),
    ];
    const result = mergeActivities(trxTxs, tokenTxs);
    expect(result.map((a) => a.id)).toEqual(['c', 'a', 'b']);
  });

  it('takes token transaction fee from corresponding TRX transaction', () => {
    const trxTxs = [makeMockTransactionActivity({ id: 'a', timestamp: 1, fee: 123n })];
    const tokenTxs = [makeMockTransactionActivity({ id: 'a', timestamp: 1, fee: 0n })];
    const result = mergeActivities(trxTxs, tokenTxs);
    // tokenTx should have fee from trxTx
    const resultTokenTx = result.find((a) => a.id === 'a') as ApiTransactionActivity;
    expect(resultTokenTx.fee).toBe(123n);
  });

  it('does not duplicate swap activities shared between TRX and token', () => {
    const swap = makeMockSwapActivity({ id: 'swap1', timestamp: 1 });
    const trxTxs = [swap];
    const tokenTxs = [swap];
    const result = mergeActivities(trxTxs, tokenTxs);
    // Only one swap activity should be present
    expect(result.filter((a) => a.id === 'swap1').length).toBe(1);
  });
});
