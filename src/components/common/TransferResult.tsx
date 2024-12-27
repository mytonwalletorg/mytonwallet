import React, { memo } from '../../lib/teact/teact';

import { TONCOIN } from '../../config';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrencyExtended } from '../../util/formatNumber';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';

import styles from './TransferResult.module.scss';

interface OwnProps {
  playAnimation?: boolean;
  color?: 'green' | 'purple';
  noSign?: boolean;
  amount?: bigint;
  tokenSymbol?: string;
  decimals?: number;
  firstButtonText?: string;
  secondButtonText?: string;
  onFirstButtonClick?: NoneToVoidFunction;
  onSecondButtonClick?: NoneToVoidFunction;
}

function TransferResult({
  playAnimation,
  amount = 0n,
  tokenSymbol = TONCOIN.symbol,
  decimals = TONCOIN.decimals,
  noSign,
  color,
  firstButtonText,
  secondButtonText,
  onFirstButtonClick,
  onSecondButtonClick,
}: OwnProps) {
  const amountString = toDecimal(amount, decimals);
  const [wholePart, fractionPart] = formatCurrencyExtended(amountString, '', noSign, decimals).split('.');

  function renderButtons() {
    if (!firstButtonText && !secondButtonText) {
      return undefined;
    }

    return (
      <div className={styles.buttons}>
        {firstButtonText && (
          <Button className={styles.button} onClick={onFirstButtonClick}>{firstButtonText}</Button>
        )}
        {secondButtonText && (
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

      <div className={buildClassName(styles.amount, color && styles[`amount_${color}`], 'rounded-font')}>
        {wholePart.trim().replace('\u202F', '').replace('-', '−')}
        {fractionPart && <span className={styles.amountFraction}>.{fractionPart.trim()}</span>}
        <span className={styles.amountSymbol}>{tokenSymbol}</span>
      </div>

      {renderButtons()}
    </>
  );
}

export default memo(TransferResult);
