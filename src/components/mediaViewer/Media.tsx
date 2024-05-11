import React, { memo, useEffect, useRef } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import { MediaType } from '../../global/types';

import { requestMutation } from '../../lib/fasterdom/fasterdom';
import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';

import styles from './MediaViewer.module.scss';

interface OwnProps {
  // eslint-disable-next-line react/no-unused-prop-types
  mediaId: string;
}

interface StateProps {
  alt?: string;
  thumbnail?: string;
  image?: string;
  description?: string;
}

function Media({
  alt, thumbnail, image, description,
}: OwnProps & StateProps) {
  const src = image || thumbnail;
  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement | null>(null);
  const { isPortrait } = useDeviceScreen();

  useEffect(() => {
    const element = ref.current!;
    const { height } = element.getBoundingClientRect();
    requestMutation(() => {
      // Inner scroll requires max-height to be set
      element.style.setProperty('--max-height', `${height}px`);
    });
  }, [isPortrait]);

  return (
    <div className={styles.content}>
      <img src={src} alt={alt} className={styles.image} />
      <div className={styles.contentDescription} ref={ref}>
        {description && (
          <div className={styles.contentTextWrapper}>
            <div className={buildClassName(styles.contentText, 'custom-scroll')} dir="auto">
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

  return {
    alt: nft.name,
    thumbnail: nft.thumbnail,
    image: nft.image,
    description: nft.description,
  };
})(Media));
