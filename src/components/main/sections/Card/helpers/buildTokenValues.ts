import type { UserToken } from '../../../../../global/types';

import { calcChangeValue } from '../../../../../util/calcChangeValue';
import { formatInteger } from '../../../../../util/formatNumber';
import { round } from '../../../../../util/round';

import styles from '../Card.module.scss';

export function buildTokenValues(tokens: UserToken[]) {
  const primaryValue = tokens.reduce((acc, token) => acc + token.amount * token.price, 0);
  const [primaryWholePart, primaryFractionPart] = formatInteger(primaryValue).split('.');
  const changeValue = round(tokens.reduce((acc, token) => {
    return acc + calcChangeValue(token.amount * token.price, token.change24h);
  }, 0), 4);

  const changePercent = round(primaryValue ? (changeValue / (primaryValue - changeValue)) * 100 : 0, 2);
  const changeClassName = changePercent > 0
    ? styles.changeCourseUp
    : (changePercent < 0 ? styles.changeCourseDown : undefined);
  const changePrefix = changeValue > 0 ? '↑' : changeValue < 0 ? '↓' : undefined;

  return {
    primaryValue,
    primaryWholePart,
    primaryFractionPart,
    changeClassName,
    changePrefix,
    changePercent,
    changeValue,
  };
}
