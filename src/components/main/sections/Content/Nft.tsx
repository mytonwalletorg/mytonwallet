import React, {
  memo, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';
import { type IAnchorPosition, MediaType } from '../../../../global/types';

import buildClassName from '../../../../util/buildClassName';
import { vibrate } from '../../../../util/capacitor';
import { shortenAddress } from '../../../../util/shortenAddress';
import { IS_ANDROID, IS_IOS } from '../../../../util/windowEnvironment';

import useFlag from '../../../../hooks/useFlag';
import { useIsIntersecting } from '../../../../hooks/useIntersectionObserver';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useShowTransition from '../../../../hooks/useShowTransition';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Image from '../../../ui/Image';
import Radio from '../../../ui/Radio';
import NftMenu from './NftMenu';

import styles from './Nft.module.scss';

interface OwnProps {
  nft: ApiNft;
  selectedAddresses?: string[];
  observeIntersection: ObserveFn;
}

interface UseLottieReturnType {
  isLottie: boolean;
  shouldPlay?: boolean;
  noLoop?: boolean;
  markHover?: NoneToVoidFunction;
  unmarkHover?: NoneToVoidFunction;
}

function Nft({ nft, selectedAddresses, observeIntersection }: OwnProps) {
  const { openMediaViewer, selectNfts, clearNftSelection } = getActions();

  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  const {
    isLottie, shouldPlay, noLoop, markHover, unmarkHover,
  } = useLottie(nft, ref, observeIntersection);

  const [menuPosition, setMenuPosition] = useState<IAnchorPosition>();
  const isSelectionEnabled = !!selectedAddresses && selectedAddresses.length > 0;
  const isSelected = useMemo(() => selectedAddresses?.includes(nft.address), [selectedAddresses, nft.address]);
  const isMenuOpen = Boolean(menuPosition);
  const {
    shouldRender: shouldRenderWarning,
    transitionClassNames: warningTransitionClassNames,
  } = useShowTransition(isSelectionEnabled && nft.isOnSale);

  const fullClassName = buildClassName(
    styles.item,
    !isSelectionEnabled && nft.isOnSale && styles.item_onSale,
    isMenuOpen && styles.itemWithMenu,
    isSelectionEnabled && nft.isOnSale && styles.nonInteractive,
  );

  function handleClick() {
    if (isSelectionEnabled) {
      if (isSelected) {
        clearNftSelection({ address: nft.address });
      } else {
        selectNfts({ addresses: [nft.address] });
      }
      return;
    }

    vibrate();
    openMediaViewer({ mediaId: nft.address, mediaType: MediaType.Nft });
  }

  const handleOpenMenu = useLastCallback(() => {
    const { right: x, y } = ref.current!.getBoundingClientRect();
    setMenuPosition({ x, y });
  });

  const handleCloseMenu = useLastCallback(() => {
    setMenuPosition(undefined);
  });

  return (
    <div
      key={nft.address}
      ref={ref}
      data-nft-address={nft.address}
      className={fullClassName}
      onMouseEnter={markHover}
      onMouseLeave={unmarkHover}
      onClick={!isSelectionEnabled || !nft.isOnSale ? handleClick : undefined}
    >
      {isSelectionEnabled && !nft.isOnSale && (
        <Radio
          isChecked={isSelected}
          name="nft"
          value={nft.address}
          className={styles.radio}
        />
      )}
      {!isSelectionEnabled && (
        <NftMenu
          nft={nft}
          menuPosition={menuPosition}
          onOpen={handleOpenMenu}
          onClose={handleCloseMenu}
        />
      )}
      {isLottie ? (
        <div
          className={styles.imageWrapper}
        >
          <AnimatedIconWithPreview
            shouldStretch
            play={shouldPlay}
            noLoop={noLoop}
            tgsUrl={nft.metadata!.lottie}
            previewUrl={nft.thumbnail}
            noPreviewTransition
            className={buildClassName(styles.image, isSelected && styles.imageSelected)}
          />
        </div>
      ) : (
        <Image
          url={nft.thumbnail}
          className={styles.imageWrapper}
          imageClassName={buildClassName(styles.image, isSelected && styles.imageSelected)}
        />
      )}
      {shouldRenderWarning && (
        <div className={buildClassName(styles.warning, warningTransitionClassNames)}>
          {lang('For sale. Cannot be sent and burned')}
        </div>
      )}
      <div className={styles.infoWrapper}>
        <b className={styles.title}>{nft.name || shortenAddress(nft.address, 4)}</b>
      </div>
      <div className={styles.collection}>{nft.collectionName}</div>
    </div>
  );
}

export default memo(Nft);

function useLottie(
  nft: ApiNft,
  ref: React.RefObject<HTMLDivElement>,
  observeIntersection: ObserveFn,
): UseLottieReturnType {
  const isLottie = Boolean(nft.metadata?.lottie);

  const isIntersecting = useIsIntersecting(ref, isLottie ? observeIntersection : undefined);
  const [isHover, markHover, unmarkHover] = useFlag();

  if (!isLottie) {
    return { isLottie };
  }

  const shouldPlay = isIntersecting || isHover;
  const noLoop = !isHover;

  return {
    isLottie,
    shouldPlay,
    noLoop,
    ...!(IS_IOS || IS_ANDROID) && {
      markHover,
      unmarkHover,
    },
  };
}
