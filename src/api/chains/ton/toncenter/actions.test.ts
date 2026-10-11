import type { AnyAction } from './types';

import { TONCOIN } from '../../../../config';
import { parseActionsToActivities } from './actions';

const SENDER_RAW = '0:23D691D27F1A8B11658D78C7FA416F071ED01A981D70C2338A3B23017DDF84D7';
const SENDER = 'UQAj1pHSfxqLEWWNeMf6QW8HHtAamB1wwjOKOyMBfd-E18BE';
const WALLET_RAW = '0:3DA2E8C0A3E67EC8A7BA5EF3D61022FFB8943E0011C628E7E6284C6BE571D150';
const WALLET = 'UQA9oujAo-Z-yKe6XvPWECL_uJQ-ABHGKOfmKExr5XHRUAwS';

// A native transfer as the ION indexer returns it
const ION_TRANSFER = {
  type: 'ion_transfer',
  trace_id: 'nkGxYcugLc6fAxw30vrzaoXy12YGkYntaDXUe3c37yg=',
  action_id: 'l+X0F6eZ/Uabv0IFpe39G2hlATZZpvrYTXb8',
  start_lt: '24889313000001',
  end_lt: '24889313000003',
  start_utime: 1791700000,
  end_utime: 1791700000,
  transactions: [],
  success: true,
  trace_end_lt: '24889313000003',
  trace_end_utime: 1791700000,
  trace_mc_seqno_end: 1,
  trace_external_hash: 'Q+7QXrnbd6YICWOV/Qlmp03VJ/RWJ5gvHVD2yIK17mM=',
  details: {
    source: SENDER_RAW,
    destination: WALLET_RAW,
    value: '50000000000000000',
    comment: null, // eslint-disable-line no-null/no-null
    encrypted: false,
  },
} as AnyAction;

describe('parseActionsToActivities', () => {
  it('reads an ION native transfer', () => {
    const [activity] = parseActionsToActivities([ION_TRANSFER], {
      network: 'mainnet',
      walletAddress: WALLET,
      metadata: {},
      addressBook: {
        [SENDER_RAW]: { user_friendly: SENDER, domain: null }, // eslint-disable-line no-null/no-null
        [WALLET_RAW]: { user_friendly: WALLET, domain: null }, // eslint-disable-line no-null/no-null
      },
    });

    expect(activity).toMatchObject({
      kind: 'transaction',
      slug: TONCOIN.slug,
      isIncoming: true,
      fromAddress: SENDER,
      amount: 50_000_000_000_000_000n,
    });
  });
});
