import { useMemo } from '../../../lib/teact/teact';

import type { ApiStakingState } from '../../../api/types';
import type { AmountInputToken } from '../../ui/AmountInput';

import { getIsActiveStakingState } from '../../../util/staking';

interface Options {
  tokenBySlug?: Record<string, AmountInputToken>;
  states?: ApiStakingState[];
  shouldUseNominators?: boolean;
  selectedStakingId?: string;
  isViewMode?: boolean;
}

export function useTokenDropdown({
  tokenBySlug, states, shouldUseNominators, selectedStakingId, isViewMode,
}: Options) {
  const selectableTokens = useMemo(() => {
    if (!tokenBySlug || !states) {
      return [];
    }

    let tokens = getStakingTokens(tokenBySlug, states, shouldUseNominators);

    if (isViewMode) {
      tokens = tokens.filter(({ id }) => id === selectedStakingId);
    }

    return tokens;
  }, [tokenBySlug, states, shouldUseNominators, isViewMode, selectedStakingId]);

  const selectedToken = useMemo(
    () => selectableTokens.find((token) => token.id === selectedStakingId),
    [selectableTokens, selectedStakingId],
  );

  return [selectedToken, selectableTokens] as const;
}

function getStakingTokens(
  tokenBySlug: Record<string, AmountInputToken>,
  states: ApiStakingState[],
  shouldUseNominators?: boolean,
) {
  const hasNominatorsStake = states.some((state) => state.type === 'nominators' && getIsActiveStakingState(state));
  const hasLiquidStake = states.some((state) => state.type === 'liquid' && getIsActiveStakingState(state));

  if (shouldUseNominators && !hasLiquidStake) {
    states = states.filter((state) => state.type !== 'liquid');
  }

  if (!shouldUseNominators && !hasNominatorsStake) {
    states = states.filter((state) => state.type !== 'nominators');
  }

  return states
    .filter((state) => tokenBySlug[state.tokenSlug])
    .map<AmountInputToken>((state) => ({
      ...tokenBySlug[state.tokenSlug],
      id: state.id,
    }));
}
