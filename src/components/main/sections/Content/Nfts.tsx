import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX, GETGEMS_BASE_MAINNET_URL, GETGEMS_BASE_TESTNET_URL } from '../../../../config';
import renderText from '../../../../global/helpers/renderText';
import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getCapacitorPlatform } from '../../../../util/capacitor';
import { shortenAddress } from '../../../../util/shortenAddress';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useLang from '../../../../hooks/useLang';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Image from '../../../ui/Image';
import Loading from '../../../ui/Loading';

import styles from './Nft.module.scss';

interface OwnProps {
  isActive?: boolean;
}

interface StateProps {
  orderedAddresses?: string[];
  byAddress?: Record<string, ApiNft>;
  isTestnet?: boolean;
}

function Nfts({
  isActive, orderedAddresses, byAddress, isTestnet,
}: OwnProps & StateProps) {
  const { isLandscape } = useDeviceScreen();
  const lang = useLang();

  const getgemsBaseUrl = isTestnet ? GETGEMS_BASE_TESTNET_URL : GETGEMS_BASE_MAINNET_URL;

  const nfts = useMemo(() => {
    if (!orderedAddresses || !byAddress) {
      return undefined;
    }

    return orderedAddresses.map((address) => byAddress[address]).filter(Boolean);
  }, [byAddress, orderedAddresses]);

  if (nfts === undefined) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}>
        <Loading />
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className={styles.emptyList}>
        <AnimatedIconWithPreview
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.happy}
          previewUrl={ANIMATED_STICKERS_PATHS.happyPreview}
          size={ANIMATED_STICKER_BIG_SIZE_PX}
          className={styles.sticker}
          noLoop={false}
          nonInteractive
        />
        <p className={styles.emptyListTitle}>{lang('No NFTs yet')}</p>
        { getCapacitorPlatform() !== 'ios' && (
          <>
            <p className={styles.emptyListText}>{renderText(lang('$nft_explore_offer'))}</p>
            <a className={styles.emptyListButton} href={getgemsBaseUrl} rel="noreferrer noopener" target="_blank">
              {lang('Open Getgems')}
            </a>
          </>
        ) }
      </div>
    );
  }

  return (
    <div className={buildClassName(styles.list, isLandscape && styles.landscapeList)}>
      {nfts.map((nft) => (
        <a
          href={`${getgemsBaseUrl}collection/${nft.collectionAddress}/${nft.address}`}
          className={buildClassName(styles.item, nft.isOnSale && styles.item_onSale)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image url={nft.thumbnail} className={styles.imageWrapper} imageClassName={styles.image} />
          <div className={styles.infoWrapper}>
            <b className={styles.title}>{nft.name || shortenAddress(nft.address, 4)}</b>
          </div>
          <div className={styles.collection}>{nft.collectionName}</div>
        </a>
      ))}
    </div>
  );
}
export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const { orderedAddresses, byAddress } = selectCurrentAccountState(global)?.nfts || {};

      return {
        orderedAddresses,
        byAddress,
        isTestnet: global.settings.isTestnet,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Nfts),
);
