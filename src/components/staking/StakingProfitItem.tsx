import React, { memo, useMemo } from '../../lib/teact/teact';

import type { UserToken } from '../../global/types';

import buildClassName from '../../util/buildClassName';
import { formatHumanDay, formatTime } from '../../util/dateFormat';
import { formatCurrencyExtended } from '../../util/formatNumber';
import getPseudoRandomNumber from '../../util/getPseudoRandomNumber';

import useLang from '../../hooks/useLang';

import SensitiveData from '../ui/SensitiveData';

import styles from './StakingProfileItem.module.scss';

interface OwnProps {
  tonToken: UserToken;
  timestamp: number;
  profit: string;
  isSensitiveDataHidden?: true;
}

function StakingProfitItem({
  tonToken, timestamp, profit, isSensitiveDataHidden,
}: OwnProps) {
  const lang = useLang();
  const amountCols = useMemo(() => getPseudoRandomNumber(4, 10, timestamp.toString()), [timestamp]);

  return (
    <div className={styles.item}>
      <i className={buildClassName(styles.icon, 'icon-earn')} aria-hidden />
      <div className={styles.leftBlock}>
        <div className={styles.operationName}>{lang('Earned')}</div>
        <div className={styles.date}>{formatHumanDay(lang, timestamp)}, {formatTime(timestamp)}</div>
      </div>
      <SensitiveData
        isActive={isSensitiveDataHidden}
        cellSize={8}
        rows={2}
        cols={amountCols}
        align="right"
        className={styles.amount}
      >
        {formatCurrencyExtended(profit, tonToken.symbol)}
      </SensitiveData>
    </div>
  );
}

export default memo(StakingProfitItem);
