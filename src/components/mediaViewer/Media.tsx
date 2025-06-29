import React, {
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import { MediaType } from '../../global/types';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useLang from '../../hooks/useLang';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';

import styles from './MediaViewer.module.scss';

import scamImg from '../../assets/scam.svg';

interface OwnProps {

  mediaId: string;
}

interface StateProps {
  alt?: string;
  thumbnail?: string;
  image?: string;
  lottie?: string;
  description?: string;
  isScam?: boolean;
  whitelistedMediaIds?: string[];
}

const ANIMATED_ICON_SIZE = 250; // Preview size (500px) / 2

function Media({
  mediaId, alt, thumbnail, image, lottie, description, isScam, whitelistedMediaIds,
}: OwnProps & StateProps) {
  const lang = useLang();
  const src = image || thumbnail;
  const ref = useRef<HTMLDivElement>();
  const { isPortrait } = useDeviceScreen();

  useEffect(() => {
    const element = ref.current!;
    const { height } = element.getBoundingClientRect();
    requestMutation(() => {
      // Inner scroll requires max-height to be set
      element.style.setProperty('--max-height', `${height}px`);
    });
  }, [isPortrait]);

  const isNftWhiteListed = useMemo(() => {
    return whitelistedMediaIds?.includes(mediaId);
  }, [mediaId, whitelistedMediaIds]);

  return (
    <div className={styles.content}>
      {lottie ? (
        <AnimatedIconWithPreview
          size={ANIMATED_ICON_SIZE}
          shouldStretch
          play
          noLoop={false}
          tgsUrl={lottie}
          previewUrl={src}
          className={styles.image}
          noPreviewTransition
        />
      ) : (
        <img src={src} alt={alt} className={styles.image} />
      )}
      <div className={buildClassName(styles.contentDescription, 'custom-scroll')} ref={ref}>
        {description && (
          <div className={styles.contentTextWrapper}>
            <div className={buildClassName(styles.contentText, 'custom-scroll')} dir="auto">
              {isScam && !isNftWhiteListed && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
              {description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, { mediaId }): StateProps => {
  const { mediaType = MediaType.Nft } = global.mediaViewer || {};

  if (mediaType !== MediaType.Nft) return {};

  const { byAddress } = selectCurrentAccountState(global)?.nfts || {};
  const nft = byAddress?.[mediaId];
  if (!nft) return {};

  const { whitelistedNftAddresses } = selectCurrentAccountState(global) || {};

  return {
    alt: nft.name,
    thumbnail: nft.thumbnail,
    image: nft.image,
    lottie: nft.metadata?.lottie,
    description: nft.description,
    isScam: nft.isScam,
    whitelistedMediaIds: whitelistedNftAddresses,
  };
})(Media));
