import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './CalendarIcon.module.scss';

export enum CalendarIconState {
  NORMAL = 'normal',
  FAILED = 'failed',
}

interface OwnProps {
  type: CalendarIconState;
  className?: string;
}

function CalendarIcon({ type, className }: OwnProps) {
  return (
    <svg
      className={
        buildClassName(
          type === CalendarIconState.FAILED
            ? styles.failed
            : styles.success,
          className,
        )
      }
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clip-path="url(#clip0_15804_30504)">
        <path
          className={styles.calendarIconFill}

          d="M18 36C27.9411 36 36 27.9411 36 18C36 8.05887 27.9411 0 18 0C8.05887 0 0 8.05887 0 18C0 27.9411 8.05887 36 18 36Z"
        />
        <path
          className={styles.calendarIconStroke}
          d="M14.8 9.6001V12.8001M21.2 9.6001V12.8001"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          className={styles.calendarIconStroke}

          d="M23.6 11.2002H12.4C11.5164 11.2002 10.8 11.9165 10.8 12.8002V24.0002C10.8 24.8839 11.5164 25.6002 12.4 25.6002H23.6C24.4837 25.6002 25.2 24.8839 25.2 24.0002V12.8002C25.2 11.9165 24.4837 11.2002 23.6 11.2002Z"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          className={styles.calendarIconStroke}
          d="M10.8 16H25.2"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_15804_30504">
          <rect width="36" height="36" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

export default memo(CalendarIcon);
