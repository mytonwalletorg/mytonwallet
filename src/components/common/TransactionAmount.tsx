import React, { memo } from '../../lib/teact/teact';

import { TONCOIN } from '../../config';
import { bigintAbs } from '../../util/bigint';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrencyExtended } from '../../util/formatNumber';

import SensitiveData from '../ui/SensitiveData';

import styles from './TransactionAmount.module.scss';

interface OwnProps {
  amount: bigint;
  decimals?: number;
  isIncoming?: boolean;
  isScam?: boolean;
  tokenSymbol?: string;
  status?: string;
  noSign?: boolean;
  isSensitiveDataHidden?: true;
}

function TransactionAmount({
  isIncoming,
  isScam,
  amount,
  decimals,
  tokenSymbol,
  status,
  noSign = false,
  isSensitiveDataHidden,
}: OwnProps) {
  const amountString = toDecimal(noSign ? bigintAbs(amount) : amount, decimals);
  const [wholePart, fractionPart] = formatCurrencyExtended(amountString, '', noSign, decimals).split('.');
  const withStatus = Boolean(status);

  return (
    <SensitiveData
      isActive={isSensitiveDataHidden}
      cols={12}
      rows={withStatus ? 7 : 4}
      align="center"
      cellSize={withStatus ? 17 : 18}
      className={styles.amountSensitiveData}
    >
      <div
        className={buildClassName(
          styles.amount,
          status && styles.withStatus,
          isIncoming && !isScam && styles.operationPositive,
          isScam && styles.operationScam,
          'rounded-font',
        )}>
        {wholePart.trim().replace('\u202F', '')}
        {fractionPart && <span className={styles.amountFraction}>.{fractionPart.trim()}</span>}
        <span className={styles.amountSymbol}>{tokenSymbol || TONCOIN.symbol}</span>
      </div>
      {withStatus && (
        <div className={buildClassName(
          styles.status,
          isIncoming && !isScam && styles.operationPositive,
          isScam && styles.operationScam,
        )}
        >
          {status}
        </div>
      )}
    </SensitiveData>
  );
}

export default memo(TransactionAmount);
