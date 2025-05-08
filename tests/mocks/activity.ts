import type { ApiTransactionActivity } from '../../src/api/types';

import { MYCOIN, TON_USDT_SLUG, TONCOIN, TRC20_USDT_MAINNET_SLUG, TRX } from '../../src/config';
import { buildTxId } from '../../src/util/activities';
import { random, randomBase64, sample } from '../../src/util/random';

const slugs = [
  TONCOIN.slug,
  TRX.slug,
  MYCOIN.slug,
  TON_USDT_SLUG,
  TRC20_USDT_MAINNET_SLUG,
];

export function makeMockTransactionActivity(partial: Partial<ApiTransactionActivity> = {}): ApiTransactionActivity {
  const id = partial.id ?? partial.txId ?? buildTxId(randomBase64(32));
  const isIncoming = Math.random() < 0.5;

  return {
    kind: 'transaction',
    id,
    txId: id,
    timestamp: Date.now(),
    externalMsgHash: randomBase64(32),
    fee: BigInt(random(1e3, 1e6)),
    fromAddress: randomBase64(36),
    toAddress: randomBase64(36),
    isIncoming,
    normalizedAddress: randomBase64(36),
    amount: BigInt((isIncoming ? -1 : 1) * random(1e7, 1e10)),
    slug: sample(slugs),
    ...partial,
  };
}
