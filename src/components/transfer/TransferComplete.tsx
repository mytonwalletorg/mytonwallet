import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiNft } from '../../api/types';

import { TONCOIN_SLUG } from '../../config';
import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import TransferResult from '../common/TransferResult';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import NftChips from './NftChips';
import NftInfo from './NftInfo';

import styles from '../common/TransferResult.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface OwnProps {
  isActive?: boolean;
  amount?: bigint;
  symbol: string;
  balance?: bigint;
  fee?: bigint;
  operationAmount?: bigint;
  txId?: string;
  tokenSlug?: string;
  toAddress?: string;
  comment?: string;
  decimals?: number;
  nfts?: ApiNft[];
  onInfoClick: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

const AMOUNT_PRECISION = 4;

function TransferComplete({
  isActive,
  amount,
  symbol,
  balance,
  fee,
  operationAmount,
  txId,
  tokenSlug,
  toAddress,
  comment,
  decimals,
  nfts,
  onInfoClick,
  onClose,
}: OwnProps) {
  const { startTransfer } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  const isNftTransfer = Boolean(nfts?.length);

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const handleTransactionRepeatClick = useLastCallback(() => {
    startTransfer({
      isPortrait,
      tokenSlug: tokenSlug || TONCOIN_SLUG,
      toAddress,
      amount,
      comment,
    });
  });

  return (
    <>
      <ModalHeader title={lang(isNftTransfer ? 'NFT has been sent!' : 'Coins have been sent!')} onClose={onClose} />

      <div className={modalStyles.transitionContent}>
        {isNftTransfer ? (
          <>
            <AnimatedIconWithPreview
              play={isActive}
              noLoop={false}
              nonInteractive
              className={styles.sticker}
              tgsUrl={ANIMATED_STICKERS_PATHS.thumbUp}
              previewUrl={ANIMATED_STICKERS_PATHS.thumbUpPreview}
            />
            {nfts!.length === 1 ? <NftInfo nft={nfts![0]} /> : <NftChips nfts={nfts!} />}
            {Boolean(txId) && (
              <div className={buildClassName(styles.buttons, styles.buttonsAfterNft)}>
                <Button className={styles.button} onClick={onInfoClick}>{lang('Details')}</Button>
              </div>
            )}
          </>
        ) : (
          <TransferResult
            playAnimation={isActive}
            amount={amount ? -amount : undefined}
            tokenSymbol={symbol}
            precision={AMOUNT_PRECISION}
            balance={balance}
            fee={fee ?? 0n}
            operationAmount={operationAmount ? -operationAmount : undefined}
            firstButtonText={txId ? lang('Details') : undefined}
            secondButtonText={lang('Repeat')}
            onFirstButtonClick={onInfoClick}
            onSecondButtonClick={handleTransactionRepeatClick}
            decimals={decimals}
          />
        )}

        <div className={modalStyles.buttons}>
          <Button onClick={onClose} isPrimary>{lang('Close')}</Button>
        </div>
      </div>
    </>
  );
}

export default memo(TransferComplete);
