import React, { memo } from '../../lib/teact/teact';

import { CARD_SECONDARY_VALUE_SYMBOL } from '../../config';
import { formatCurrencyExtended } from '../../util/formatNumber';
import buildClassName from '../../util/buildClassName';

import styles from './TransactionAmount.module.scss';

interface OwnProps {
  amount: number;
  isIncoming?: boolean;
  tokenSymbol?: string;
}

function TransactionAmount({ isIncoming, amount, tokenSymbol }: OwnProps) {
  const [wholePart, fractionPart] = formatCurrencyExtended(amount, '').split('.');

  return (
    <div className={buildClassName(
      styles.amount,
      isIncoming && styles.amount_operationPositive,
    )}
    >
      {wholePart.trim().replace('\u202F', '')}
      {fractionPart && <span className={styles.amountFraction}>.{fractionPart.trim()}</span>}
      <span className={styles.amountSymbol}>{tokenSymbol || CARD_SECONDARY_VALUE_SYMBOL}</span>
    </div>
  );
}

export default memo(TransactionAmount);
