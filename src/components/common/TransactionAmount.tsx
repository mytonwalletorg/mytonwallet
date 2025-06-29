import React, { memo } from '../../lib/teact/teact';

import type { ApiBaseCurrency, ApiTokenWithPrice } from '../../api/types';

import { bigintAbs } from '../../util/bigint';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatBaseCurrencyAmount, formatCurrencyExtended } from '../../util/formatNumber';

import SensitiveData from '../ui/SensitiveData';

import styles from './TransactionAmount.module.scss';

interface OwnProps {
  amount: bigint;
  token?: Pick<ApiTokenWithPrice, 'decimals' | 'symbol' | 'price'>;
  isIncoming?: boolean;
  isScam?: boolean;
  status?: string;
  noSign?: boolean;
  isSensitiveDataHidden?: true;
  baseCurrency?: ApiBaseCurrency;
}

function TransactionAmount({
  isIncoming,
  isScam,
  amount,
  token,
  status,
  noSign = false,
  isSensitiveDataHidden,
  baseCurrency,
}: OwnProps) {
  const typeClass = isScam ? styles.operationScam : isIncoming ? styles.operationPositive : undefined;

  function renderAmount() {
    const { decimals, symbol } = token ?? {};
    const amountString = toDecimal(noSign ? bigintAbs(amount) : amount, decimals);
    const [wholePart, fractionPart]
      = formatCurrencyExtended(amountString, '', noSign, decimals, !isIncoming).split('.');
    const withStatus = Boolean(status);

    return (
      <SensitiveData
        isActive={isSensitiveDataHidden}
        cols={12}
        rows={withStatus ? 7 : 4}
        align="center"
        cellSize={withStatus ? 17 : 18}
        className={buildClassName(styles.amountSensitiveData, status && styles.withStatus)}
      >
        <div
          className={buildClassName(
            styles.amount,
            status && styles.withStatus,
            typeClass,
            'rounded-font',
          )}
        >
          {wholePart.trim().replace('\u202F', '')}
          {fractionPart && <span className={styles.amountFraction}>.{fractionPart.trim()}</span>}
          <span className={styles.amountSymbol}>{symbol}</span>
        </div>
        {withStatus && (
          <div className={buildClassName(styles.status, typeClass)}>
            {status}
          </div>
        )}
      </SensitiveData>
    );
  }

  function renderBaseCurrencyAmount() {
    if (!token) {
      return undefined;
    }

    return (
      <SensitiveData
        isActive={isSensitiveDataHidden}
        cols={10}
        rows={3}
        align="center"
        cellSize={12}
        className={styles.baseCurrencyAmountSensitiveData}
        contentClassName={buildClassName(styles.baseCurrencyAmount, 'rounded-font', typeClass)}
      >
        {formatBaseCurrencyAmount(amount, baseCurrency, token)}
      </SensitiveData>
    );
  }

  return (
    <>
      {renderAmount()}
      {renderBaseCurrencyAmount()}
    </>
  );
}

export default memo(TransactionAmount);
