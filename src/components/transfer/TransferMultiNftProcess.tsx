import React, { memo } from '../../lib/teact/teact';

import type { NftTransfer } from '../../global/types';

import { BURN_ADDRESS, BURN_CHUNK_DURATION_APPROX_SEC } from '../../config';

import useLang from '../../hooks/useLang';

import Loading from '../ui/Loading';
import ModalHeader from '../ui/ModalHeader';
import NftChips from './NftChips';
import NftInfo from './NftInfo';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Transfer.module.scss';

interface OwnProps {
  nfts: NftTransfer[];
  sentNftsCount?: number;
  toAddress?: string;
}

function TransferMultiNftProcess({
  nfts,
  sentNftsCount = 0,
  toAddress,
}: OwnProps) {
  const lang = useLang();

  const isBurning = toAddress === BURN_ADDRESS;
  const title = lang(
    `${isBurning ? 'Burning' : 'Sending'}: %n% of %m% NFTs...`, { n: sentNftsCount, m: nfts.length },
  );
  const duration = (Math.ceil(nfts.length / 4) * BURN_CHUNK_DURATION_APPROX_SEC) / 60;

  return (
    <>
      <ModalHeader title={title} />

      <div className={modalStyles.transitionContent}>
        <Loading className={styles.spinner} />
        <div className={styles.infoBox}>{lang('$multi_burn_nft_warning_2', { duration })}</div>
        {nfts!.length === 1 ? <NftInfo nft={nfts![0]} /> : <NftChips nfts={nfts!} />}
      </div>
    </>
  );
}

export default memo(TransferMultiNftProcess);
