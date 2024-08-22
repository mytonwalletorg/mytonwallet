import type { TeactNode } from '../../../lib/teact/teact';
import React, { memo, useRef } from '../../../lib/teact/teact';

import type { DieselStatus, UserSwapToken } from '../../../global/types';
import { SwapErrorType, SwapType } from '../../../global/types';

import { ANIMATION_END_DELAY } from '../../../config';
import buildClassName from '../../../util/buildClassName';
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
  isEnoughToncoin?: boolean;
  dieselStatus?: DieselStatus;
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
  isEnoughToncoin,
  dieselStatus,
  isPriceImpactError,
  canSubmit,
  errorType,
  limits,
}: OwnProps) {
  const lang = useLang();

  const isErrorExist = errorType !== undefined;
  const shouldSendingBeVisible = isSending && swapType === SwapType.CrosschainToToncoin;
  const isDisabled = !canSubmit || shouldSendingBeVisible;
  const isLoading = isEstimating || shouldSendingBeVisible;

  const errorMsgByType = {
    [SwapErrorType.UnexpectedError]: lang('Unexpected Error'),
    [SwapErrorType.InvalidPair]: lang('Invalid Pair'),
    [SwapErrorType.NotEnoughLiquidity]: lang('Insufficient liquidity'),
    [SwapErrorType.ChangellyMinSwap]: lang('Minimum amount', {
      value: formatCurrencySimple(limits?.fromMin ?? '0', tokenIn?.symbol ?? '', tokenIn?.decimals),
    }),
    [SwapErrorType.ChangellyMaxSwap]: lang('Maximum amount', {
      value: formatCurrencySimple(limits?.fromMax ?? '0', tokenIn?.symbol ?? '', tokenIn?.decimals),
    }),
    [SwapErrorType.NotEnoughForFee]: lang('Not Enough %symbol%', {
      symbol: tokenIn?.symbol,
    }),
    [SwapErrorType.TooSmallAmount]: lang('$swap_too_small_amount'),
  };

  const isTouched = Boolean(amountIn || amountOut);

  let text: string | TeactNode[] = '$swap_from_to';

  if (isTouched && isErrorExist) {
    text = errorMsgByType[errorType];
  } else if (isTouched && !isEnoughToncoin && swapType !== SwapType.CrosschainToToncoin) {
    if (dieselStatus === 'not-available') {
      text = lang('Not Enough %symbol%', { symbol: 'TON' });
    } else if (dieselStatus === 'pending-previous') {
      text = lang('Awaiting Previous Fee');
    } else if (dieselStatus === 'not-authorized') {
      text = lang('Authorize %token% Fee', { token: tokenIn?.symbol });
    }
  }

  const textStr = Array.isArray(text) ? text.join('') : text;

  let shouldShowError = !isEstimating && (
    isPriceImpactError
    || isErrorExist
    || (!isEnoughToncoin && (dieselStatus === 'not-available' || dieselStatus === 'pending-previous'))
  );

  if (swapType === SwapType.CrosschainToToncoin) {
    shouldShowError = !isEstimating && (isPriceImpactError || isErrorExist);
  }

  const isDestructive = isTouched && shouldShowError;

  const transitionKeyRef = useRef(0);
  const render = useDerivedSignal(() => {
    const renderedText = textStr === '$swap_from_to'
      ? lang('$swap_from_to', {
        from: tokenIn?.symbol,
        icon: <i className={buildClassName('icon-arrow-right', styles.swapArrowIcon)} aria-hidden />,
        to: tokenOut?.symbol,
      })
      : textStr;

    return (
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
          {renderedText}
        </Button>
      </Transition>
    );
  }, [isDestructive, isDisabled, isLoading, lang, textStr, tokenIn?.symbol, tokenOut?.symbol]);
  const renderThrottled = useThrottledSignal(render, BUTTON_ANIMATION_DURATION);
  const rendered = useDerivedState(renderThrottled);

  return rendered;
}

export default memo(SwapSubmitButton);
