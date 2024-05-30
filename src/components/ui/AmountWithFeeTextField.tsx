import React, { memo } from '../../lib/teact/teact';

import { TON_SYMBOL } from '../../config';
import buildClassName from '../../util/buildClassName';
import { formatCurrencyExtended } from '../../util/formatNumber';

import useLang from '../../hooks/useLang';

import styles from './AmountWithFeeTextField.module.scss';

interface OwnProps {
  amount: string;
  label: string;
  currency?: string;
  symbol?: string;
  fee?: string;
  feeSymbol?: string;
  className?: string;
  labelClassName?: string;
}

function AmountWithFeeTextField({
  amount,
  label,
  currency = '',
  symbol,
  fee,
  feeSymbol = TON_SYMBOL,
  className,
  labelClassName,
}: OwnProps) {
  const lang = useLang();

  return (
    <>
      <div className={buildClassName(styles.label, labelClassName)}>{label}</div>
      <div className={buildClassName(styles.root, className)}>
        {formatCurrencyExtended(amount, currency, true)}
        {symbol && <span className={styles.suffix}>{symbol}</span>}
        {Boolean(fee) && (
          <>
            <div className={styles.feeLabel}>{lang('Fee')}</div>
            <span className={styles.feeConfirm}>
              {formatCurrencyExtended(fee, feeSymbol)}
            </span>
          </>
        )}
      </div>
    </>
  );
}

export default memo(AmountWithFeeTextField);
