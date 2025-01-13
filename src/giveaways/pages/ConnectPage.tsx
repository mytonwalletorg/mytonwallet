import type { Wallet } from '@tonconnect/sdk';
import React, { memo } from '../../lib/teact/teact';

import { type Giveaway, GiveawayStatus } from '../utils/giveaway';

import CommonPage from '../components/CommonPage';
import GiveawayInfo from '../components/GiveawayInfo';
import ImageSection, { ImageSectionStatus } from '../components/ImageSection';

import styles from './ConnectPage.module.scss';
import titleStyles from './Title.module.scss';

interface OwnProps {
  onConnectClick: any;
  giveaway: Giveaway;
  wallet?: Wallet;
}

function ConnectPage({ onConnectClick, giveaway, wallet }: OwnProps) {
  const isGiveawayFinished = giveaway.status === GiveawayStatus.Finished;
  return (
    <CommonPage onConnectClick={onConnectClick} isGiveawayFinished={isGiveawayFinished}>

      <ImageSection status={ImageSectionStatus.Logo} />
      <div className={titleStyles.title}>Giveaway</div>
      {!isGiveawayFinished && <p className={styles.description}>Connect MyTonWallet to participate in the giveaway.</p>}
      <GiveawayInfo giveaway={giveaway} wallet={wallet} />

    </CommonPage>
  );
}

export default memo(ConnectPage);
