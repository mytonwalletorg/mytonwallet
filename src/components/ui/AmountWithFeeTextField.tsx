import React, { memo } from '../../lib/teact/teact';

import { TON_SYMBOL } from '../../config';
import buildClassName from '../../util/buildClassName';
import { formatCurrencyExtended } from '../../util/formatNumber';

import useLang from '../../hooks/useLang';

import styles from './AmountWithFeeTextField.module.scss';

interface OwnProps {
  amount: number;
  label: string;
  currency?: string;
  symbol?: string;
  fee?: number;
  className?: string;
}

function AmountWithFeeTextField({
  amount,
  label,
  currency = '',
  symbol,
  fee,
  className,
}: OwnProps) {
  const lang = useLang();

  return (
    <>
      <div className={styles.label}>{label}</div>
      <div className={buildClassName(styles.root, className)}>
        {formatCurrencyExtended(amount, currency, true)}
        {symbol && <span className={styles.suffix}>{symbol}</span>}
        {Boolean(fee) && (
          <>
            <div className={styles.feeLabel}>{lang('Fee')}</div>
            <span className={styles.feeConfirm}>
              {formatCurrencyExtended(fee, TON_SYMBOL)}
            </span>
          </>
        )}
      </div>
    </>
  );
}

export default memo(AmountWithFeeTextField);
