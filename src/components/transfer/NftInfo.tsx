import React, { memo } from '../../lib/teact/teact';
import { getGlobal } from '../../global';

import type { NftTransfer } from '../../global/types';

import { ANIMATED_STICKER_TINY_SIZE_PX, TONSCAN_BASE_MAINNET_URL, TONSCAN_BASE_TESTNET_URL } from '../../config';
import buildClassName from '../../util/buildClassName';
import { openUrl } from '../../util/openUrl';
import { shortenAddress } from '../../util/shortenAddress';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useLang from '../../hooks/useLang';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';

import styles from './NftInfo.module.scss';

interface OwnProps {
  nft?: NftTransfer;
  isStatic?: boolean;
  withTonscan?: boolean;
}

function NftInfo({ nft, isStatic, withTonscan }: OwnProps) {
  const lang = useLang();

  const handleClick = () => {
    const tonscanBaseUrl = getGlobal().settings.isTestnet ? TONSCAN_BASE_TESTNET_URL : TONSCAN_BASE_MAINNET_URL;
    const tonscanUrl = `${tonscanBaseUrl}nft/${nft!.address}`;

    openUrl(tonscanUrl);
  };

  if (!nft) {
    return (
      <div className={buildClassName(styles.root, isStatic && styles.rootStatic)}>
        <AnimatedIconWithPreview
          play
          noLoop={false}
          nonInteractive
          size={ANIMATED_STICKER_TINY_SIZE_PX}
          className={styles.thumbnail}
          tgsUrl={ANIMATED_STICKERS_PATHS.wait}
          previewUrl={ANIMATED_STICKERS_PATHS.waitPreview}
        />

        <div className={styles.info}>
          <div className={styles.title}>NFT</div>
          <div className={styles.description}>
            {lang('Name and collection are not available. Please check back later.')}
          </div>
        </div>
      </div>
    );
  }

  const name = nft.name || shortenAddress(nft.address);

  function renderContent() {
    return (
      <>
        <img src={nft!.thumbnail} alt={name} className={styles.thumbnail} />

        <div className={styles.info}>
          <div className={styles.title}>
            {name}
            {withTonscan && <i className={buildClassName(styles.icon, 'icon-tonscan')} aria-hidden />}
          </div>
          <div className={styles.description}>{nft!.collectionName}</div>
        </div>
      </>
    );
  }

  if (withTonscan) {
    return (
      <button
        type="button"
        className={buildClassName(styles.root, isStatic && styles.rootStatic, styles.interactive)}
        title={lang('Open on TONScan')}
        onClick={handleClick}
      >
        {renderContent()}
      </button>
    );
  }

  return (
    <div className={buildClassName(styles.root, isStatic && styles.rootStatic)}>
      {renderContent()}
    </div>
  );
}

export default memo(NftInfo);
