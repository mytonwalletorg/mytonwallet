import React, { memo } from '../../lib/teact/teact';

import type { ApiNft } from '../../api/types';

import { BURN_ADDRESS, BURN_CHUNK_DURATION_APPROX_SEC, NOTCOIN_VOUCHERS_ADDRESS } from '../../config';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Loading from '../ui/Loading';
import ModalHeader from '../ui/ModalHeader';
import NftChips from './NftChips';
import NftInfo from './NftInfo';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Transfer.module.scss';

interface OwnProps {
  nfts: ApiNft[];
  sentNftsCount?: number;
  toAddress?: string;
  onClose: NoneToVoidFunction;
}

function TransferMultiNftProcess({
  nfts,
  sentNftsCount = 0,
  toAddress,
  onClose,
}: OwnProps) {
  const lang = useLang();

  const isInProgress = sentNftsCount < nfts.length;
  const isBurning = toAddress === BURN_ADDRESS;
  const isNotcoinVouchers = nfts.some((nft) => nft.collectionAddress === NOTCOIN_VOUCHERS_ADDRESS);
  const title = isInProgress ? lang(
    `${isBurning ? 'Burning' : 'Sending'}: %n% of %m% NFTs...`, { n: sentNftsCount, m: nfts.length },
  ) : lang('Sent');
  const duration = (Math.ceil(nfts.length / 4) * BURN_CHUNK_DURATION_APPROX_SEC) / 60;

  return (
    <>
      <ModalHeader title={title} />

      <div className={modalStyles.transitionContent}>
        {isInProgress && (
          <>
            <Loading className={styles.spinner} />
            <div className={styles.infoBox}>{lang('$multi_send_nft_warning', { duration })}</div>
          </>
        )}
        {isNotcoinVouchers && isBurning && (
          <div className={styles.infoBox}>
            {lang('$multi_burn_nft_warning_notcoin', {
              notcoin_bot: (
                <a href="https://t.me/notcoin_bot" target="_blank" rel="noreferrer">Notcoin Bot</a>
              ),
            })}
          </div>
        )}
        {nfts!.length === 1 ? <NftInfo nft={nfts![0]} /> : <NftChips nfts={nfts!} />}
        {!isInProgress && (
          <div className={modalStyles.buttons}>
            <Button onClick={onClose} isPrimary>{lang('Close')}</Button>
          </div>
        )}
      </div>
    </>
  );
}

export default memo(TransferMultiNftProcess);
