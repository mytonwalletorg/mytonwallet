import React, { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiNft } from '../../../../api/types';
import { MediaType } from '../../../../global/types';

import buildClassName from '../../../../util/buildClassName';
import { shortenAddress } from '../../../../util/shortenAddress';

import useFlag from '../../../../hooks/useFlag';

import NftImage from './NftImage';
import NftMenu from './NftMenu';

import styles from './Nft.module.scss';

interface OwnProps {
  nft: ApiNft;
}

function Nft({ nft }: OwnProps) {
  const { openMediaViewer } = getActions();
  const [isMenuOpen, openMenu, closeMenu] = useFlag(false);

  return (
    <div
      key={nft.address}
      id={`nft-${nft.address}`}
      onClick={() => openMediaViewer({ mediaId: nft.address, mediaType: MediaType.Nft })}
      className={buildClassName(styles.item, nft.isOnSale && styles.item_onSale, isMenuOpen && styles.itemWithMenu)}
    >
      <NftMenu nft={nft} isOpen={isMenuOpen} onOpen={openMenu} onClose={closeMenu} />
      <NftImage
        nft={nft}
        className={styles.imageWrapper}
        imageClassName={styles.image}
      />
      <div className={styles.infoWrapper}>
        <b className={styles.title}>{nft.name || shortenAddress(nft.address, 4)}</b>
      </div>
      <div className={styles.collection}>{nft.collectionName}</div>
    </div>
  );
}

export default memo(Nft);
