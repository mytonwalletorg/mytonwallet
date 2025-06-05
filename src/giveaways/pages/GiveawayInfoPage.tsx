import type { Wallet } from '@tonconnect/sdk';
import React, { memo } from '../../lib/teact/teact';

import type { Giveaway, JettonMetadataInfo } from '../utils/giveaway';

import { toDecimal } from '../../util/decimals';
import { DEFAULT_DECIMALS } from '../../api/chains/ton/constants';
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
        <ImageSection key={ImageSectionStatus.AwaitingResults} status={ImageSectionStatus.AwaitingResults} />
        <div className={titleStyles.title}>You are all set!</div>
        <div className={styles.giveawayInfoText}>Please wait for the results. Good luck!</div>
        <GiveawayInfo giveaway={giveaway} />
      </>
    );
  }

  function renderPaidPageContent() {
    const decimals = jettonMetadata && 'decimals' in jettonMetadata
      ? Number(jettonMetadata.decimals)
      : DEFAULT_DECIMALS;

    return (
      <>
        <ImageSection key={ImageSectionStatus.Paid} status={ImageSectionStatus.Paid} />
        <div className={titleStyles.title}>Congratulations!</div>
        <div className={styles.giveawayInfoText}>
          <div>Your Reward</div>
          <TokenInfo
            amount={toDecimal(giveaway.amount, decimals)}
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
        <ImageSection key={ImageSectionStatus.Lost} status={ImageSectionStatus.Lost} />
        <div className={titleStyles.title}>Giveaway Finished</div>
        <div className={styles.giveawayInfoText}>Unfortunately, you did not receive a<br />reward in it.</div>
      </>
    );
  }

  return (
    <CommonPage wallet={wallet} isGiveawayFinished={giveaway.status === GiveawayStatus.Finished}>
      {renderPage()}
    </CommonPage>
  );
}

export default memo(GiveawayInfoPage);
