import type { Wallet } from '@tonconnect/sdk';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import {
  DAY,
  formatFullDay,
  formatTime,
  HOUR,
  MINUTE,
} from '../../util/dateFormat';
import {
  type Giveaway, GiveawayStatus, GiveawayType, isGiveawayExpired,
} from '../utils/giveaway';

import CalendarIcon, { CalendarIconState } from './CalendarIcon';

import styles from './GiveawayInfo.module.scss';

interface OwnProps {
  giveaway: Giveaway;
  wallet?: Wallet;
}

export function formatCountdown(datetime: string | number | Date): string {
  const now = Date.now();
  const targetTime = new Date(datetime).getTime();
  const timeDiff = targetTime - now;

  const minutesLeft = Math.floor(timeDiff / MINUTE);
  const hoursLeft = Math.floor(timeDiff / HOUR);
  const daysLeft = Math.floor(timeDiff / DAY);

  if (daysLeft > 0) {
    return `${daysLeft} ${daysLeft === 1 ? 'Day' : 'Days'} Left`;
  }

  if (hoursLeft > 0) {
    return `${hoursLeft} ${hoursLeft === 1 ? 'Hour' : 'Hours'} Left`;
  }

  if (minutesLeft > 0) {
    return `${minutesLeft} ${minutesLeft === 1 ? 'Minute' : 'Minutes'} Left`;
  }

  return 'Less Than A Minute';
}

function GiveawayInfo({ giveaway, wallet }: OwnProps) {
  const { endsAt, status, type } = giveaway;

  if (
    type === GiveawayType.Instant
    && status === GiveawayStatus.Finished
    && !wallet
  ) {
    return (
      <div className={styles.instantBadge}>
        Giveaway Finished
      </div>
    );
  }

  if (!endsAt) {
    // eslint-disable-next-line no-null/no-null
    return null;
  }

  const endDateText = `${formatFullDay('en', endsAt)} ${formatTime(endsAt)}`;

  const isExpired = status === GiveawayStatus.Finished || isGiveawayExpired(endsAt);

  const iconType = isExpired ? CalendarIconState.FAILED : CalendarIconState.NORMAL;

  return (
    <div className={styles.container}>
      <div className={styles.sectionFlex}>
        <CalendarIcon type={iconType} className={styles.calendarIcon} />
        <div className={styles.sectionFlexText}>
          <span className={buildClassName(styles.textSmall, styles.description, styles.sectionFlexItem)}>End Date</span>
          <div className={styles.sectionFlexItem}>
            {endDateText}
          </div>
        </div>
      </div>
      <div className={buildClassName(styles.section, styles.sectionRight)}>
        <div className={isExpired ? styles.textExpired : undefined}>
          {
            isExpired
              ? 'Giveaway Finished'
              : formatCountdown(endsAt)
          }
        </div>
      </div>
    </div>
  );
}

export default memo(GiveawayInfo);
