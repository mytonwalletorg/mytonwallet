import type { Ref, RefObject } from 'react';
import React, { memo, useCallback } from '../../lib/teact/teact';

import { ApiToken, ApiTransaction } from '../../api/types';

import { CARD_SECONDARY_VALUE_SYMBOL } from '../../config';
import { formatTime } from '../../util/dateFormat';
import { formatCurrencyExtended } from '../../util/formatNumber';
import buildClassName from '../../util/buildClassName';
import { bigStrToHuman } from '../../global/helpers';
import { shortenAddress } from '../../util/shortenAddress';

import Button from '../ui/Button';

import styles from './Transaction.module.scss';

type OwnProps = {
  ref?: Ref<HTMLElement>;
  token?: ApiToken;
  transaction: ApiTransaction;
  onClick: (txId: string) => void;
};

function Transaction({
  ref,
  token,
  transaction,
  onClick,
}: OwnProps) {
  const {
    txId,
    amount,
    fromAddress,
    toAddress,
    timestamp,
    comment,
    isIncoming,
  } = transaction;

  const amountHuman = bigStrToHuman(amount);
  const address = isIncoming ? fromAddress : toAddress;

  const handleClick = useCallback(() => {
    onClick(txId);
  }, [onClick, txId]);

  function renderComment() {
    return (
      <div className={buildClassName(styles.comment, isIncoming ? styles.comment_incoming : styles.comment_outgoing)}>
        {comment}
      </div>
    );
  }

  const iconFullClass = buildClassName(
    styles.icon,
    isIncoming && styles.icon_operationPositive,
    isIncoming ? 'icon-receive-alt' : 'icon-send-alt',
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
      <div className={styles.leftBlock}>
        <div className={styles.operationName}>{isIncoming ? 'Received' : 'Sent'}</div>
        <div className={styles.date}>{formatTime(timestamp)}</div>
      </div>
      <div className={styles.amountWrapper}>
        <div className={buildClassName(
          styles.amount,
          isIncoming ? styles.amount_operationPositive : styles.amount_operationNegative,
        )}
        >
          {formatCurrencyExtended(amountHuman, token?.symbol || CARD_SECONDARY_VALUE_SYMBOL)}
        </div>
        <div className={styles.address}>
          {isIncoming ? 'from ' : 'to '}
          <span className={styles.addressValue}>{shortenAddress(address)}</span>
        </div>
      </div>
      {comment && renderComment()}
      <i className={buildClassName(styles.iconArrow, 'icon-arrow-right')} aria-hidden />
    </Button>
  );
}

export default memo(Transaction);
