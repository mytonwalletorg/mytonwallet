import type { Ref, RefObject } from 'react';
import React, { memo, useCallback } from '../../../../lib/teact/teact';

import { ApiToken, ApiTransaction } from '../../../../api/types';

import { CARD_SECONDARY_VALUE_SYMBOL } from '../../../../config';
import { formatTime } from '../../../../util/dateFormat';
import { formatCurrencyExtended } from '../../../../util/formatNumber';
import buildClassName from '../../../../util/buildClassName';
import { bigStrToHuman, getIsTxIdLocal } from '../../../../global/helpers';
import { shortenAddress } from '../../../../util/shortenAddress';
import useLang from '../../../../hooks/useLang';

import Button from '../../../ui/Button';

import styles from './Transaction.module.scss';

type OwnProps = {
  ref?: Ref<HTMLElement>;
  token?: ApiToken;
  transaction: ApiTransaction;
  apyValue: number;
  onClick: (txId: string) => void;
};

function Transaction({
  ref,
  token,
  transaction,
  apyValue,
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
    isIncoming,
    type,
  } = transaction;

  const isStaking = type === 'stake' || type === 'unstake' || type === 'unstakeRequest';
  const amountHuman = bigStrToHuman(amount, token!.decimals);
  const address = isIncoming ? fromAddress : toAddress;
  const isLocal = getIsTxIdLocal(txId);

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
      <div className={buildClassName(styles.comment, isIncoming ? styles.comment_incoming : styles.comment_outgoing)}>
        {comment}
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
        <div className={styles.operationName}>{lang(getOperationName())}</div>
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
            address: <span className={styles.addressValue}>{shortenAddress(address)}</span>,
          })}
          {type === 'stake' && lang('at APY %1$s%', apyValue)}
          {(type === 'unstake' || type === 'unstakeRequest') && '\u00A0'}
        </div>
      </div>
      {!isStaking && comment && renderComment()}
      <i className={buildClassName(styles.iconArrow, 'icon-chevron-right')} aria-hidden />
    </Button>
  );
}

export default memo(Transaction);
