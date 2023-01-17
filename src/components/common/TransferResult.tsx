import React, { memo } from '../../lib/teact/teact';

import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { CARD_SECONDARY_VALUE_SYMBOL } from '../../config';
import { formatCurrency, formatCurrencyExtended } from '../../util/formatNumber';
import buildClassName from '../../util/buildClassName';

import Button from '../ui/Button';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';

import styles from './TransferResult.module.scss';

interface OwnProps {
  playAnimation?: boolean;
  color?: 'green' | 'purple';
  noSign?: boolean;
  amount?: number;
  tokenSymbol?: string;
  precision?: number;
  balance?: number;
  operationAmount?: number;
  fee?: number;
  firstButtonText?: string;
  secondButtonText?: string;
  onFirstButtonClick?: NoneToVoidFunction;
  onSecondButtonClick?: NoneToVoidFunction;
}

function TransferResult({
  playAnimation,
  amount = 0,
  tokenSymbol = CARD_SECONDARY_VALUE_SYMBOL,
  precision = 2,
  noSign,
  color,
  balance,
  operationAmount,
  fee,
  firstButtonText,
  secondButtonText,
  onFirstButtonClick,
  onSecondButtonClick,
}: OwnProps) {
  const withBalanceChange = balance && operationAmount;
  const finalBalance = withBalanceChange ? balance + operationAmount - (fee ?? 0) : 0;
  const [wholePart, fractionPart] = formatCurrencyExtended(amount, '', noSign).split('.');

  function renderButtons() {
    if (!firstButtonText && !secondButtonText) {
      return undefined;
    }

    return (
      <div className={styles.buttons}>
        {firstButtonText && (
          <Button className={styles.button} onClick={onFirstButtonClick}>{firstButtonText}</Button>
        )}
        {firstButtonText && (
          <Button className={styles.button} onClick={onSecondButtonClick}>{secondButtonText}</Button>
        )}
      </div>
    );
  }

  return (
    <>
      <AnimatedIconWithPreview
        play={playAnimation}
        noLoop={false}
        nonInteractive
        className={styles.sticker}
        tgsUrl={ANIMATED_STICKERS_PATHS.thumbUp}
        previewUrl={ANIMATED_STICKERS_PATHS.thumbUpPreview}
      />

      {Boolean(withBalanceChange) && (
        <div className={styles.balanceChange}>
          {formatCurrency(balance!, tokenSymbol, precision)}
          &nbsp;&rarr;&nbsp;
          {formatCurrency(finalBalance, tokenSymbol, precision)}
        </div>
      )}

      <div className={buildClassName(styles.amount, color && styles[`amount_${color}`])}>
        {wholePart.trim().replace('\u202F', '').replace('-', '−')}
        {fractionPart && <span className={styles.amountFraction}>.{fractionPart.trim()}</span>}
        <span className={styles.amountSymbol}>{tokenSymbol}</span>
      </div>

      {renderButtons()}
    </>
  );
}

export default memo(TransferResult);
