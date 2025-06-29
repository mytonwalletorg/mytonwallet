import type { ApiNetwork, ApiTransactionActivity } from '../../types';
import type { TracesResponse } from './toncenter/traces';

import { makeMockTransactionActivity } from '../../../../tests/mocks';
import { calculateActivityDetails } from './activities';
import { parseTrace } from './traces';

describe('parseTrace + calculateActivityDetails', () => {
  // How to get the input data:
  // 1. Add `console.log('activity', activity);` at the start of `calculateActivityDetails`,
  // 2. Open a transaction modal in the Activity tab of the app,
  // 3. Get the trace JSON from the `/api/v3/traces` response in the Network tab of the DevTools.

  describe('transactions', () => {
    const testCases: {
      name: string;
      walletAddress: string;
      activityPart: Partial<ApiTransactionActivity>;
      traceResponse: TracesResponse;
      expectedFee: bigint;
    }[] = [
      {
        name: 'TON transfer',
        walletAddress: 'UQCgf9xAc0HumzY_N2Lgk5oQk3_pL7N04GT0KaP-H7upN-qH',
        activityPart: {
          id: 'eamGZJTFfqWoRX5MgBlLZlJ20372CUiL6uEtKh7xeU8='
            + ':50757011000001-y740RzK3hGPDFSkzvkK40PU7WJMjK00jz+FxBOmitzA=',
          externalMsgHash: 'BSn6jVJGA3/qfCvFaugHNYYsz5fXDUSYd6RTX396e4Q=',
          fromAddress: 'UQCgf9xAc0HumzY_N2Lgk5oQk3_pL7N04GT0KaP-H7upN-qH',
          toAddress: 'UQDxO-azxmbgK2vb_FMPE2y7PMCGeMal0wXqCt9w797d1YFR',
          isIncoming: false,
          normalizedAddress: 'EQDxO-azxmbgK2vb_FMPE2y7PMCGeMal0wXqCt9w797d1dyU',
          amount: -5000000000n,
          slug: 'toncoin',
        },
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        traceResponse: require('./testData/tonTransferTraceResponse.json'),
        expectedFee: 2345629n,
      },
      {
        name: 'USDT transfer',
        walletAddress: 'UQCgf9xAc0HumzY_N2Lgk5oQk3_pL7N04GT0KaP-H7upN-qH',
        activityPart: {
          id: 'OnWzsl9e4nQZd6iCCy6HoFj+grX2RcH68MoNW4Dv5Jw='
            + ':48818110000001-9K6Gj0dR+3KIpfTeQ03h5q22dHTXpco5P7RCqOxzIBs=',
          externalMsgHash: 'Bipiu5Wd8Z87Vz1d8jVXTXPPRJbsT4ydVT2TWrMgmqg=',
          fromAddress: 'UQCgf9xAc0HumzY_N2Lgk5oQk3_pL7N04GT0KaP-H7upN-qH',
          toAddress: 'UQBGDiFhz7JAEYSe7gSYgic5az5ynJnzvL3BcEGMO-M-3iD_',
          isIncoming: false,
          normalizedAddress: 'EQBGDiFhz7JAEYSe7gSYgic5az5ynJnzvL3BcEGMO-M-3n06',
          amount: -90000000n,
          slug: 'ton-eqcxe6mutq',
        },
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        traceResponse: require('./testData/usdtTransferTraceResponse.json'),
        expectedFee: 7220787n,
      },
      {
        name: 'Contract call',
        walletAddress: 'UQAD87Hs-_MrShb84GwhM1Mnwe_72i10VWQWU1eQ6v1nGkR8',
        activityPart: {
          id: 'aauhCIOh6YFanxo483sLtzfeVEj05q4HCozrmNGsXdI='
            + ':57371927000002-gbNcDqRV9NJg1oMoOpC0CGXGeHv3/78rwkTj6UkNIgY=',
          externalMsgHash: 'K6gpSRaFh9t4//KLB/+gTL9XDSQJN9apL3VFyYNH4P0=',
          fromAddress: 'UQAD87Hs-_MrShb84GwhM1Mnwe_72i10VWQWU1eQ6v1nGkR8',
          toAddress: 'EQBS114FhHMAASOdTNjHPWUbIG6sZ9tVFTW2ttUF5tQcd-kx',
          isIncoming: false,
          normalizedAddress: 'EQBS114FhHMAASOdTNjHPWUbIG6sZ9tVFTW2ttUF5tQcd-kx',
          amount: -1014280000n,
          slug: 'toncoin',
          type: 'callContract',
        },
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        traceResponse: require('./testData/contractCallTraceResponse.json'),
        expectedFee: 5871974n,
      },
    ];

    test.each(testCases)('$name', ({ walletAddress, activityPart, traceResponse, expectedFee }) => {
      const activity = makeMockTransactionActivity({
        ...activityPart,
        fee: 0n,
        shouldLoadDetails: true,
      });
      const parsedTrace = parseTraceResponse('mainnet', walletAddress, traceResponse);

      expect(calculateActivityDetails(activity, parsedTrace).activity).toEqual({
        ...activity,
        fee: expectedFee,
        shouldLoadDetails: undefined,
      });
    });
  });
});

/**
 * `traceResponse` is the JSON from the https://toncenter.mytonwallet.org/api/v3/traces?... response body
 */
function parseTraceResponse(network: ApiNetwork, walletAddress: string, traceResponse: TracesResponse) {
  return parseTrace({
    network,
    walletAddress,
    actions: traceResponse.traces[0].actions,
    traceDetail: traceResponse.traces[0].trace,
    addressBook: traceResponse.address_book,
    transactions: traceResponse.traces[0].transactions,
  });
}
