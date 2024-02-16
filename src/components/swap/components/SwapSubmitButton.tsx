import React, { memo, useRef } from '../../../lib/teact/teact';

import type { UserSwapToken } from '../../../global/types';
import { SwapErrorType, SwapType } from '../../../global/types';

import { ANIMATION_END_DELAY } from '../../../config';
import { formatCurrencySimple } from '../../../util/formatNumber';

import { useThrottledSignal } from '../../../hooks/useAsyncResolvers';
import useDerivedSignal from '../../../hooks/useDerivedSignal';
import useDerivedState from '../../../hooks/useDerivedState';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import Transition from '../../ui/Transition';

import styles from '../Swap.module.scss';

interface OwnProps {
  tokenIn?: UserSwapToken;
  tokenOut?: UserSwapToken;
  amountIn?: string;
  amountOut?: string;
  swapType?: SwapType;
  isEstimating?: boolean;
  isSending?: boolean;
  isEnoughTon?: boolean;
  isPriceImpactError?: boolean;
  canSubmit?: boolean;
  errorType?: SwapErrorType;
  limits?: {
    fromMin?: string;
    fromMax?: string;
  };
}

const BUTTON_ANIMATION_DURATION = 250 + ANIMATION_END_DELAY;

function SwapSubmitButton({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  swapType,
  isEstimating,
  isSending,
  isEnoughTon,
  isPriceImpactError,
  canSubmit,
  errorType,
  limits,
}: OwnProps) {
  const lang = useLang();

  const isErrorExist = errorType !== undefined;
  const shouldSendingBeVisible = isSending && swapType === SwapType.CrosschainToTon;
  const isDisabled = !canSubmit || shouldSendingBeVisible;
  const isLoading = isEstimating || shouldSendingBeVisible;

  const errorMsgByType = {
    [SwapErrorType.InvalidPair]: lang('Invalid Pair'),
    [SwapErrorType.NotEnoughLiquidity]: lang('Insufficient liquidity'),
    [SwapErrorType.ChangellyMinSwap]: lang('Minimum amount', {
      value: formatCurrencySimple(limits?.fromMin ?? '0', tokenIn?.symbol ?? '', tokenIn?.decimals),
    }),
    [SwapErrorType.ChangellyMaxSwap]: lang('Maximum amount', {
      value: formatCurrencySimple(limits?.fromMax ?? '0', tokenIn?.symbol ?? '', tokenIn?.decimals),
    }),
  };

  const isTouched = Boolean(amountIn || amountOut);

  let text = lang('$swap_from_to', {
    from: tokenIn?.symbol,
    to: tokenOut?.symbol,
  });

  if (isTouched && isErrorExist) {
    text = errorMsgByType[errorType];
  } else if (isTouched && !isEnoughTon && swapType !== SwapType.CrosschainToTon) {
    text = lang('Not enough TON');
  }

  const textStr = Array.isArray(text) ? text.join('') : text;

  let shouldShowError = !isEstimating && ((isPriceImpactError || isErrorExist || !isEnoughTon));

  if (swapType === SwapType.CrosschainToTon) {
    shouldShowError = !isEstimating && ((isPriceImpactError || isErrorExist));
  }

  const isDestructive = isTouched && shouldShowError;

  const transitionKeyRef = useRef(0);
  const render = useDerivedSignal(() => (
    <Transition
      name="semiFade"
      className={styles.footerButtonWrapper}
      activeKey={transitionKeyRef.current++}
    >
      <Button
        className={styles.footerButton}
        isDisabled={isDisabled}
        isPrimary
        isSubmit
        isLoading={isLoading}
        isDestructive={isDestructive}
      >
        {textStr}
      </Button>
    </Transition>
  ), [isDestructive, isDisabled, isLoading, textStr]);
  const renderThrottled = useThrottledSignal(render, BUTTON_ANIMATION_DURATION);
  const rendered = useDerivedState(renderThrottled);

  return rendered;
}

export default memo(SwapSubmitButton);
