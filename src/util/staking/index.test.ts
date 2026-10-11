import type { ApiStakingState } from '../../api/types';

import { TONCOIN } from '../../config';
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
  function buildLiquidState(balance: bigint, loyaltyBalance: bigint) {
    return {
      type: 'liquid',
      id: 'liquid',
      tokenSlug: TONCOIN.slug,
      pool: 'EQD2_4d91M4TVbEBVyBF8J1UwpMJc361LKVCz6bBlffMW05o',
      balance,
      loyaltyBalance,
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

  it('adds the loyalty bonus to a liquid stake', () => {
    // The bonus lives outside the STAKED jetton, so only the full balance accounts for it.
    expect(getFullStakingBalance(buildLiquidState(5_206_490_590_615n, 1_392_408_248n)))
      .toBe(5_207_882_998_863n);
  });

  it('leaves a liquid stake without a bonus untouched', () => {
    expect(getFullStakingBalance(buildLiquidState(5_206_490_590_615n, 0n)))
      .toBe(5_206_490_590_615n);
  });

  it('survives a state persisted before the bonus field existed', () => {
    const state = { ...buildLiquidState(5_206_490_590_615n, 0n) } as Record<string, unknown>;
    delete state.loyaltyBalance;

    expect(getFullStakingBalance(state as unknown as ApiStakingState)).toBe(5_206_490_590_615n);
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
