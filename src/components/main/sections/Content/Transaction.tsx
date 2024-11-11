import type { Ref, RefObject } from 'react';
import React, { memo, useMemo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiTokenWithPrice, ApiTransactionActivity } from '../../../../api/types';
import type { AppTheme, SavedAddress } from '../../../../global/types';
import { MediaType } from '../../../../global/types';

import { ANIMATED_STICKER_TINY_ICON_PX, TONCOIN } from '../../../../config';
import { getIsTxIdLocal } from '../../../../global/helpers';
import { bigintAbs } from '../../../../util/bigint';
import buildClassName from '../../../../util/buildClassName';
import { formatTime } from '../../../../util/dateFormat';
import { toDecimal } from '../../../../util/decimals';
import { formatCurrencyExtended } from '../../../../util/formatNumber';
import { shortenAddress } from '../../../../util/shortenAddress';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Button from '../../../ui/Button';

import styles from './Transaction.module.scss';

import scamImg from '../../../../assets/scam.svg';

type OwnProps = {
  ref?: Ref<HTMLElement>;
  tokensBySlug?: Record<string, ApiTokenWithPrice>;
  transaction: ApiTransactionActivity;
  isLast: boolean;
  isActive: boolean;
  withChainIcon?: boolean;
  apyValue: number;
  appTheme: AppTheme;
  savedAddresses?: SavedAddress[];
  onClick: (id: string) => void;
};

const ADDRESS_SHIFT = 4;

function Transaction({
  ref,
  tokensBySlug,
  transaction,
  isActive,
  apyValue,
  savedAddresses,
  isLast,
  appTheme,
  withChainIcon,
  onClick,
}: OwnProps) {
  const { openMediaViewer } = getActions();
  const lang = useLang();

  const {
    txId,
    amount,
    fromAddress,
    toAddress,
    timestamp,
    comment,
    encryptedComment,
    isIncoming,
    type,
    metadata,
    slug,
    nft,
  } = transaction;

  const isStake = type === 'stake';
  const isUnstake = type === 'unstake';
  const isUnstakeRequest = type === 'unstakeRequest';
  const isStaking = isStake || isUnstake || isUnstakeRequest;
  const isNftTransfer = type === 'nftTransferred' || type === 'nftReceived' || Boolean(nft);

  const token = tokensBySlug?.[slug];
  const { chain } = token || {};
  const address = isIncoming ? fromAddress : toAddress;
  const savedAddressName = useMemo(() => {
    return address && chain && savedAddresses?.find((item) => item.address === address && item.chain === chain)?.name;
  }, [address, chain, savedAddresses]);
  const addressName = savedAddressName || metadata?.name;
  const isLocal = getIsTxIdLocal(txId);
  const isScam = Boolean(metadata?.isScam);

  const handleClick = useLastCallback(() => {
    onClick(txId);
  });

  const handleNftClick = useLastCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    openMediaViewer({ mediaId: nft!.address, mediaType: MediaType.Nft, txId });
  });

  function getOperationName() {
    if (isStake) {
      return 'Staked';
    }

    if (isUnstakeRequest) {
      return 'Unstake Requested';
    }

    if (isUnstake) {
      return 'Unstaked';
    }

    return isIncoming ? 'Received' : 'Sent';
  }

  function renderNft() {
    return (
      <div
        className={buildClassName(
          styles.nft,
          isIncoming && styles.received,
          comment && styles.nftWithComment,
          'transaction-nft',
        )}
        onClick={handleNftClick}
        data-nft-address={nft?.address}
        data-tx-id={txId}
      >
        <img src={nft!.thumbnail} alt={nft!.name} className={styles.nftImage} />
        <div className={styles.nftData}>
          <div className={styles.nftName}>{nft!.name}</div>
          <div className={styles.nftCollection}>{nft!.collectionName}</div>
        </div>
      </div>
    );
  }

  function renderComment() {
    if (isStaking || isScam || (!comment && !encryptedComment)) {
      return undefined;
    }

    return (
      <div
        className={buildClassName(
          styles.comment,
          isIncoming ? styles.comment_incoming : styles.comment_outgoing,
        )}
      >
        {encryptedComment && <i className={buildClassName(styles.commentIcon, 'icon-lock')} aria-hidden />}
        {encryptedComment ? <i>{lang('Encrypted Message')}</i> : comment}
      </div>
    );
  }

  const stakeIconClass = buildClassName(
    isStaking && 'icon-earn',
    isStake && styles.icon_purple,
    isStaking && styles.icon_staking,
    !isStaking && (isIncoming ? 'icon-receive-alt' : 'icon-send-alt'),
  );

  const iconFullClass = buildClassName(
    styles.icon,
    isIncoming && styles.icon_operationPositive,
    stakeIconClass,
  );

  function renderAmount() {
    const amountOtherClass = buildClassName(
      styles.amount,
      isIncoming
        ? styles.amount_operationPositive
        : (isStake ? styles.amount_stake : styles.amount_operationNegative),
    );

    return (
      <div className={styles.amountWrapper}>
        <div className={amountOtherClass}>
          {isNftTransfer ? 'NFT' : formatCurrencyExtended(
            toDecimal(isStaking ? bigintAbs(amount) : amount, token!.decimals),
            token?.symbol || TONCOIN.symbol,
            isStaking,
          )}
        </div>
        <div className={styles.address}>
          {!isStaking && lang(isIncoming ? '$transaction_from' : '$transaction_to', {
            address: (
              <span className={styles.addressValue}>
                {withChainIcon && Boolean(chain) && (
                  <i
                    className={buildClassName(styles.chainIcon, `icon-chain-${chain.toLowerCase()}`)}
                    aria-label={chain}
                  />
                )}
                {addressName || shortenAddress(address, ADDRESS_SHIFT)}
              </span>
            ),
          })}
          {isStake && lang('at %apy_value%', {
            apy_value: <span className={styles.apyValue}>APY {apyValue}%</span>,
          })}
          {(isUnstake || isUnstakeRequest) && '\u00A0'}
        </div>
      </div>
    );
  }

  const waitingIconName = isStake ? 'iconClockPurpleWhite' : (isIncoming ? 'iconClockGreen' : 'iconClockGray');

  return (
    <Button
      ref={ref as RefObject<HTMLButtonElement>}
      key={txId}
      className={buildClassName(
        styles.item,
        isLast && styles.itemLast,
        isActive && styles.active,
        isNftTransfer && styles.withNft,
        isNftTransfer && comment && styles.withNftAndComment,
      )}
      onClick={handleClick}
      isSimple
    >
      <i className={iconFullClass} aria-hidden title={lang('Transaction is not completed')} />
      {isLocal && (
        <AnimatedIconWithPreview
          play
          size={ANIMATED_STICKER_TINY_ICON_PX}
          className={styles.iconWaiting}
          nonInteractive
          noLoop={false}
          forceOnHeavyAnimation
          tgsUrl={ANIMATED_STICKERS_PATHS[appTheme][waitingIconName]}
          previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview[waitingIconName]}
        />
      )}
      <div className={styles.leftBlock}>
        <div className={styles.operationName}>
          {lang(getOperationName())}
          {isScam && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
        </div>
        <div className={styles.date}>{formatTime(timestamp)}</div>
      </div>
      {renderAmount()}
      {nft && renderNft()}
      {renderComment()}
      <i className={buildClassName(styles.iconArrow, 'icon-chevron-right')} aria-hidden />
    </Button>
  );
}

export default memo(Transaction);
