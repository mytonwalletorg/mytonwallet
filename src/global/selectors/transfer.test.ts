import type { GlobalState } from '../types';

import { BNB, TONCOIN } from '../../config';
import { BSC_USDT_MAINNET, TON_USDT_MAINNET } from '../../../tests/mocks/tokens';
import { INITIAL_STATE } from '../initialState';
import { selectTokenMatchingCurrentTransferAddressSlow } from './transfer';

const ACCOUNT_ID = 'test-account';
const TON_ADDRESS = 'EQAIsixsrb93f9kDyplo_bK5OdgW5r0WCcIJZdGOUG1B282S';
const BNB_ADDRESS = '0x9429C8Af1089efD542b313156Af2DFA35c7e0a81';

const TOKEN_INFO: Record<string, object> = {
  [TONCOIN.slug]: { ...TONCOIN, priceUsd: 5, percentChange24h: 0 },
  [TON_USDT_MAINNET.slug]: { ...TON_USDT_MAINNET, priceUsd: 1, percentChange24h: 0 },
  [BNB.slug]: { ...BNB, priceUsd: 600, percentChange24h: 0 },
  [BSC_USDT_MAINNET.slug]: { ...BSC_USDT_MAINNET, priceUsd: 1, percentChange24h: 0 },
};

/**
 * Builds a minimal GlobalState for testing selectTokenMatchingCurrentTransferAddressSlow.
 *
 * The set of chains available in the account is derived automatically from the
 * `chain` field of each token slug present in `balances`.
 */
function buildGlobal(
  tokenSlug: string,
  toAddress: string | undefined,
  balances: Record<string, bigint>,
): GlobalState {
  const byChain: Record<string, unknown> = {};
  for (const slug of Object.keys(balances)) {
    const info = TOKEN_INFO[slug] as any;
    if (info?.chain === 'ton') byChain.ton = { address: TON_ADDRESS };
    if (info?.chain === 'bnb') byChain.bnb = { address: BNB_ADDRESS };
  }

  const tokenInfoBySlug = Object.fromEntries(
    Object.keys(balances)
      .filter((slug) => slug in TOKEN_INFO)
      .map((slug) => [slug, TOKEN_INFO[slug]]),
  );

  return {
    ...INITIAL_STATE,
    currentAccountId: ACCOUNT_ID,
    currentTransfer: {
      ...INITIAL_STATE.currentTransfer,
      tokenSlug,
      toAddress,
    },
    accounts: {
      byId: { [ACCOUNT_ID]: { title: 'Test', type: 'mnemonic', byChain } },
    } as GlobalState['accounts'],
    tokenInfo: { bySlug: tokenInfoBySlug } as GlobalState['tokenInfo'],
    byAccountId: {
      [ACCOUNT_ID]: {
        balances: { bySlug: balances },
        nfts: { byAddress: {} },
      } as GlobalState['byAccountId'][string],
    },
    settings: {
      ...INITIAL_STATE.settings,
      isTestnet: false,
      byAccountId: { [ACCOUNT_ID]: {} },
    },
  };
}

describe('selectTokenMatchingCurrentTransferAddressSlow', () => {
  describe('no-op conditions', () => {
    it('returns the current token when toAddress is empty', () => {
      const global = buildGlobal(TONCOIN.slug, undefined, {
        [TONCOIN.slug]: 1_000_000_000n,
      });

      expect(selectTokenMatchingCurrentTransferAddressSlow(global)).toBe(TONCOIN.slug);
    });

    it('returns the current token when the address belongs to the current chain (TON → TON)', () => {
      const global = buildGlobal(TONCOIN.slug, TON_ADDRESS, {
        [TONCOIN.slug]: 1_000_000_000n,
        [BNB.slug]: 1_000_000_000_000_000_000n,
      });

      expect(selectTokenMatchingCurrentTransferAddressSlow(global)).toBe(TONCOIN.slug);
    });

    it('returns the current token when the address belongs to the current chain (BNB → BNB)', () => {
      const global = buildGlobal(BNB.slug, BNB_ADDRESS, {
        [BNB.slug]: 1_000_000_000_000_000_000n,
        [TONCOIN.slug]: 1_000_000_000n,
      });

      expect(selectTokenMatchingCurrentTransferAddressSlow(global)).toBe(BNB.slug);
    });
  });

  describe('chain switching', () => {
    it('selects BNB when pasting a BNB address while Toncoin is current', () => {
      const global = buildGlobal(TONCOIN.slug, BNB_ADDRESS, {
        [TONCOIN.slug]: 1_000_000_000n,
        [BNB.slug]: 1_000_000_000_000_000_000n,
      });

      expect(selectTokenMatchingCurrentTransferAddressSlow(global)).toBe(BNB.slug);
    });

    it('selects Toncoin when pasting a TON address while BNB is current', () => {
      const global = buildGlobal(BNB.slug, TON_ADDRESS, {
        [BNB.slug]: 1_000_000_000_000_000_000n,
        [TONCOIN.slug]: 1_000_000_000n,
      });

      expect(selectTokenMatchingCurrentTransferAddressSlow(global)).toBe(TONCOIN.slug);
    });
  });

  describe('native → native token preference', () => {
    it('prefers Toncoin (native) over TON USDT when BNB is current', () => {
      const global = buildGlobal(BNB.slug, TON_ADDRESS, {
        [BNB.slug]: 1_000_000_000_000_000_000n,
        [TONCOIN.slug]: 100_000_000n,
        [TON_USDT_MAINNET.slug]: 1_000_000_000n,
      });

      expect(selectTokenMatchingCurrentTransferAddressSlow(global)).toBe(TONCOIN.slug);
    });

    it('prefers BNB (native) over BSC USDT when Toncoin is current', () => {
      const global = buildGlobal(TONCOIN.slug, BNB_ADDRESS, {
        [TONCOIN.slug]: 1_000_000_000n,
        [BNB.slug]: 1_000_000_000_000_000_000n,
        [BSC_USDT_MAINNET.slug]: 1_000_000_000_000_000_000_000n,
      });

      expect(selectTokenMatchingCurrentTransferAddressSlow(global)).toBe(BNB.slug);
    });
  });
});
