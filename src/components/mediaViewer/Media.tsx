import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import { MediaType } from '../../global/types';

import { selectCurrentAccountState } from '../../global/selectors';

import styles from './MediaViewer.module.scss';

interface OwnProps {
  // eslint-disable-next-line react/no-unused-prop-types
  mediaId: string;
}

interface StateProps {
  alt?: string;
  thumbnail?: string;
  image?: string;
}

function Media({ alt, thumbnail, image }: OwnProps & StateProps) {
  const src = image || thumbnail;

  return (
    <div className={styles.content}>
      <img src={src} alt={alt} className={styles.image} />
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, { mediaId }): StateProps => {
  const { mediaType = MediaType.Nft } = global.mediaViewer || {};

  if (mediaType === MediaType.Nft) {
    const { byAddress } = selectCurrentAccountState(global)?.nfts || {};
    const nft = byAddress?.[mediaId];
    if (!nft) {
      return {};
    }

    return {
      alt: nft.name,
      thumbnail: nft.thumbnail,
      image: nft.image,
    };
  }

  return {};
})(Media));
