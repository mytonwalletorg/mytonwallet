import type { UserToken } from '../../../../../global/types';

import { TONCOIN_SLUG } from '../../../../../config';
import { Big } from '../../../../../lib/big.js';
import { calcBigChangeValue } from '../../../../../util/calcChangeValue';
import { toBig } from '../../../../../util/decimals';
import { formatInteger } from '../../../../../util/formatNumber';
import { round } from '../../../../../util/math';

import styles from '../Card.module.scss';

export function calculateFullBalance(tokens: UserToken[], stakingBalance = 0n) {
  const primaryValue = tokens.reduce((acc, token) => {
    if (token.slug === TONCOIN_SLUG) {
      const stakingAmount = toBig(stakingBalance, token.decimals).mul(token.price);
      acc = acc.plus(stakingAmount);
    }

    return acc.plus(token.totalValue);
  }, Big(0));

  const [primaryWholePart, primaryFractionPart] = formatInteger(primaryValue).split('.');
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
