import React, { memo, useEffect, useMemo } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX, TON_DIAMONDS_URL } from '../../../../config';
import renderText from '../../../../global/helpers/renderText';
import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import { useIntersectionObserver } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Spinner from '../../../ui/Spinner';
import Transition from '../../../ui/Transition';
import Nft from './Nft';

import styles from './Nft.module.scss';

interface OwnProps {
  isActive?: boolean;
}

interface StateProps {
  orderedAddresses?: string[];
  selectedAddresses?: string[];
  byAddress?: Record<string, ApiNft>;
  currentCollectionAddress?: string;
  blacklistedNftAddresses?: string[];
  whitelistedNftAddresses?: string[];
  isNftBuyingDisabled?: boolean;
}

const INTERSECTION_THROTTLE = 200;

function Nfts({
  isActive,
  orderedAddresses,
  selectedAddresses,
  byAddress,
  currentCollectionAddress,
  isNftBuyingDisabled,
  blacklistedNftAddresses,
  whitelistedNftAddresses,
}: OwnProps & StateProps) {
  const { clearNftsSelection } = getActions();

  const lang = useLang();
  const { isLandscape } = useDeviceScreen();
  const hasSelection = Boolean(selectedAddresses?.length);

  useEffect(clearNftsSelection, [clearNftsSelection, isActive, currentCollectionAddress]);
  useEffect(() => (hasSelection ? captureEscKeyListener(clearNftsSelection) : undefined), [hasSelection]);

  const nfts = useMemo(() => {
    if (!orderedAddresses || !byAddress) {
      return undefined;
    }

    const blacklistedNftAddressesSet = new Set(blacklistedNftAddresses);
    const whitelistedNftAddressesSet = new Set(whitelistedNftAddresses);

    return orderedAddresses
      .map((address) => byAddress[address])
      .filter((nft) => {
        if (!nft) return false;

        return !currentCollectionAddress || nft.collectionAddress === currentCollectionAddress;
      })
      .filter((nft) => (
        !nft.isHidden || whitelistedNftAddressesSet.has(nft.address)
      ) && !blacklistedNftAddressesSet.has(nft.address));
  }, [
    byAddress, currentCollectionAddress, orderedAddresses, blacklistedNftAddresses, whitelistedNftAddresses,
  ]);

  const { observe: observeIntersection } = useIntersectionObserver({
    throttleMs: INTERSECTION_THROTTLE,
    isDisabled: !nfts?.length,
  });

  if (nfts === undefined) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}>
        <Spinner />
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
        {!isNftBuyingDisabled && (
          <>
            <p className={styles.emptyListText}>{renderText(lang('$nft_explore_offer'))}</p>
            <a className={styles.emptyListButton} href={TON_DIAMONDS_URL} rel="noreferrer noopener" target="_blank">
              {lang('Open TON Diamonds')}
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <Transition
      name="fade"
      activeKey={nfts.length}
      shouldCleanup
      slideClassName={buildClassName(styles.list, isLandscape && styles.landscapeList)}
    >
      {nfts.map((nft) => (
        <Nft
          key={nft.address}
          nft={nft}
          selectedAddresses={selectedAddresses}
          observeIntersection={observeIntersection}
        />
      ))}
    </Transition>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const {
        orderedAddresses,
        byAddress,
        currentCollectionAddress,
        selectedAddresses,
      } = selectCurrentAccountState(global)?.nfts || {};
      const { isNftBuyingDisabled } = global.restrictions;

      const {
        blacklistedNftAddresses,
        whitelistedNftAddresses,
      } = selectCurrentAccountState(global) || {};

      return {
        orderedAddresses,
        selectedAddresses,
        byAddress,
        currentCollectionAddress,
        blacklistedNftAddresses,
        whitelistedNftAddresses,
        isNftBuyingDisabled,
      };
    },
    (global, _, stickToFirst) => {
      const {
        currentCollectionAddress,
      } = selectCurrentAccountState(global)?.nfts || {};

      return stickToFirst(`${global.currentAccountId}_${currentCollectionAddress || 'all'}`);
    },
  )(Nfts),
);
