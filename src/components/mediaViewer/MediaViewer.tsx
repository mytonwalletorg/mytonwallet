import React, { memo, useEffect, useLayoutEffect } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { MediaType } from '../../global/types';

import { ANIMATION_END_DELAY } from '../../config';
import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { animateClosing, animateOpening, ANIMATION_DURATION } from './helpers/ghostAnimation';

import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';

import ShowTransition from '../ui/ShowTransition';
import Transition from '../ui/Transition';
import Actions from './Actions';
import MediaInfo from './MediaInfo';
import Slides from './Slides';

import styles from './MediaViewer.module.scss';

interface StateProps {
  mediaId?: string;
  mediaIds: string[];
  mediaUrl?: string;
  mediaType: MediaType;
  withAnimation: boolean;
}

function MediaViewer({
  mediaId, mediaIds, mediaType, mediaUrl, withAnimation,
}: StateProps) {
  const isOpen = Boolean(mediaId);
  const lang = useLang();
  const prevMediaId = usePrevious(mediaId);
  const headerAnimation = withAnimation ? 'slideFade' : 'none';
  const shouldAnimateOpening = withAnimation && isOpen && !prevMediaId;
  const shouldAnimateClosing = withAnimation && !isOpen && !!prevMediaId;

  const { closeMediaViewer, openMediaViewer } = getActions();

  const handleClose = useLastCallback(() => closeMediaViewer());

  const selectedMediaIndex = mediaIds.indexOf(mediaId!);

  const getMediaId = useLastCallback((fromId?: string, direction?: number): string | undefined => {
    if (fromId === undefined) return undefined;
    const index = mediaIds.indexOf(fromId);
    if ((direction === -1 && index > 0) || (direction === 1 && index < mediaIds.length - 1)) {
      return mediaIds[index + direction];
    }
    return undefined;
  });

  const selectMedia = useLastCallback((id: string) => {
    openMediaViewer({ mediaType, mediaId: id });
  });

  useLayoutEffect(() => {
    document.body.classList.toggle('is-media-viewer-open', isOpen);
  }, [isOpen]);

  useEffect(() => (isOpen ? captureEscKeyListener(handleClose) : undefined), [handleClose, isOpen]);

  useEffect(() => {
    if (shouldAnimateOpening) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateOpening(mediaType, mediaId, mediaUrl);
    }
    if (shouldAnimateClosing) {
      dispatchHeavyAnimationEvent(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(mediaType, prevMediaId);
    }
  }, [shouldAnimateOpening, shouldAnimateClosing, mediaId, mediaType, mediaUrl, prevMediaId]);

  return (
    <ShowTransition
      className={buildClassName(styles.root, 'opacity-transition', 'slow')}
      isOpen={isOpen}
      shouldAnimateFirstRender
      isCustom
    >
      <div className={styles.header} dir={lang.isRtl ? 'rtl' : undefined}>
        <Transition activeKey={selectedMediaIndex} name={headerAnimation} className={styles.headerTransition}>
          <MediaInfo mediaId={mediaId} />
        </Transition>
        <Actions mediaId={mediaId} onClose={handleClose} />
      </div>
      <Slides
        isOpen={isOpen}
        mediaId={mediaId}
        getMediaId={getMediaId}
        selectMedia={selectMedia}
        withAnimation={withAnimation}
        onClose={handleClose}
      />
    </ShowTransition>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { mediaId, mediaType = MediaType.Nft } = global.mediaViewer || {};
  const animationLevel = global.settings?.animationLevel;

  let mediaIds: string[] = MEMO_EMPTY_ARRAY;
  let mediaUrl: string | undefined;

  if (mediaType === MediaType.Nft) {
    const { orderedAddresses, byAddress } = selectCurrentAccountState(global)?.nfts || {};
    const nft = byAddress?.[mediaId!];
    mediaUrl = nft?.image || nft?.thumbnail;
    mediaIds = orderedAddresses || MEMO_EMPTY_ARRAY;
  }

  return {
    mediaId,
    mediaIds,
    mediaType,
    mediaUrl,
    withAnimation: animationLevel > 0,
  };
})(MediaViewer));
