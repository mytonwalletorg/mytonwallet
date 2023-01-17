import React, { memo } from '../../lib/teact/teact';

import { CARD_SECONDARY_VALUE_SYMBOL } from '../../config';
import { formatCurrency, formatCurrencyExtended } from '../../util/formatNumber';
import buildClassName from '../../util/buildClassName';

import styles from './TransactionAmount.module.scss';

interface OwnProps {
  amount: number;
  isIncoming?: boolean;
  tokenSymbol?: string;
  from?: number;
  to?: number;
}

const AMOUNT_PRECISION = 4;

function TransactionAmount({
  isIncoming,
  amount,
  tokenSymbol,
  from,
  to,
}: OwnProps) {
  const [wholePart, fractionPart] = formatCurrencyExtended(amount, '').split('.');

  const withBalanceChange = from !== undefined && to !== undefined;

  return (
    <div className={buildClassName(
      styles.amount,
      isIncoming && styles.amount_operationPositive,
    )}
    >
      {wholePart.trim().replace('\u202F', '')}
      {fractionPart && <span className={styles.amountFraction}>.{fractionPart.trim()}</span>}
      <span className={styles.amountSymbol}>{tokenSymbol || CARD_SECONDARY_VALUE_SYMBOL}</span>

      {withBalanceChange && (
        <div className={styles.balanceChange}>
          {formatCurrency(from, '', AMOUNT_PRECISION)}
          &nbsp;&rarr;&nbsp;
          {formatCurrency(to, '', AMOUNT_PRECISION)}
        </div>
      )}
    </div>
  );
}

export default memo(TransactionAmount);
