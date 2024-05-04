import React, { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import { MediaType } from '../../../../global/types';

import buildClassName from '../../../../util/buildClassName';
import { vibrate } from '../../../../util/capacitor';
import { preloadImage } from '../../../../util/preloadImage';
import { shortenAddress } from '../../../../util/shortenAddress';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

import Image from '../../../ui/Image';
import NftMenu from './NftMenu';

import styles from './Nft.module.scss';

interface OwnProps {
  nft: ApiNft;
}

function Nft({ nft }: OwnProps) {
  const { openMediaViewer } = getActions();
  const [isMenuOpen, openMenu, closeMenu] = useFlag(false);

  function handleClick() {
    vibrate();
    openMediaViewer({ mediaId: nft.address, mediaType: MediaType.Nft });
  }

  const handleIntersect = useLastCallback(() => {
    preloadImage(nft.image).catch(() => {
    });
  });

  return (
    <div
      key={nft.address}
      id={`nft-${nft.address}`}
      onClick={handleClick}
      className={buildClassName(styles.item, nft.isOnSale && styles.item_onSale, isMenuOpen && styles.itemWithMenu)}
    >
      <NftMenu nft={nft} isOpen={isMenuOpen} onOpen={openMenu} onClose={closeMenu} />
      <Image
        url={nft.thumbnail}
        className={styles.imageWrapper}
        imageClassName={styles.image}
        onIntersect={handleIntersect}
      />
      <div className={styles.infoWrapper}>
        <b className={styles.title}>{nft.name || shortenAddress(nft.address, 4)}</b>
      </div>
      <div className={styles.collection}>{nft.collectionName}</div>
    </div>
  );
}

export default memo(Nft);
