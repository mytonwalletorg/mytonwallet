import React, { memo } from '../../lib/teact/teact';

import type { ApiToken } from '../../api/types';

import { toDecimal } from '../../util/decimals';
import { formatCurrency, formatCurrencySimple } from '../../util/formatNumber';

import useLang from '../../hooks/useLang';
import { useTransitionActiveKey } from '../../hooks/useTransitionActiveKey';

import Transition from './Transition';

import styles from './AmountFieldMaxButton.module.scss';

interface OwnProps {
  maxAmount?: bigint;
  token?: Pick<ApiToken, 'symbol' | 'decimals'>;
  isLoading?: boolean;
  isSensitiveDataHidden?: boolean;
  /** If true, the label will say "All" instead of "Max" and all the amount digits will be shown (made for unstaking) */
  isAllMode?: boolean;
  onAmountClick: NoneToVoidFunction;
}

/**
 * Put the element right above a <RichNumberInput />, it will take the space right to the input label without moving the
 * around content.
 */
function AmountFieldMaxButton({
  maxAmount,
  token,
  isLoading,
  isSensitiveDataHidden,
  isAllMode,
  onAmountClick,
}: OwnProps) {
  const lang = useLang();

  const content = isLoading
    ? lang('Loading...')
    : !token || maxAmount === undefined
      ? ''
      : isSensitiveDataHidden
        ? `*** ${token.symbol}`
        : isAllMode
          ? formatCurrencySimple(maxAmount, token.symbol, token.decimals)
          : formatCurrency(toDecimal(maxAmount, token.decimals), token.symbol);

  const transitionKey = useTransitionActiveKey([!content, token?.symbol, isLoading, isSensitiveDataHidden]);

  return (
    <Transition name="fade" activeKey={transitionKey} className={styles.container}>
      {content && (
        <span className={styles.content}>
          {lang(isAllMode ? '$all_balance' : '$max_balance', {
            balance: (
              <div
                role="button"
                tabIndex={0}
                onClick={() => onAmountClick()}
                className={styles.link}
              >
                {content}
              </div>
            ),
          })}
        </span>
      )}
    </Transition>
  );
}

export default memo(AmountFieldMaxButton);
