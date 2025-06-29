import React, { memo } from '../../lib/teact/teact';

import { ANIMATED_STICKERS_PATHS } from '../../components/ui/helpers/animatedAssets';

import AnimatedIconWithPreview from '../../components/ui/AnimatedIconWithPreview';

import styles from './ImageSection.module.scss';

import logoPath from '../assets/logo.svg';

export enum ImageSectionStatus {
  Paid = 'paid',
  Lost = 'lost',
  AwaitingResults = 'awaitingResults',
  Logo = 'logo',
}

interface OwnProps {
  status: ImageSectionStatus;
}

const AnimationStickerContent = {
  [ImageSectionStatus.Paid]: {
    tgsUrl: ANIMATED_STICKERS_PATHS.happy,
    previewUrl: ANIMATED_STICKERS_PATHS.happyPreview,
  },
  [ImageSectionStatus.Lost]: {
    tgsUrl: ANIMATED_STICKERS_PATHS.noData,
    previewUrl: ANIMATED_STICKERS_PATHS.noDataPreview,

  },
  [ImageSectionStatus.AwaitingResults]: {
    tgsUrl: ANIMATED_STICKERS_PATHS.wait,
    previewUrl: ANIMATED_STICKERS_PATHS.waitPreview,
  },
};

function ImageSection({ status }: OwnProps) {
  if (status === ImageSectionStatus.Logo) {
    return (
      <div className={styles.imageWrapper}>
        <img className={styles.image} src={logoPath} alt="giveaway logo" />
      </div>
    );
  }

  return (
    <div className={styles.imageWrapper}>
      <AnimatedIconWithPreview
        play
        noLoop={false}
        nonInteractive
        size={160}
        className={styles.thumbnail}
        tgsUrl={AnimationStickerContent[status].tgsUrl}
        previewUrl={AnimationStickerContent[status].previewUrl}
      />
    </div>
  );
}

export default memo(ImageSection);
