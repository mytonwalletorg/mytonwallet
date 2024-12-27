import React, { memo } from '../../lib/teact/teact';

import { TONCOIN } from '../../config';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrencyExtended } from '../../util/formatNumber';

import styles from './TransactionAmount.module.scss';

interface OwnProps {
  amount: bigint;
  decimals?: number;
  isIncoming?: boolean;
  isScam?: boolean;
  tokenSymbol?: string;
  status?: string;
}

function TransactionAmount({
  isIncoming,
  isScam,
  amount,
  decimals,
  tokenSymbol,
  status,
}: OwnProps) {
  const amountString = toDecimal(amount, decimals);
  const [wholePart, fractionPart] = formatCurrencyExtended(amountString, '', false, decimals).split('.');

  function renderAmount() {
    return (
      <div className={buildClassName(
        styles.amount,
        status && styles.withStatus,
        isIncoming && !isScam && styles.operationPositive,
        isScam && styles.operationScam,
        'rounded-font',
      )}
      >
        {wholePart.trim().replace('\u202F', '')}
        {fractionPart && <span className={styles.amountFraction}>.{fractionPart.trim()}</span>}
        <span className={styles.amountSymbol}>{tokenSymbol || TONCOIN.symbol}</span>
      </div>
    );
  }

  if (!status) {
    return renderAmount();
  }

  return (
    <div className={styles.wrapper}>
      {renderAmount()}
      <div className={buildClassName(
        styles.status,
        isIncoming && !isScam && styles.operationPositive,
        isScam && styles.operationScam,
      )}
      >
        {status}
      </div>
    </div>
  );
}

export default memo(TransactionAmount);
