import React, { memo } from '../../lib/teact/teact';

import { DEFAULT_DECIMAL_PLACES, TON_SYMBOL } from '../../config';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrency, formatCurrencyExtended } from '../../util/formatNumber';

import styles from './TransactionAmount.module.scss';

interface OwnProps {
  amount: bigint;
  decimals?: number;
  isIncoming?: boolean;
  isScam?: boolean;
  tokenSymbol?: string;
  from?: number;
  to?: number;
}

function TransactionAmount({
  isIncoming,
  isScam,
  amount,
  decimals,
  tokenSymbol,
  from,
  to,
}: OwnProps) {
  const amountString = toDecimal(amount, decimals);
  const [wholePart, fractionPart] = formatCurrencyExtended(amountString, '', false, decimals).split('.');

  const withBalanceChange = from !== undefined && to !== undefined;

  return (
    <div className={buildClassName(
      styles.amount,
      isIncoming && !isScam && styles.amount_operationPositive,
      isScam && styles.amount_operationScam,
    )}
    >
      {wholePart.trim().replace('\u202F', '')}
      {fractionPart && <span className={styles.amountFraction}>.{fractionPart.trim()}</span>}
      <span className={styles.amountSymbol}>{tokenSymbol || TON_SYMBOL}</span>

      {withBalanceChange && (
        <div className={styles.balanceChange}>
          {formatCurrency(from, '', DEFAULT_DECIMAL_PLACES)}
          &nbsp;&rarr;&nbsp;
          {formatCurrency(to, '', DEFAULT_DECIMAL_PLACES)}
        </div>
      )}
    </div>
  );
}

export default memo(TransactionAmount);
