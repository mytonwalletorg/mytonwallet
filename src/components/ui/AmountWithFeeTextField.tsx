import type { TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import { formatCurrencyExtended } from '../../util/formatNumber';

import useLang from '../../hooks/useLang';

import styles from './AmountWithFeeTextField.module.scss';

interface OwnProps {
  amount: string;
  label: string;
  currency?: string;
  symbol?: string;
  fractionDigits?: number;
  feeText?: TeactNode;
  className?: string;
  labelClassName?: string;
}

function AmountWithFeeTextField({
  amount,
  label,
  currency = '',
  symbol,
  fractionDigits,
  feeText,
  className,
  labelClassName,
}: OwnProps) {
  const lang = useLang();

  return (
    <>
      <div className={buildClassName(styles.label, labelClassName)}>{label}</div>
      <div className={buildClassName(styles.root, className)}>
        {formatCurrencyExtended(amount, currency, true, fractionDigits)}
        {symbol && <span className={styles.suffix}>{symbol}</span>}
        {Boolean(feeText) && (
          <>
            <div className={styles.feeLabel}>{lang('Fee')}</div>
            <span className={styles.feeConfirm}>
              {feeText}
            </span>
          </>
        )}
      </div>
    </>
  );
}

export default memo(AmountWithFeeTextField);
