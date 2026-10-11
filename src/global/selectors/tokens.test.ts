import type { GlobalState } from '../types';

import { BNB, TONCOIN } from '../../config';
import { BSC_USDT_MAINNET, TON_USDT_MAINNET } from '../../../tests/mocks/tokens';
import { INITIAL_STATE } from '../initialState';
import { selectTokenInfoUserTokens } from './tokens';

const ACCOUNT_ID = 'mainnet-0';

function buildGlobal(): GlobalState {
  return {
    ...INITIAL_STATE,
    currentAccountId: ACCOUNT_ID,
    accounts: {
      byId: {
        [ACCOUNT_ID]: {
          title: 'Test',
          type: 'mnemonic',
          byChain: {
            ton: { address: 'ton-address' },
            bnb: { address: '0x0000000000000000000000000000000000000000' },
          },
        },
      },
    },
    byAccountId: {
      [ACCOUNT_ID]: {
        balances: {
          bySlug: {
            [TONCOIN.slug]: 1_000_000_000n,
            [BNB.slug]: 2_000_000_000_000_000_000n,
          },
        },
      },
    },
    tokenInfo: {
      bySlug: {
        [TONCOIN.slug]: { ...TONCOIN, priceUsd: 5, percentChange24h: 0 },
        [BNB.slug]: { ...BNB, priceUsd: 3000, percentChange24h: 100 },
        [BSC_USDT_MAINNET.slug]: { ...BSC_USDT_MAINNET, priceUsd: 1, percentChange24h: 0 },
        [TON_USDT_MAINNET.slug]: { ...TON_USDT_MAINNET, priceUsd: 1, percentChange24h: 0 },
      },
    },

  } as GlobalState;
}

describe('selectTokenInfoUserTokens', () => {
  it('uses tokenInfo so Settings asset search can find EVM assets', () => {
    const global = buildGlobal();
    const tokens = selectTokenInfoUserTokens(global)!;
    const tokensBySlug = Object.fromEntries(tokens.map((token) => [token.slug, token]));

    expect(Object.keys(tokensBySlug)).toEqual(expect.arrayContaining([
      TONCOIN.slug,
      BNB.slug,
      BSC_USDT_MAINNET.slug,
      TON_USDT_MAINNET.slug,
    ]));
    expect(tokensBySlug[BSC_USDT_MAINNET.slug].chain).toBe('bnb');
    expect(tokensBySlug[BSC_USDT_MAINNET.slug].amount).toBe(0n);
    expect(tokensBySlug[BNB.slug].amount).toBe(2_000_000_000_000_000_000n);
    expect(tokensBySlug[BNB.slug].price).toBe(3000);
    expect(tokensBySlug[BNB.slug].change24h).toBe(1);
  });

  it('memoizes the list across unrelated global changes', () => {
    const global = buildGlobal();

    expect(selectTokenInfoUserTokens({
      ...global,
      isBackupWalletModalOpen: true,
    })).toBe(selectTokenInfoUserTokens(global));
  });
});
