import type { Wallet } from '@tonconnect/sdk';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { GiveawayStatus, type GiveawayWithTask } from '../utils/giveaway';

import useInterval from '../../hooks/useInterval';

import CommonPage from '../components/CommonPage';

import styles from './CompleteTaskPage.module.scss';

const FETCH_INTERVAL_MS = 5000;

interface OwnProps {
  giveaway: GiveawayWithTask;
  wallet: Wallet;
  loadParticipantStatus: () => void;
}

function CompleteTaskPage({ giveaway, wallet, loadParticipantStatus }: OwnProps) {
  useInterval(
    loadParticipantStatus,
    FETCH_INTERVAL_MS,
  );

  const url = new URL(giveaway.taskUrl);
  return (
    <CommonPage wallet={wallet} isGiveawayFinished={giveaway.status === GiveawayStatus.Finished}>

      <div className={styles.section}>
        <div className={styles.sectionText}>Complete the task:</div>
        <div className={styles.link}>
          <a href={url.href} className={styles.linkText}>{url.host}</a>
          <i className={buildClassName('icon icon-external', styles.fontIcon)} aria-hidden />
        </div>
      </div>

    </CommonPage>
  );
}

export default memo(CompleteTaskPage);
