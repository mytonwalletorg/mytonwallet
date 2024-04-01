import React, { memo } from '../../../../lib/teact/teact';

import type { ApiNft } from '../../../../api/types';

import { preloadImage } from '../../../../util/preloadImage';

import useLastCallback from '../../../../hooks/useLastCallback';

import Image from '../../../ui/Image';

interface OwnProps {
  nft: ApiNft;
  className?: string;
  imageClassName?: string;
}

function NftImage({
  nft, className, imageClassName,
}: OwnProps) {
  const handleIntersect = useLastCallback(() => {
    preloadImage(nft.image).catch(() => {});
  });

  return (
    <Image
      url={nft.thumbnail}
      className={className}
      imageClassName={imageClassName}
      onIntersect={handleIntersect}
    />
  );
}

export default memo(NftImage);
