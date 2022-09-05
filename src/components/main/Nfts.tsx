import React, { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiNft } from '../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX } from '../../config';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { shortenAddress } from '../../util/shortenAddress';
import buildClassName from '../../util/buildClassName';

import Loading from '../ui/Loading';
import Image from '../ui/Image';
import AnimatedIcon from '../ui/AnimatedIcon';

import styles from './Nft.module.scss';

interface OwnProps {
  isActive?: boolean;
}

interface StateProps {
  orderedAddresses?: string[];
  byAddress?: Record<string, ApiNft>;
}

function Nfts({ isActive, orderedAddresses, byAddress }: OwnProps & StateProps) {
  const { fetchNfts } = getActions();

  useEffect(() => {
    // TODO Infinite Scroll
    fetchNfts();
  }, [fetchNfts]);

  const nfts = useMemo(() => {
    if (!orderedAddresses || !byAddress) {
      return undefined;
    }

    return orderedAddresses.map((address) => byAddress[address]).filter(Boolean);
  }, [byAddress, orderedAddresses]);

  if (nfts === undefined) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}><Loading /></div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div className={styles.emptyList}>
        <AnimatedIcon
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.happy}
          size={ANIMATED_STICKER_BIG_SIZE_PX}
          noLoop={false}
          nonInteractive
        />
        <p className={styles.emptyListTitle}>No NFTs yet</p>
        <p className={styles.emptyListText}>
          Explore a marketplace to discover <br />
          existing NFT collections.
        </p>
        <a className={styles.emptyListButton} href="https://getgems.io/" rel="noreferrer noopener" target="_blank">
          Open Getgems
        </a>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {nfts.map((nft) => (
        <a
          href={`https://getgems.io/collection/${nft.collectionAddress}/${nft.address}`}
          className={buildClassName(styles.item, nft.isOnSale && styles.item_onSale)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image url={nft.thumbnail} className={styles.imageWrapper} imageClassName={styles.image} />
          <div className={styles.infoWrapper}>
            <strong className={styles.title}>{nft.name || shortenAddress(nft.address, 4)}</strong>
          </div>
          <div className={styles.collection}>{nft.collectionName}</div>
        </a>
      ))}
    </div>
  );
}
export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { orderedAddresses, byAddress } = global.nfts || {};

  return { orderedAddresses, byAddress };
})(Nfts));
