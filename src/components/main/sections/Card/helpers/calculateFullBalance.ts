import type { ApiStakingState } from '../../../../../api/types';
import type { UserToken } from '../../../../../global/types';

import { Big } from '../../../../../lib/big.js';
import { calcBigChangeValue } from '../../../../../util/calcChangeValue';
import { toBig } from '../../../../../util/decimals';
import { formatNumber } from '../../../../../util/formatNumber';
import { buildCollectionByKey } from '../../../../../util/iteratees';
import { round } from '../../../../../util/math';

import styles from '../Card.module.scss';

export function calculateFullBalance(tokens: UserToken[], stakingStates?: ApiStakingState[]) {
  const stakingStateBySlug = buildCollectionByKey(stakingStates ?? [], 'tokenSlug');

  const primaryValue = tokens.reduce((acc, token) => {
    const stakingState = stakingStateBySlug[token.slug];

    if (stakingState) {
      let stakingAmount = toBig(stakingState.balance, token.decimals);
      if (stakingState.type === 'jetton') {
        stakingAmount = stakingAmount.plus(toBig(stakingState.unclaimedRewards, token.decimals));
      }
      acc = acc.plus(stakingAmount.mul(token.price));
    }

    return acc.plus(token.totalValue);
  }, Big(0));

  const [primaryWholePart, primaryFractionPart] = formatNumber(primaryValue).split('.');
  const changeValue = tokens.reduce((acc, token) => {
    return acc.plus(calcBigChangeValue(token.totalValue, token.change24h));
  }, Big(0)).round(4).toNumber();

  const changePercent = round(primaryValue ? (changeValue / (primaryValue.toNumber() - changeValue)) * 100 : 0, 2);
  const changeClassName = changePercent > 0
    ? styles.changeCourseUp
    : (changePercent < 0 ? styles.changeCourseDown : undefined);
  const changePrefix = changeValue > 0 ? '↑' : changeValue < 0 ? '↓' : undefined;

  return {
    primaryValue: primaryValue.toString(),
    primaryWholePart,
    primaryFractionPart,
    changeClassName,
    changePrefix,
    changePercent,
    changeValue,
  };
}
