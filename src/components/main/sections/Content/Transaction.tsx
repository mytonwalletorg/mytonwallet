import type { Ref, RefObject } from 'react';
import React, { memo } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ApiToken, ApiTransactionActivity } from '../../../../api/types';
import { MediaType } from '../../../../global/types';

import { TON_SYMBOL } from '../../../../config';
import { getIsTxIdLocal } from '../../../../global/helpers';
import { bigintAbs } from '../../../../util/bigint';
import buildClassName from '../../../../util/buildClassName';
import { formatTime } from '../../../../util/dateFormat';
import { toDecimal } from '../../../../util/decimals';
import { formatCurrencyExtended } from '../../../../util/formatNumber';
import { shortenAddress } from '../../../../util/shortenAddress';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';

import styles from './Transaction.module.scss';

import scamImg from '../../../../assets/scam.svg';

type OwnProps = {
  ref?: Ref<HTMLElement>;
  tokensBySlug?: Record<string, ApiToken>;
  transaction: ApiTransactionActivity;
  isLast: boolean;
  isActive: boolean;
  apyValue: number;
  savedAddresses?: Record<string, string>;
  onClick: (id: string) => void;
};

function Transaction({
  ref,
  tokensBySlug,
  transaction,
  isActive,
  apyValue,
  savedAddresses,
  isLast,
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
  const address = isIncoming ? fromAddress : toAddress;
  const addressName = savedAddresses?.[address] || metadata?.name;
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
            token?.symbol || TON_SYMBOL,
            isStaking,
          )}
        </div>
        <div className={styles.address}>
          {!isStaking && lang(isIncoming ? '$transaction_from' : '$transaction_to', {
            address: <span className={styles.addressValue}>{addressName || shortenAddress(address)}</span>,
          })}
          {isStake && lang('at %apy_value%', {
            apy_value: <span className={styles.apyValue}>APY {apyValue}%</span>,
          })}
          {(isUnstake || isUnstakeRequest) && '\u00A0'}
        </div>
      </div>
    );
  }

  const waitingIconClassName = buildClassName(
    styles.iconWaiting,
    isStake && styles.iconWaitingStake,
    'icon-clock',
  );

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
      <i className={iconFullClass} aria-hidden />
      {isLocal && (
        <i
          className={waitingIconClassName}
          title={lang('Transaction is not completed')}
          aria-hidden
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
