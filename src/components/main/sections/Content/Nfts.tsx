import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft } from '../../../../api/types';

import {
  ANIMATED_STICKER_BIG_SIZE_PX,
  ANIMATED_STICKER_SMALL_SIZE_PX,
  NFT_MARKETPLACE_TITLE,
  NFT_MARKETPLACE_URL,
  TELEGRAM_GIFTS_SUPER_COLLECTION,
} from '../../../../config';
import renderText from '../../../../global/helpers/renderText';
import { selectCurrentAccountState, selectIsCurrentAccountViewMode } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import captureEscKeyListener from '../../../../util/captureEscKeyListener';
import { getTonDnsExpirationDate } from '../../../../util/dns';
import { stopEvent } from '../../../../util/domEvents';
import { openUrl } from '../../../../util/openUrl';
import { getHostnameFromUrl } from '../../../../util/url';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import { useIntersectionObserver } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

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
  dnsExpiration?: Record<string, number>;
  isViewAccount?: boolean;
}

const INTERSECTION_THROTTLE = 200;
const INITIAL_SLICE_LENGTH = 50;
const SCROLL_THRESHOLD = 800;

function Nfts({
  isActive,
  orderedAddresses,
  selectedAddresses,
  byAddress,
  currentCollectionAddress,
  dnsExpiration,
  isNftBuyingDisabled,
  blacklistedNftAddresses,
  whitelistedNftAddresses,
  isViewAccount,
}: OwnProps & StateProps) {
  const { clearNftsSelection } = getActions();

  const lang = useLang();
  const containerRef = useRef<HTMLDivElement>();
  const { isPortrait, isLandscape } = useDeviceScreen();
  const hasSelection = Boolean(selectedAddresses?.length);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerClosest = isPortrait ? '.app-slide-content' : '.nfts-container';

  useEffect(clearNftsSelection, [clearNftsSelection, isActive, currentCollectionAddress]);
  useEffect(() => (hasSelection ? captureEscKeyListener(clearNftsSelection) : undefined), [hasSelection]);

  const nfts = useMemo(() => {
    if (!orderedAddresses || !byAddress) {
      return undefined;
    }

    const blacklistedNftAddressesSet = new Set(blacklistedNftAddresses);
    const whitelistedNftAddressesSet = new Set(whitelistedNftAddresses);

    const result = orderedAddresses.reduce<ApiNft[]>((acc, address) => {
      const nft = byAddress[address];

      if (nft && (
        !currentCollectionAddress
        || nft.collectionAddress === currentCollectionAddress
        || (currentCollectionAddress === TELEGRAM_GIFTS_SUPER_COLLECTION && nft.isTelegramGift)
      ) && (
        !nft.isHidden || whitelistedNftAddressesSet.has(nft.address)
      ) && (
        !blacklistedNftAddressesSet.has(nft.address)
      )) {
        acc.push(nft);
      }

      return acc;
    }, []);

    return isScrolled ? result : result.slice(0, INITIAL_SLICE_LENGTH);
  }, [
    byAddress, currentCollectionAddress, orderedAddresses, blacklistedNftAddresses, whitelistedNftAddresses,
    isScrolled,
  ]);

  const handleNativeScroll = useLastCallback(() => {
    const closestScrollContainer = containerRef.current?.closest<HTMLDivElement>(scrollContainerClosest);
    if (!closestScrollContainer || isScrolled) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = closestScrollContainer;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceToBottom <= SCROLL_THRESHOLD) {
      setIsScrolled(true);
    }
  });

  useLayoutEffect(() => {
    if (!scrollContainerClosest || !nfts?.length) return undefined;

    const closestScrollContainer = containerRef.current?.closest<HTMLDivElement>(scrollContainerClosest);
    if (!closestScrollContainer) return undefined;

    closestScrollContainer.addEventListener('scroll', handleNativeScroll);

    return () => {
      closestScrollContainer.removeEventListener('scroll', handleNativeScroll);
    };
  }, [nfts?.length, scrollContainerClosest]);

  const { observe: observeIntersection } = useIntersectionObserver({
    throttleMs: INTERSECTION_THROTTLE,
    isDisabled: !nfts?.length,
  });

  function handleNftMarketplaceClick(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    stopEvent(e);

    void openUrl(NFT_MARKETPLACE_URL, {
      title: NFT_MARKETPLACE_TITLE,
      subtitle: getHostnameFromUrl(NFT_MARKETPLACE_URL),
    });
  }

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
          size={isPortrait ? ANIMATED_STICKER_SMALL_SIZE_PX : ANIMATED_STICKER_BIG_SIZE_PX}
          className={styles.sticker}
          noLoop={false}
          nonInteractive
        />
        <div className={styles.emptyListContent}>
          <p className={styles.emptyListTitle}>{lang('No NFTs yet')}</p>
          {!isNftBuyingDisabled && (
            <>
              <p className={styles.emptyListText}>
                {renderText(lang('$nft_explore_offer'), isPortrait ? ['simple_markdown'] : undefined)}
              </p>
              <button type="button" className={styles.emptyListButton} onClick={handleNftMarketplaceClick}>
                {lang('Open %nft_marketplace%', { nft_marketplace: NFT_MARKETPLACE_TITLE })}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <Transition
      ref={containerRef}
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
          tonDnsExpiration={getTonDnsExpirationDate(nft, dnsExpiration)}
          isViewAccount={isViewAccount}
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
        dnsExpiration,
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
        dnsExpiration,
        isViewAccount: selectIsCurrentAccountViewMode(global),
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
