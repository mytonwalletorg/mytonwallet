import type { Ref, RefObject } from 'react';
import React, { memo, useCallback } from '../../../../lib/teact/teact';

import type { ApiToken, ApiTransaction } from '../../../../api/types';

import { CARD_SECONDARY_VALUE_SYMBOL } from '../../../../config';
import { bigStrToHuman, getIsTxIdLocal } from '../../../../global/helpers';
import buildClassName from '../../../../util/buildClassName';
import { formatTime } from '../../../../util/dateFormat';
import { formatCurrencyExtended } from '../../../../util/formatNumber';
import { shortenAddress } from '../../../../util/shortenAddress';

import useLang from '../../../../hooks/useLang';

import Button from '../../../ui/Button';

import styles from './Transaction.module.scss';

import scamImg from '../../../../assets/scam.svg';

type OwnProps = {
  ref?: Ref<HTMLElement>;
  token?: ApiToken;
  transaction: ApiTransaction;
  apyValue: number;
  savedAddresses?: Record<string, string>;
  onClick: (txId: string) => void;
};

function Transaction({
  ref,
  token,
  transaction,
  apyValue,
  savedAddresses,
  onClick,
}: OwnProps) {
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
  } = transaction;

  const isStaking = type === 'stake' || type === 'unstake' || type === 'unstakeRequest';
  const amountHuman = bigStrToHuman(amount, token!.decimals);
  const address = isIncoming ? fromAddress : toAddress;
  const addressName = savedAddresses?.[address] || metadata?.name;
  const isLocal = getIsTxIdLocal(txId);
  const isScam = Boolean(metadata?.isScam);

  const handleClick = useCallback(() => {
    onClick(txId);
  }, [onClick, txId]);

  function getOperationName() {
    if (type === 'stake') {
      return 'Staked';
    }

    if (type === 'unstakeRequest') {
      return 'Unstake Requested';
    }

    if (type === 'unstake') {
      return 'Unstaked';
    }

    return isIncoming ? 'Received' : 'Sent';
  }

  function renderComment() {
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

  const iconFullClass = buildClassName(
    styles.icon,
    isIncoming && styles.icon_operationPositive,
    type === 'stake' && styles.icon_purple,
    !isStaking && (isIncoming ? 'icon-receive-alt' : 'icon-send-alt'),
    isStaking && 'icon-earn',
    isStaking && styles.icon_staking,
  );

  const amountFullClass = buildClassName(
    styles.amount,
    isIncoming
      ? styles.amount_operationPositive
      : (type === 'stake' ? styles.amount_stake : styles.amount_operationNegative),
  );

  return (
    <Button
      ref={ref as RefObject<HTMLButtonElement>}
      key={txId}
      className={styles.item}
      onClick={handleClick}
      isSimple
    >
      <i className={iconFullClass} aria-hidden />
      {isLocal && (
        <i
          className={buildClassName(styles.iconWaiting, 'icon-clock')}
          title={lang('Transaction is not completed')}
        />
      )}
      <div className={styles.leftBlock}>
        <div className={styles.operationName}>
          {lang(getOperationName())}
          {isScam && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
        </div>
        <div className={styles.date}>{formatTime(timestamp)}</div>
      </div>
      <div className={styles.amountWrapper}>
        <div className={amountFullClass}>
          {formatCurrencyExtended(
            isStaking ? Math.abs(amountHuman) : amountHuman,
            token?.symbol || CARD_SECONDARY_VALUE_SYMBOL,
            isStaking,
          )}
        </div>
        <div className={styles.address}>
          {!isStaking && lang(isIncoming ? '$transaction_from' : '$transaction_to', {
            address: <span className={styles.addressValue}>{addressName || shortenAddress(address)}</span>,
          })}
          {type === 'stake' && lang('at APY %1$s%', apyValue)}
          {(type === 'unstake' || type === 'unstakeRequest') && '\u00A0'}
        </div>
      </div>
      {!isStaking && !isScam && (comment || encryptedComment) && renderComment()}
      <i className={buildClassName(styles.iconArrow, 'icon-chevron-right')} aria-hidden />
    </Button>
  );
}

export default memo(Transaction);
