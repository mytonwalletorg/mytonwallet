import React, {
  memo, useRef,
} from '../../../lib/teact/teact';

import type { UserSwapToken } from '../../../global/types';
import { SwapErrorType, SwapType } from '../../../global/types';

import { formatCurrencySimple } from '../../../util/formatNumber';

import useLang from '../../../hooks/useLang';
import useSyncEffect from '../../../hooks/useSyncEffect';

import Button from '../../ui/Button';
import Transition from '../../ui/Transition';

import styles from '../Swap.module.scss';

interface OwnProps {
  tokenIn?: UserSwapToken;
  tokenOut?: UserSwapToken;
  amountIn?: number;
  amountOut?: number;
  swapType?: SwapType;
  isEstimating?: boolean;
  isSending?: boolean;
  isEnoughTON?: boolean;
  isPriceImpactError?: boolean;
  canSubmit?: boolean;
  errorType?: SwapErrorType;
  limits?: {
    fromMin?: string;
    fromMax?: string;
  };
}

function SwapSubmitButton({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  swapType,
  isEstimating,
  isSending,
  isEnoughTON,
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
      value: formatCurrencySimple(Number(limits?.fromMin ?? 0), tokenIn?.symbol ?? '', tokenIn?.decimals),
    }),
    [SwapErrorType.ChangellyMaxSwap]: lang('Maximum amount', {
      value: formatCurrencySimple(Number(limits?.fromMax ?? 0), tokenIn?.symbol ?? '', tokenIn?.decimals),
    }),
  };

  const isTouched = Boolean(amountIn || amountOut);

  let text = lang('$swap_from_to', {
    from: tokenIn?.symbol,
    to: tokenOut?.symbol,
  });

  if (isTouched && isErrorExist) {
    text = errorMsgByType[errorType];
  } else if (isTouched && !isEnoughTON && swapType !== SwapType.CrosschainToTon) {
    text = lang('Not enough TON');
  }

  let shouldShowError = !isEstimating && ((isPriceImpactError || isErrorExist || !isEnoughTON));

  if (swapType === SwapType.CrosschainToTon) {
    shouldShowError = !isEstimating && ((isPriceImpactError || isErrorExist));
  }

  const buttonTransitionKeyRef = useRef(0);
  const buttonStateStr = `${text}_${!canSubmit}_${isTouched && shouldShowError}`;

  useSyncEffect(() => {
    buttonTransitionKeyRef.current++;
  }, [buttonStateStr]);

  return (
    <Transition
      name="fade"
      className={styles.footerButtonWrapper}
      activeKey={buttonTransitionKeyRef.current}
    >
      <Button
        className={styles.footerButton}
        isDisabled={isDisabled}
        isPrimary
        isSubmit
        isLoading={isLoading}
        isDestructive={isTouched && shouldShowError}
      >
        {text}
      </Button>
    </Transition>
  );
}

export default memo(SwapSubmitButton);
