import { fromNano } from '@ton/core';
import type { Wallet } from '@tonconnect/sdk';
import React, { memo } from '../../lib/teact/teact';

import type { JettonMetadataInfo } from '../components/App';
import type { Giveaway } from '../utils/giveaway';

import { GiveawayStatus, ParticipantStatus } from '../utils/giveaway';

import CommonPage from '../components/CommonPage';
import GiveawayInfo from '../components/GiveawayInfo';
import ImageSection, { ImageSectionStatus } from '../components/ImageSection';
import TokenInfo from '../components/TokenInfo';

import styles from './GiveawayInfoPage.module.scss';
import titleStyles from './Title.module.scss';

interface OwnProps {
  wallet: Wallet;
  giveaway: Giveaway;
  participantStatus: ParticipantStatus;
  jettonMetadata?: JettonMetadataInfo;
}

function GiveawayInfoPage({
  wallet, giveaway, participantStatus, jettonMetadata,
}: OwnProps) {
  const { status: giveawayStatus } = giveaway;

  function renderAwaitingPageContent() {
    return (
      <>
        <ImageSection status={ImageSectionStatus.AwaitingResults} />
        <div className={titleStyles.title}>You are all set!</div>
        <div className={styles.giveawayInfoText}>Please wait for the results. Good luck!</div>
        <GiveawayInfo giveaway={giveaway} />
      </>
    );
  }

  function renderPaidPageContent() {
    return (
      <>
        <ImageSection status={ImageSectionStatus.Paid} />
        <div className={titleStyles.title}>Congratulations!</div>
        <div className={styles.giveawayInfoText}>
          <div>Your Reward</div>
          <TokenInfo
            amount={fromNano(giveaway.amount)}
            className={styles.tokenInfo}
            jettonMetadata={jettonMetadata}
          />
        </div>
        <div className={styles.giveawayInfoText}>You have received it on your wallet.</div>
      </>
    );
  }

  function renderPage() {
    if (participantStatus === ParticipantStatus.Paid) {
      return renderPaidPageContent();
    }

    if (giveawayStatus !== GiveawayStatus.Finished) {
      return renderAwaitingPageContent();
    }

    if (
      participantStatus === ParticipantStatus.AwaitingPayment
      || participantStatus === ParticipantStatus.AwaitingLottery
    ) {
      return renderAwaitingPageContent();
    }

    return (
      <>
        <ImageSection status={ImageSectionStatus.Lost} />
        <div className={titleStyles.title}>Giveaway Finished</div>
        <div className={styles.giveawayInfoText}>Unfortunately, you did not receive a<br />reward in it.</div>
      </>
    );
  }

  return (
    <CommonPage wallet={wallet}>
      {renderPage()}
    </CommonPage>
  );
}

export default memo(GiveawayInfoPage);
