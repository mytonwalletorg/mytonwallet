import React, { memo } from '../../lib/teact/teact';

import type { Giveaway } from '../utils/giveaway';

import CommonPage from '../components/CommonPage';
import GiveawayInfo from '../components/GiveawayInfo';
import ImageSection, { ImageSectionStatus } from '../components/ImageSection';

import titleStyles from './Title.module.scss';

interface OwnProps {
  onConnectClick: any;
  giveaway: Giveaway;
}

function ConnectPage({ onConnectClick, giveaway }: OwnProps) {
  return (
    <CommonPage onConnectClick={onConnectClick}>
      <ImageSection status={ImageSectionStatus.Logo} />
      <div className={titleStyles.title}>Giveaway</div>
      <GiveawayInfo giveaway={giveaway} />
    </CommonPage>
  );
}

export default memo(ConnectPage);
