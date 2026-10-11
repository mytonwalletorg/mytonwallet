import type { ApiStakingState } from '../../api/types';

import { LIQUID_POOL, TONCOIN } from '../../config';
import { TON_USDT_MAINNET } from '../../../tests/mocks/tokens';
import { getFullStakingBalance, getIsNewStakeAllowed } from '.';

describe('getIsNewStakeAllowed', () => {
  it('allows new stakes for other tokens', () => {
    expect(getIsNewStakeAllowed(TONCOIN.slug)).toBe(true);
    expect(getIsNewStakeAllowed('ton-some-other-jetton')).toBe(true);
  });

  it('allows when the slug is unknown', () => {
    expect(getIsNewStakeAllowed(undefined)).toBe(true);
  });
});

describe('getFullStakingBalance', () => {
  function buildLiquidState(balance: bigint) {
    return {
      type: 'liquid',
      id: 'liquid',
      tokenSlug: TONCOIN.slug,
      pool: LIQUID_POOL,
      balance,
      tokenBalance: 4_549_625_219_272n,
      annualYield: 14.37,
      yieldType: 'APY',
      instantAvailable: 0n,
      start: 0,
      end: 0,
      tvl: 0n,
      totalStakers: 0,
    } as unknown as ApiStakingState;
  }

  it('takes a liquid stake as is', () => {
    expect(getFullStakingBalance(buildLiquidState(5_206_490_590_615n))).toBe(5_206_490_590_615n);
  });

  it('still adds unclaimed rewards to a jetton stake', () => {
    const state = {
      type: 'jetton',
      id: 'jetton',
      tokenSlug: TON_USDT_MAINNET.slug,
      pool: 'EQCaSTAKE',
      balance: 1_000n,
      unclaimedRewards: 25n,
      annualYield: 10,
      yieldType: 'APR',
    } as unknown as ApiStakingState;

    expect(getFullStakingBalance(state)).toBe(1_025n);
  });
});
