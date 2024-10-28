import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChain } from '../../api/types';
import type { Account, GlobalState, UserSwapToken } from '../../global/types';
import { SwapInputSource, SwapState, SwapType } from '../../global/types';

import {
  ANIMATED_STICKER_TINY_SIZE_PX,
  ANIMATION_LEVEL_MAX,
  CHAIN_CONFIG,
  CHANGELLY_AML_KYC,
  CHANGELLY_PRIVACY_POLICY,
  CHANGELLY_TERMS_OF_USE,
  DEFAULT_SWAP_SECOND_TOKEN_SLUG,
  DIESEL_TOKENS,
  TONCOIN,
  TRX,
} from '../../config';
import { selectCurrentAccount, selectIsMultichainAccount, selectSwapTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { findChainConfig, getChainConfig } from '../../util/chain';
import { fromDecimal, toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import getSwapRate from '../../util/swap/getSwapRate';
import { getIsNativeToken } from '../../util/tokens';
import { ONE_TRX } from '../../api/chains/tron/constants';
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
  addressByChain?: Account['addressByChain'];
  currentSwap: GlobalState['currentSwap'];
  accountId?: string;
  tokens?: UserSwapToken[];
  isMultichainAccount?: boolean;
}

const ESTIMATE_REQUEST_INTERVAL = 1_000;
const SET_AMOUNT_DEBOUNCE_TIME = 500;

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
  addressByChain,
  tokens,
  isActive,
  isStatic,
  isMultichainAccount,
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

  const currentTokenInSlug = tokenInSlug ?? TONCOIN.slug;
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

  const nativeTokenInSlug = isMultichainAccount || tokenIn?.chain === 'ton'
    ? findChainConfig(tokenIn?.chain)?.nativeToken.slug
    : undefined;
  const nativeUserTokenIn = useMemo(
    () => tokens?.find((token) => token.slug === nativeTokenInSlug),
    [nativeTokenInSlug, tokens],
  );
  const isNativeIn = currentTokenInSlug && currentTokenInSlug === nativeTokenInSlug;
  const chainConfigIn = nativeUserTokenIn ? getChainConfig(nativeUserTokenIn.chain as ApiChain) : undefined;
  const isTonIn = tokenIn?.chain === 'ton';
  const visibleNetworkFee = isTonIn ? realNetworkFee : networkFee;

  const amountInBigint = amountIn && tokenIn ? fromDecimal(amountIn, tokenIn.decimals) : 0n;
  const amountOutBigint = amountOut && tokenOut ? fromDecimal(amountOut, tokenOut.decimals) : 0n;
  const balanceIn = useMemo(() => {
    let value = tokenIn?.amount ?? 0n;
    if (tokenIn?.slug === TRX.slug && isMultichainAccount) {
      // We always need to leave 1 TRX on balance
      value = value > ONE_TRX ? value - ONE_TRX : 0n;
    }
    return value;
  }, [tokenIn, isMultichainAccount]);
  const networkFeeBigint = useMemo(() => {
    let value = 0n;

    if (!chainConfigIn) {
      return value;
    }

    if (networkFee > 0) {
      value = fromDecimal(networkFee, nativeUserTokenIn?.decimals);
    } else if (swapType === SwapType.OnChain) {
      value = chainConfigIn?.gas.maxSwap ?? 0n;
    } else if (swapType === SwapType.CrosschainFromWallet) {
      value = getIsNativeToken(tokenInSlug) ? chainConfigIn.gas.maxTransfer : chainConfigIn.gas.maxTransferToken;
    }

    return value;
  }, [networkFee, nativeUserTokenIn, chainConfigIn, swapType, tokenInSlug]);
  const totalNativeAmount = networkFeeBigint + (isNativeIn ? amountInBigint : 0n);
  const isEnoughNative = nativeUserTokenIn && nativeUserTokenIn.amount >= totalNativeAmount;
  const amountOutValue = amountInBigint <= 0n && inputSource === SwapInputSource.In
    ? ''
    : amountOut?.toString();

  const isErrorExist = errorType !== undefined;

  const isDieselSwap = swapType === SwapType.OnChain
    && !isEnoughNative
    && tokenIn?.tokenAddress
    && DIESEL_TOKENS.has(tokenIn.tokenAddress);

  const isCorrectAmountIn = Boolean(
    amountIn
    && tokenIn
    && amountInBigint > 0
    && amountInBigint <= balanceIn,
  ) || (tokenIn && !nativeTokenInSlug);

  const isEnoughFee = swapType !== SwapType.CrosschainToWallet
    ? (isEnoughNative && (swapType === SwapType.CrosschainFromWallet || swapType === SwapType.OnChain))
    || (swapType === SwapType.OnChain && dieselStatus && ['available', 'not-authorized'].includes(dieselStatus))
    : true;

  const isCorrectAmountOut = amountOut && amountOutBigint > 0;
  const canSubmit = Boolean(isCorrectAmountIn && isCorrectAmountOut && isEnoughFee && !isEstimating && !isErrorExist);

  const isPriceImpactError = priceImpact >= MAX_PRICE_IMPACT_VALUE;
  const isCrosschain = swapType === SwapType.CrosschainFromWallet || swapType === SwapType.CrosschainToWallet;

  const isReverseProhibited = useMemo(() => {
    return isCrosschain || pairs?.bySlug?.[currentTokenInSlug]?.[currentTokenOutSlug]?.isReverseProhibited;
  }, [currentTokenInSlug, currentTokenOutSlug, isCrosschain, pairs?.bySlug]);

  const handleEstimateSwap = useLastCallback((shouldBlock: boolean) => {
    if (!isActive || isBackgroundModeActive()) return;

    if (isCrosschain) {
      estimateSwapCex({ shouldBlock });
      return;
    }
    estimateSwap({ shouldBlock, isEnoughToncoin: isEnoughNative });
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
    if (!tokenIn || !tokenOut) {
      return;
    }

    const isInTonToken = tokenIn?.chain === 'ton';
    const isOutTonToken = tokenOut?.chain === 'ton';

    if (isInTonToken && isOutTonToken) {
      setSwapType({ type: SwapType.OnChain });
      return;
    }

    if (isMultichainAccount) {
      if (tokenIn.chain in CHAIN_CONFIG) {
        setSwapType({ type: SwapType.CrosschainFromWallet });
      } else {
        setSwapType({ type: SwapType.CrosschainToWallet });
      }
      return;
    }

    if (isInTonToken && !isOutTonToken) {
      setSwapType({ type: SwapType.CrosschainFromWallet });
    } else if (!isInTonToken && isOutTonToken) {
      setSwapType({ type: SwapType.CrosschainToWallet });
    }
  }, [tokenIn, tokenOut, isMultichainAccount]);

  const validateAmountIn = useLastCallback((amount: string | undefined) => {
    if (swapType === SwapType.CrosschainToWallet || !amount || !tokenIn) {
      setHasAmountInError(false);
      return;
    }

    const hasError = fromDecimal(amount, tokenIn.decimals) > balanceIn;
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

      vibrate();

      let maxAmount = balanceIn;

      if (isNativeIn) {
        maxAmount -= networkFeeBigint;

        if (swapType === SwapType.OnChain) {
          const amountForNextSwap = chainConfigIn?.gas.maxSwap ?? 0n;
          const shouldIgnoreNextSwap = amountInBigint > 0n && (maxAmount - amountInBigint) <= amountForNextSwap;
          if (!shouldIgnoreNextSwap && maxAmount > amountForNextSwap) {
            maxAmount -= amountForNextSwap;
          }
        }
      }

      const amount = toDecimal(maxAmount, tokenIn!.decimals);
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
      if (swapType === SwapType.CrosschainToWallet) {
        setSwapScreen({ state: SwapState.Password });
      } else if (isMultichainAccount && addressByChain![tokenIn!.chain as ApiChain]) {
        setSwapCexAddress({ toAddress: addressByChain![tokenIn!.chain as ApiChain] });
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
    const isBalanceVisible = Boolean(isMultichainAccount ? nativeTokenInSlug : isTonIn);

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
                    {formatCurrency(toDecimal(tokenIn!.amount, tokenIn?.decimals), tokenIn!.symbol)}
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
    const shouldRenderDieselSwapFee = Boolean(
      swapType === SwapType.OnChain
      && isDieselSwap
      && !isLoading
      && swapFee
      && tokenIn
      && tokenIn.slug !== TONCOIN.slug
      && tokenOut?.slug === TONCOIN.slug,
    );

    if (shouldRenderDieselSwapFee) {
      feeBlock = (
        <span className={styles.feeText}>
          {lang('$fee_value', { fee: formatCurrency(swapFee!, tokenIn!.symbol, undefined, true) })}
        </span>
      );
    } else if (nativeUserTokenIn) {
      if (!isEnoughNative && isTonIn && !isFeeEqualZero) {
        feeBlock = (
          <span className={styles.feeText}>{lang('$fee_value_less', {
            fee: formatCurrency(
              toDecimal(totalNativeAmount, nativeUserTokenIn.decimals),
              nativeUserTokenIn.symbol,
              undefined,
              true,
            ),
          })}
          </span>
        );
      } else {
        feeBlock = (
          <span className={styles.feeText}>{lang(isFeeEqualZero ? '$fee_value' : '$fee_value_almost_equal', {
            fee: formatCurrency(visibleNetworkFee, nativeUserTokenIn.symbol, undefined, true),
          })}
          </span>
        );
      }
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
              value={amountOutValue}
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
            isNotEnoughNative={!isEnoughNative}
            nativeToken={nativeUserTokenIn}
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
      const account = selectCurrentAccount(global);

      return {
        accountId: global.currentAccountId,
        currentSwap: global.currentSwap,
        tokens: selectSwapTokens(global),
        addressByChain: account?.addressByChain,
        isMultichainAccount: selectIsMultichainAccount(global, global.currentAccountId!),
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
