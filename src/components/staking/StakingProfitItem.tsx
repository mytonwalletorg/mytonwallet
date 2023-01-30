import React, { memo } from '../../lib/teact/teact';

import type { UserToken } from '../../global/types';

import buildClassName from '../../util/buildClassName';
import { formatHumanDay, formatTime } from '../../util/dateFormat';
import { formatCurrencyExtended } from '../../util/formatNumber';
import useLang from '../../hooks/useLang';

import styles from './StakingProfileItem.module.scss';

interface OwnProps {
  tonToken: UserToken;
  timestamp: number;
  profit: number;
}

function StakingProfitItem({ tonToken, timestamp, profit }: OwnProps) {
  const lang = useLang();

  return (
    <div className={styles.item}>
      <i className={buildClassName(styles.icon, 'icon-earn')} aria-hidden />
      <div className={styles.leftBlock}>
        <div className={styles.operationName}>{lang('Earned')}</div>
        <div className={styles.date}>{formatHumanDay(lang, timestamp)}, {formatTime(timestamp)}</div>
      </div>
      <div className={styles.amount}>
        {formatCurrencyExtended(profit, tonToken.symbol)}
      </div>
    </div>
  );
}

export default memo(StakingProfitItem);
