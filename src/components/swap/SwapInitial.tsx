import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { GlobalState, UserSwapToken } from '../../global/types';
import { SwapInputSource, SwapState, SwapType } from '../../global/types';

import {
  ANIMATED_STICKER_TINY_SIZE_PX,
  ANIMATION_LEVEL_MAX,
  CHANGELLY_AML_KYC,
  CHANGELLY_PRIVACY_POLICY,
  CHANGELLY_TERMS_OF_USE,
  DEFAULT_FEE,
  DEFAULT_SWAP_SECOND_TOKEN_SLUG,
  DIESEL_TOKENS,
  TON_SYMBOL,
  TONCOIN_SLUG,
} from '../../config';
import { Big } from '../../lib/big.js';
import { selectSwapTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { fromDecimal, toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import getSwapRate from '../../util/swap/getSwapRate';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import { isBackgroundModeActive } from '../../hooks/useBackgroundMode';
import useDebouncedCallback from '../../hooks/useDebouncedCallback';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';
import useSyncEffect from '../../hooks/useSyncEffect';
import useThrottledCallback from '../../hooks/useThrottledCallback';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import RichNumberInput from '../ui/RichNumberInput';
import Transition from '../ui/Transition';
import SwapSelectToken from './components/SwapSelectToken';
import SwapSubmitButton from './components/SwapSubmitButton';
import SwapSettingsModal, { MAX_PRICE_IMPACT_VALUE } from './SwapSettingsModal';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Swap.module.scss';

interface OwnProps {
  isStatic?: boolean;
  isActive?: boolean;
}

interface StateProps {
  currentSwap: GlobalState['currentSwap'];
  accountId?: string;
  tokens?: UserSwapToken[];
}

const ESTIMATE_REQUEST_INTERVAL = 1_000;
const SET_AMOUNT_DEBOUNCE_TIME = 500;
const DEFAULT_SWAP_FEE = 500000000n; // 0.5 TON

function SwapInitial({
  currentSwap: {
    tokenInSlug,
    tokenOutSlug,
    amountIn,
    amountOut,
    errorType,
    isEstimating,
    shouldEstimate,
    networkFee = 0,
    realNetworkFee = 0,
    priceImpact = 0,
    inputSource,
    swapType,
    limits,
    isLoading,
    pairs,
    isSettingsModalOpen,
    dieselStatus,
    swapFee,
  },
  accountId,
  tokens,
  isActive,
  isStatic,
}: OwnProps & StateProps) {
  const {
    setDefaultSwapParams,
    setSwapAmountIn,
    setSwapAmountOut,
    switchSwapTokens,
    estimateSwap,
    estimateSwapCex,
    setSwapScreen,
    loadSwapPairs,
    setSwapType,
    setSwapCexAddress,
    toggleSwapSettingsModal,
    authorizeDiesel,
  } = getActions();
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const inputInRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const inputOutRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const estimateIntervalId = useRef<number>(null);

  const [hasAmountInError, setHasAmountInError] = useState(false);

  const currentTokenInSlug = tokenInSlug ?? TONCOIN_SLUG;
  const currentTokenOutSlug = tokenOutSlug ?? DEFAULT_SWAP_SECOND_TOKEN_SLUG;

  const tokenInTransitionKey = useTokenTransitionKey(currentTokenInSlug ?? '');

  const accountIdPrev = usePrevious(accountId, true);

  const tokenIn = useMemo(
    () => tokens?.find((token) => token.slug === currentTokenInSlug),
    [currentTokenInSlug, tokens],
  );

  const tokenOut = useMemo(
    () => tokens?.find((token) => token.slug === currentTokenOutSlug),
    [currentTokenOutSlug, tokens],
  );

  const toncoin = useMemo(
    () => tokens?.find((token) => token.slug === TONCOIN_SLUG) ?? { amount: 0 },
    [tokens],
  );

  const isToncoinIn = currentTokenInSlug === TONCOIN_SLUG;
  const totalToncoinAmount = useMemo(
    () => {
      if (!tokenIn || !amountIn) {
        return 0n;
      }
      if (isToncoinIn) {
        return fromDecimal(amountIn) + fromDecimal(networkFee) + DEFAULT_FEE;
      }
      return fromDecimal(networkFee) + DEFAULT_FEE;
    },
    [tokenIn, amountIn, isToncoinIn, networkFee],
  );

  const amountInBig = useMemo(() => Big(amountIn || 0), [amountIn]);
  const amountOutBig = useMemo(() => Big(amountOut || 0), [amountOut]);
  const tokenInAmountBig = useMemo(() => toDecimal(tokenIn?.amount ?? 0n, tokenIn?.decimals), [tokenIn]);

  const isErrorExist = errorType !== undefined;
  const isEnoughToncoin = toncoin.amount > totalToncoinAmount;
  const isDieselSwap = swapType === SwapType.OnChain
    && !isEnoughToncoin
    && tokenIn?.contract
    && DIESEL_TOKENS.has(tokenIn.contract);

  // eslint-disable-next-line max-len
  const isCorrectAmountIn = Boolean(
    amountIn
    && tokenIn?.amount
    && amountInBig.gt(0)
    && amountInBig.lte(tokenInAmountBig),
  ) || swapType === SwapType.CrosschainToToncoin;
  const isEnoughFee = swapType === SwapType.CrosschainToToncoin || isEnoughToncoin || (
    dieselStatus === 'available' || dieselStatus === 'not-authorized'
  );
  const isCorrectAmountOut = amountOut && amountOutBig.gt(0);
  const canSubmit = Boolean(isCorrectAmountIn && isCorrectAmountOut && isEnoughFee && !isEstimating && !isErrorExist);
  const isPriceImpactError = priceImpact >= MAX_PRICE_IMPACT_VALUE;

  const isCrosschain = swapType === SwapType.CrosschainFromToncoin || swapType === SwapType.CrosschainToToncoin;

  const isReverseProhibited = useMemo(() => {
    return isCrosschain || pairs?.bySlug?.[currentTokenInSlug]?.[currentTokenOutSlug]?.isReverseProhibited;
  }, [currentTokenInSlug, currentTokenOutSlug, isCrosschain, pairs?.bySlug]);

  const handleEstimateSwap = useLastCallback((shouldBlock: boolean) => {
    if (!isActive || isBackgroundModeActive()) return;

    if (isCrosschain) {
      estimateSwapCex({ shouldBlock });
      return;
    }
    estimateSwap({ shouldBlock, isEnoughToncoin });
  });

  const throttledEstimateSwap = useThrottledCallback(
    handleEstimateSwap, [handleEstimateSwap], ESTIMATE_REQUEST_INTERVAL, true,
  );
  const debounceSetAmountIn = useDebouncedCallback(
    setSwapAmountIn, [setSwapAmountIn], SET_AMOUNT_DEBOUNCE_TIME, true,
  );
  const debounceSetAmountOut = useDebouncedCallback(
    setSwapAmountOut, [setSwapAmountOut], SET_AMOUNT_DEBOUNCE_TIME, true,
  );
  const createEstimateTimer = useLastCallback(() => {
    estimateIntervalId.current = window.setInterval(() => {
      throttledEstimateSwap(false);
    }, ESTIMATE_REQUEST_INTERVAL);
  });

  useEffect(() => {
    if (!tokenInSlug && !tokenOutSlug) {
      setDefaultSwapParams();
    }
  }, [tokenInSlug, tokenOutSlug]);

  useEffect(() => {
    const clearEstimateTimer = () => estimateIntervalId.current && window.clearInterval(estimateIntervalId.current);

    if (shouldEstimate) {
      clearEstimateTimer();
      throttledEstimateSwap(true);
    }

    createEstimateTimer();

    return clearEstimateTimer;
  }, [shouldEstimate, createEstimateTimer, throttledEstimateSwap]);

  useEffect(() => {
    const shouldForceUpdate = accountId !== accountIdPrev;

    if (currentTokenInSlug) {
      loadSwapPairs({ tokenSlug: currentTokenInSlug, shouldForceUpdate });
    }
    if (currentTokenOutSlug) {
      loadSwapPairs({ tokenSlug: currentTokenOutSlug, shouldForceUpdate });
    }
  }, [accountId, accountIdPrev, currentTokenInSlug, currentTokenOutSlug]);

  useEffect(() => {
    if (tokenIn?.blockchain === 'ton' && tokenOut?.blockchain !== 'ton') {
      setSwapType({ type: SwapType.CrosschainFromToncoin });
      return;
    } else if (tokenOut?.blockchain === 'ton' && tokenIn?.blockchain !== 'ton') {
      setSwapType({ type: SwapType.CrosschainToToncoin });
      return;
    }
    setSwapType({ type: SwapType.OnChain });
  }, [tokenIn, tokenOut]);

  const validateAmountIn = useLastCallback((amount: string | undefined) => {
    if (swapType === SwapType.CrosschainToToncoin) {
      setHasAmountInError(false);
      return;
    }

    const amountBig = amount === undefined ? undefined : Big(amount);
    const hasError = amountBig !== undefined && (
      amountBig.lt(0) || (tokenIn?.amount !== undefined && amountBig.gt(tokenInAmountBig))
    );

    setHasAmountInError(hasError);
  });

  useEffect(() => {
    validateAmountIn(amountIn);
  }, [amountIn, tokenIn, validateAmountIn, swapType]);

  const handleAmountInChange = useLastCallback(
    (amount: string | undefined, noReset = false) => {
      if (!noReset) {
        setHasAmountInError(false);
      }

      if (!amount) {
        debounceSetAmountIn({ amount: undefined });
        return;
      }

      validateAmountIn(amount);
      debounceSetAmountIn({ amount });
    },
  );

  const handleAmountOutChange = useLastCallback(
    (amount: string | undefined) => {
      debounceSetAmountOut({ amount });
    },
  );

  const handleMaxAmountClick = useLastCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();

      if (!tokenIn?.amount) {
        return;
      }

      vibrate();

      const amountWithFee = tokenIn.amount > DEFAULT_SWAP_FEE
        ? tokenIn.amount - DEFAULT_SWAP_FEE
        : tokenIn.amount;
      const newAmount = isToncoinIn ? amountWithFee : tokenIn.amount;
      const amount = toDecimal(newAmount, tokenIn.decimals);

      validateAmountIn(amount);
      setSwapAmountIn({ amount });
    },
  );

  const handleSubmit = useLastCallback((e) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    if (isDieselSwap && dieselStatus === 'not-authorized') {
      authorizeDiesel();
      return;
    }

    vibrate();

    if (isCrosschain) {
      setSwapCexAddress({ toAddress: '' });
      if (swapType === SwapType.CrosschainToToncoin) {
        setSwapScreen({ state: SwapState.Password });
      } else {
        setSwapScreen({ state: SwapState.Blockchain });
      }
      return;
    }

    setSwapScreen({ state: SwapState.Password });
  });

  const handleSwitchTokens = useLastCallback(() => {
    vibrate();
    switchSwapTokens();
  });

  const openSettingsModal = useLastCallback(() => {
    toggleSwapSettingsModal({ isOpen: true });
  });

  const closeSettingsModal = useLastCallback(() => {
    toggleSwapSettingsModal({ isOpen: false });
  });

  function renderBalance() {
    const isBalanceVisible = tokenIn && swapType !== SwapType.CrosschainToToncoin;

    return (
      <Transition
        name="fade"
        activeKey={tokenInTransitionKey}
      >
        {isBalanceVisible && (
          <div className={styles.balanceContainer}>
            <span className={styles.balance}>
              {lang('$max_balance', {
                balance: (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={handleMaxAmountClick}
                    className={styles.balanceLink}
                  >
                    {formatCurrency(toDecimal(tokenIn.amount, tokenIn?.decimals), tokenIn?.symbol)}
                  </div>
                ),
              })}
            </span>
          </div>
        )}
      </Transition>
    );
  }

  function renderPrice() {
    const isPriceVisible = Boolean(amountIn && amountOut);
    const shouldBeRendered = isPriceVisible && !isEstimating;

    if (!shouldBeRendered) return undefined;

    const rate = getSwapRate(
      amountIn ? String(amountIn) : undefined,
      amountOut ? String(amountOut) : undefined,
      tokenIn,
      tokenOut,
      true,
    );

    if (!rate) return undefined;

    return (
      <span className={styles.tokenPrice}>
        {rate.firstCurrencySymbol}{' ≈ '}
        <span className={styles.tokenPriceBold}>
          {rate.price}{' '}{rate.secondCurrencySymbol}
        </span>
      </span>
    );
  }

  function renderPriceImpactWarning() {
    if (!priceImpact || !isPriceImpactError || isCrosschain) {
      return undefined;
    }

    return (
      <div
        className={buildClassName(styles.priceImpact, isStatic && styles.priceImpactStatic)}
        onClick={openSettingsModal}
      >
        <AnimatedIconWithPreview
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.run}
          previewUrl={ANIMATED_STICKERS_PATHS.runPreview}
          noLoop={false}
          nonInteractive
          size={ANIMATED_STICKER_TINY_SIZE_PX}
          className={styles.priceImpactSticker}
        />
        <div className={styles.priceImpactContent}>
          <span className={styles.priceImpactTitle}>
            {lang('The exchange rate is below market value!', { value: `${priceImpact}%` })}
            <i className={buildClassName(styles.priceImpactArrow, 'icon-arrow-right-swap')} aria-hidden />
          </span>
          <span className={styles.priceImpactDescription}>
            {lang('We do not recommend to perform an exchange, try to specify a lower amount.')}
          </span>
        </div>
      </div>
    );
  }

  function renderChangellyInfo() {
    if (!isCrosschain) {
      return undefined;
    }

    return (
      <div className={buildClassName(styles.changellyInfo, isStatic && styles.changellyInfoStatic)}>
        <div className={styles.changellyInfoContent}>
          <span className={styles.changellyInfoTitle}>
            <i className={buildClassName('icon-changelly', styles.changellyIcon)} aria-hidden />
            {lang('Cross-chain exchange provided by Changelly')}
          </span>
          <span className={styles.changellyInfoDescription}>
            {
              lang('$swap_changelly_agreement_message', {
                terms: (
                  <a href={CHANGELLY_TERMS_OF_USE} target="_blank" rel="noreferrer">
                    {lang('$swap_changelly_terms_of_use')}
                  </a>
                ),
                policy: (
                  <a href={CHANGELLY_PRIVACY_POLICY} target="_blank" rel="noreferrer">
                    {lang('$swap_changelly_privacy_policy')}
                  </a>
                ),
                kyc: <a href={CHANGELLY_AML_KYC} target="_blank" rel="noreferrer">Changelly AML/KYC</a>,
              })
            }
          </span>
        </div>
      </div>
    );
  }

  function renderFee() {
    const isFeeEqualZero = realNetworkFee === 0;

    let feeBlock: React.JSX.Element | undefined;

    if (
      swapType === SwapType.OnChain
      && isDieselSwap
      && swapFee
      && tokenIn
      && tokenIn?.slug !== TONCOIN_SLUG
      && !isLoading
    ) {
      // Diesel swap
      feeBlock = (
        <span className={styles.feeText}>{lang('$fee_value', {
          fee: formatCurrency(swapFee, tokenIn.symbol),
        })}
        </span>
      );
    } else if (swapType !== SwapType.CrosschainToToncoin) {
      feeBlock = (
        <span className={styles.feeText}>{lang(isFeeEqualZero ? '$fee_value' : '$fee_value_almost_equal', {
          fee: formatCurrency(realNetworkFee, TON_SYMBOL),
        })}
        </span>
      );
    }

    const priceBlock = renderPrice();
    const activeKey = (isFeeEqualZero ? 0 : 1) + (priceBlock ? 2 : 3);

    return (
      <Transition
        name="fade"
        activeKey={activeKey}
        className={styles.feeWrapper}
      >
        <div
          className={buildClassName(
            styles.feeContent,
            !isCrosschain && styles.feeContentClickable,
          )}
          onClick={isCrosschain ? undefined : openSettingsModal}
        >
          {priceBlock}
          {feeBlock}

          {
            isCrosschain
              ? undefined
              : <i className={buildClassName(styles.feeIcon, 'icon-params')} aria-hidden />
          }
        </div>
      </Transition>
    );
  }

  return (
    <>
      <form className={isStatic ? undefined : modalStyles.transitionContent} onSubmit={handleSubmit}>
        <div className={styles.content}>
          <div ref={inputInRef} className={styles.inputContainer}>
            {renderBalance()}
            <RichNumberInput
              id="swap-sell"
              labelText={lang('You sell')}
              className={styles.amountInput}
              hasError={hasAmountInError}
              value={amountIn?.toString()}
              isLoading={isEstimating && inputSource === SwapInputSource.Out}
              onChange={handleAmountInChange}
              onPressEnter={handleSubmit}
              decimals={tokenIn?.decimals}
              labelClassName={styles.inputLabel}
              inputClassName={styles.amountInputInner}
              cornerClassName={buildClassName(styles.swapCornerTop, isStatic && styles.swapCornerStaticTop)}
              isStatic={isStatic}
            >
              <SwapSelectToken token={tokenIn} />
            </RichNumberInput>
          </div>

          <div className={buildClassName(styles.swapButtonWrapper, isStatic && styles.swapButtonWrapperStatic)}>
            <AnimatedArrows onClick={handleSwitchTokens} />
          </div>

          <div ref={inputOutRef} className={styles.inputContainer}>
            <RichNumberInput
              id="swap-buy"
              labelText={lang('You buy')}
              className={styles.amountInputBuy}
              value={amountOut?.toString()}
              isLoading={isEstimating && inputSource === SwapInputSource.In}
              disabled={isReverseProhibited}
              onChange={handleAmountOutChange}
              onPressEnter={handleSubmit}
              decimals={tokenOut?.decimals}
              labelClassName={styles.inputLabel}
              inputClassName={styles.amountInputInner}
              cornerClassName={buildClassName(styles.swapCornerBottom, isStatic && styles.swapCornerStaticBottom)}
              isStatic={isStatic}
            >
              <SwapSelectToken token={tokenOut} shouldFilter />
            </RichNumberInput>
          </div>
        </div>

        <div className={buildClassName(styles.footerBlock, isStatic && styles.footerBlockStatic)}>
          {renderFee()}

          {renderPriceImpactWarning()}
          {renderChangellyInfo()}

          <SwapSubmitButton
            tokenIn={tokenIn}
            tokenOut={tokenOut}
            amountIn={amountIn}
            amountOut={amountOut}
            swapType={swapType}
            isEstimating={isEstimating}
            isEnoughToncoin={isEnoughToncoin}
            dieselStatus={dieselStatus}
            isSending={isLoading}
            isPriceImpactError={isPriceImpactError}
            canSubmit={canSubmit}
            errorType={errorType}
            limits={limits}
          />
        </div>
      </form>
      <SwapSettingsModal
        isOpen={Boolean(isSettingsModalOpen)}
        tokenOut={tokenOut}
        fee={realNetworkFee}
        onClose={closeSettingsModal}
      />
    </>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      return {
        accountId: global.currentAccountId,
        currentSwap: global.currentSwap,
        tokens: selectSwapTokens(global),
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(SwapInitial),
);

function useTokenTransitionKey(tokenSlug: string) {
  const transitionKeyRef = useRef(0);

  useSyncEffect(() => {
    transitionKeyRef.current++;
  }, [tokenSlug]);

  return transitionKeyRef.current;
}

function AnimatedArrows({ onClick }: { onClick?: NoneToVoidFunction }) {
  const animationLevel = getGlobal().settings.animationLevel;
  const shouldAnimate = (animationLevel === ANIMATION_LEVEL_MAX);
  const [hasAnimation, startAnimation, stopAnimation] = useFlag(false);

  const handleClick = useLastCallback(() => {
    if (shouldAnimate) {
      startAnimation();
      window.setTimeout(() => {
        stopAnimation();
      }, 350);
    }

    onClick?.();
  });

  function renderArrow(isInverted?: boolean) {
    return (
      <div className={buildClassName(styles.arrowContainer, isInverted && styles.arrowContainerInverted)}>
        <div className={styles.arrow}>
          <i className="icon-arrow-up-swap" aria-hidden />
        </div>
        <div className={buildClassName(styles.arrowOld, hasAnimation && styles.animateDisappear)}>
          <i className="icon-arrow-up-swap" aria-hidden />
        </div>
        <div className={buildClassName(styles.arrowNew, hasAnimation && styles.animateAppear)}>
          <i className="icon-arrow-up-swap" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.swapButton} onClick={handleClick}>
      {renderArrow()}
      {renderArrow(true)}
    </div>
  );
}
