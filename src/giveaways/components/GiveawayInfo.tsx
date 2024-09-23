import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { formatFullDay, formatTime, getCountDaysToDate } from '../../util/dateFormat';
import { type Giveaway, isGiveawayExpired } from '../utils/giveaway';

import CalendarIcon, { CalendarIconState } from './CalendarIcon';

import styles from './GiveawayInfo.module.scss';

enum GiveawayEndType {
  Date = 'date',
  Slots = 'slots',
}

interface OwnProps {
  giveaway: Giveaway;
}

function getPlacesLeftText(placesLeft: number) {
  if (placesLeft === 1) return `${placesLeft} prize left`;

  return `${placesLeft} prizes left`;
}

function GiveawayInfo({ giveaway }: OwnProps) {
  const {
    receiverCount, participantCount, endsAt, status,
  } = giveaway;

  if (!endsAt) {
    // eslint-disable-next-line no-null/no-null
    return null;
  }

  const giveawayEndType = endsAt ? GiveawayEndType.Date : GiveawayEndType.Slots;

  const endDateText = endsAt
    ? `${formatFullDay('en', endsAt)} ${formatTime(endsAt)}`
    : `${participantCount}/${receiverCount}`;
  const giveawayEndInfo = endsAt
    ? `${getCountDaysToDate(endsAt)} ${getCountDaysToDate(endsAt) === 1 ? 'day' : 'days'} left`
    : getPlacesLeftText(receiverCount - participantCount);
  const isExpired = status === 'finished' ? true : endsAt ? isGiveawayExpired(endsAt) : false;

  const iconType = isExpired ? CalendarIconState.FAILED : CalendarIconState.NORMAL;
  const endTypeText = giveawayEndType === GiveawayEndType.Date ? 'End Date' : 'Number of prizes';

  return (
    <div className={styles.container}>
      <div className={styles.sectionFlex}>
        <CalendarIcon type={iconType} className={styles.calendarIcon} />
        <span className={styles.sectionFlexText}>{endTypeText}</span>
      </div>
      <div className={buildClassName(styles.section, styles.sectionRight)}>
        <div className={isExpired ? styles.textExpired : undefined}>{endDateText}</div>
        <div className={buildClassName(styles.description, isExpired ? styles.textExpired : undefined)}>
          {
            isExpired
              ? 'giveaway finished'
              : giveawayEndInfo
          }
        </div>
      </div>
    </div>
  );
}

export default memo(GiveawayInfo);
