import type { ApiTransactionActivity } from '../../src/api/types';

import { BNB, TONCOIN } from '../../src/config';
import { buildTxId } from '../../src/util/activities';
import { random, randomBase64, sample } from '../../src/util/random';
import { BSC_USDT_MAINNET, TON_USDT_MAINNET } from './tokens';

const slugs = [
  TONCOIN.slug,
  BNB.slug,
  TON_USDT_MAINNET.slug,
  BSC_USDT_MAINNET.slug,
];

export function makeMockTransactionActivity(partial: Partial<ApiTransactionActivity> = {}): ApiTransactionActivity {
  const isIncoming = Math.random() < 0.5;

  return {
    kind: 'transaction',
    id: buildTxId(randomBase64(32)),
    timestamp: Date.now(),
    externalMsgHashNorm: randomBase64(32),
    fee: BigInt(random(1e3, 1e6)),
    fromAddress: randomBase64(36),
    toAddress: randomBase64(36),
    isIncoming,
    normalizedAddress: randomBase64(36),
    amount: BigInt((isIncoming ? -1 : 1) * random(1e7, 1e10)),
    slug: sample(slugs),
    status: 'completed',
    ...partial,
  };
}
