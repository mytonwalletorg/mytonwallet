import { useEffect, useMemo } from '../lib/teact/teact';
import { getActions } from '../global';

import type { ApiVestingInfo } from '../api/types';
import type { UserToken } from '../global/types';

import calcUnfreezeEndDates from '../util/calcUnfreezeEndDates';
import { compact } from '../util/iteratees';
import { calcVestingAmountByStatus } from '../components/main/helpers/calcVestingAmountByStatus';
import useLastCallback from './useLastCallback';
import useShowTransition from './useShowTransition';

export default function useVesting({ vesting, userMycoin }: { vesting?: ApiVestingInfo[]; userMycoin?: UserToken }) {
  const { loadMycoin, openVestingModal } = getActions();

  const hasVesting = Boolean(vesting?.length);
  const isMycoinLoaded = Boolean(userMycoin);

  useEffect(() => {
    if (isMycoinLoaded || !hasVesting) return;

    loadMycoin();
  }, [hasVesting, isMycoinLoaded]);

  const amount = useMemo(() => {
    if (!hasVesting) return undefined;

    return calcVestingAmountByStatus(vesting!, ['frozen', 'ready']);
  }, [hasVesting, vesting]);

  const canBeUnfrozen = useMemo(() => {
    if (!hasVesting) return false;

    return vesting!.some((currentVesting) => currentVesting.parts.some(({ status }) => status === 'ready'));
  }, [hasVesting, vesting]);

  const unfreezeEndDate = useMemo(() => {
    if (!canBeUnfrozen) return undefined;

    return Math.min(...compact(calcUnfreezeEndDates(vesting!)));
  }, [canBeUnfrozen, vesting]);

  const {
    shouldRender,
    transitionClassNames,
  } = useShowTransition(Boolean(hasVesting && isMycoinLoaded && userMycoin));

  const onVestingTokenClick = useLastCallback(() => {
    openVestingModal();
  });

  return {
    shouldRender,
    transitionClassNames,
    amount,
    vestingStatus: canBeUnfrozen ? 'readyToUnfreeze' as const : 'frozen' as const,
    unfreezeEndDate,
    onVestingTokenClick,
  };
}
