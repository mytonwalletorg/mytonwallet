import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChain } from '../../api/types';
import type {
  Account, ActionPayloads, AssetPairs, GlobalState, UserSwapToken,
} from '../../global/types';
import type { LangFn } from '../../hooks/useLang';
import type { ExplainedSwapFee } from '../../util/fee/swapFee';
import type { FeePrecision, FeeTerms } from '../../util/fee/types';
import { SwapInputSource, SwapState, SwapType } from '../../global/types';

import {
  ANIMATED_STICKER_TINY_SIZE_PX,
  ANIMATION_LEVEL_MAX,
  CHAIN_CONFIG,
  CHANGELLY_AML_KYC,
  CHANGELLY_PRIVACY_POLICY,
  CHANGELLY_TERMS_OF_USE,
  DEFAULT_SWAP_SECOND_TOKEN_SLUG,
  TONCOIN,
} from '../../config';
import { selectCurrentAccount, selectIsMultichainAccount, selectSwapTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { findChainConfig } from '../../util/chain';
import { fromDecimal, toDecimal } from '../../util/decimals';
import { explainSwapFee, getMaxSwapAmount, isBalanceSufficientForSwap } from '../../util/fee/swapFee';
import { formatCurrency } from '../../util/formatNumber';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import { isBackgroundModeActive } from '../../hooks/useBackgroundMode';
import useDebouncedCallback from '../../hooks/useDebouncedCallback';
import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious from '../../hooks/usePrevious';
import useSyncEffect from '../../hooks/useSyncEffect';
import useThrottledCallback from '../../hooks/useThrottledCallback';

import FeeDetailsModal from '../common/FeeDetailsModal';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import FeeLine from '../ui/FeeLine';
import RichNumberInput from '../ui/RichNumberInput';
import Transition from '../ui/Transition';
import SwapSelectToken from './components/SwapSelectToken';
import SwapSubmitButton from './components/SwapSubmitButton';
import SwapDexChooser from './SwapDexChooser';
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
    networkFee,
    realNetworkFee,
    priceImpact = 0,
    inputSource,
    swapType,
    limits,
    isLoading,
    pairs,
    dieselStatus,
    ourFee,
    ourFeePercent,
    dieselFee,
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
    setSwapIsMaxAmount,
    setSwapAmountOut,
    switchSwapTokens,
    estimateSwap,
    estimateSwapCex,
    setSwapScreen,
    loadSwapPairs,
    setSwapType,
    setSwapCexAddress,
    authorizeDiesel,
    showNotification,
  } = getActions();
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const inputInRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const inputOutRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const estimateIntervalId = useRef<number>(null);

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
  const nativeBalance = nativeUserTokenIn?.amount ?? 0n;

  const amountInBigint = amountIn && tokenIn ? fromDecimal(amountIn, tokenIn.decimals) : undefined;
  const amountOutBigint = amountOut && tokenOut ? fromDecimal(amountOut, tokenOut.decimals) : undefined;
  const balanceIn = tokenIn?.amount ?? 0n;

  const explainedFee = useMemo(
    () => explainSwapFee({
      swapType,
      tokenInSlug,
      networkFee,
      realNetworkFee,
      ourFee,
      dieselStatus,
      dieselFee,
      nativeTokenInBalance: nativeBalance,
    }),
    [swapType, tokenInSlug, networkFee, realNetworkFee, ourFee, dieselStatus, dieselFee, nativeBalance],
  );

  const maxAmount = getMaxSwapAmount({
    swapType,
    tokenInBalance: balanceIn,
    tokenIn,
    fullNetworkFee: explainedFee.fullFee?.networkTerms,
    ourFeePercent,
  });

  // Note: this constant has 3 distinct meaningful values
  const isEnoughBalance = isBalanceSufficientForSwap({
    swapType,
    tokenInBalance: balanceIn,
    tokenIn,
    fullNetworkFee: explainedFee.fullFee?.networkTerms,
    ourFeePercent,
    amountIn,
    nativeTokenInBalance: nativeBalance,
  });

  const networkFeeBigint = networkFee !== undefined && nativeUserTokenIn
    ? fromDecimal(networkFee, nativeUserTokenIn.decimals)
    : 0n;
  const isEnoughNative = nativeBalance >= networkFeeBigint;

  const isDieselNotAuthorized = explainedFee.isGasless && dieselStatus === 'not-authorized';

  const canSubmit = isDieselNotAuthorized || (
    (amountInBigint ?? 0n) > 0n
    && (amountOutBigint ?? 0n) > 0n
    && isEnoughBalance
    && (!explainedFee.isGasless || dieselStatus === 'available')
    && !isEstimating
    && errorType === undefined
  );

  const hasAmountInError = amountInBigint !== undefined && maxAmount !== undefined && amountInBigint > maxAmount;
  const amountOutValue = (amountInBigint ?? 0n) <= 0n && inputSource === SwapInputSource.In
    ? ''
    : amountOut?.toString();
  const isAmountGreaterThanBalance = balanceIn !== undefined && amountInBigint !== undefined
    && amountInBigint > balanceIn;
  const isInsufficientFee = isEnoughBalance === false && !isAmountGreaterThanBalance;

  const isPriceImpactError = priceImpact >= MAX_PRICE_IMPACT_VALUE;
  const isCrosschain = swapType === SwapType.CrosschainFromWallet || swapType === SwapType.CrosschainToWallet;

  const [isBuyAmountInputDisabled, handleBuyAmountInputClick] = useReverseProhibited(
    isCrosschain,
    pairs?.bySlug,
    currentTokenInSlug,
    currentTokenOutSlug,
    showNotification,
    lang,
  );

  const handleEstimateSwap = useLastCallback((shouldBlock: boolean) => {
    if (!isActive || isBackgroundModeActive()) return;

    if (isCrosschain) {
      estimateSwapCex({ shouldBlock });
      return;
    }

    estimateSwap({
      shouldBlock,
      isEnoughToncoin: isEnoughNative,
      toncoinBalance: nativeBalance,
    });
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

  const [currentSubModal, openSettingsModal, openFeeModal, closeSubModal] = useSubModals(explainedFee);

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

  const handleAmountInChange = useLastCallback(
    (amount: string | undefined) => {
      setSwapIsMaxAmount({ isMaxAmount: false });
      debounceSetAmountIn({ amount: amount || undefined });
    },
  );

  const handleAmountOutChange = useLastCallback(
    (amount: string | undefined) => {
      setSwapIsMaxAmount({ isMaxAmount: false });
      debounceSetAmountOut({ amount });
    },
  );

  const handleMaxAmountClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    if (maxAmount === undefined) {
      return;
    }

    void vibrate();

    const amount = toDecimal(maxAmount, tokenIn!.decimals);
    setSwapIsMaxAmount({ isMaxAmount: true });
    setSwapAmountIn({ amount });
  };

  const handleSubmit = useLastCallback((e) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    if (isDieselNotAuthorized) {
      authorizeDiesel();
      return;
    }

    vibrate();

    if (isCrosschain) {
      setSwapCexAddress({ toAddress: '' });
      if (swapType === SwapType.CrosschainToWallet) {
        setSwapScreen({ state: SwapState.Password });
      } else if (
        isMultichainAccount
        && addressByChain![tokenIn!.chain as ApiChain]
        && addressByChain![tokenOut!.chain as ApiChain]
      ) {
        setSwapCexAddress({ toAddress: addressByChain![tokenOut!.chain as ApiChain] });
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

  function renderBalance() {
    return (
      <Transition
        name="fade"
        activeKey={tokenInTransitionKey}
      >
        {maxAmount !== undefined && (
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
                    {formatCurrency(toDecimal(maxAmount, tokenIn?.decimals), tokenIn!.symbol)}
                  </div>
                ),
              })}
            </span>
          </div>
        )}
      </Transition>
    );
  }

  function renderFee() {
    const shouldShow = (amountIn && amountOut) // We aim to synchronize the disappearing of the fee with the DEX chooser disappearing
      || ((amountIn || amountOut) && errorType); // Without this sub-condition the fee wouldn't be shown when the amount is outside the Changelly limits

    let terms: FeeTerms | undefined;
    let precision: FeePrecision = 'exact';

    if (shouldShow) {
      const actualFee = isInsufficientFee ? explainedFee.fullFee : explainedFee.realFee;
      if (actualFee) {
        ({ terms, precision } = actualFee);
      }
    }

    return (
      <FeeLine
        isStatic={isStatic}
        terms={terms}
        token={tokenIn}
        precision={precision}
        keepDetailsButtonWithoutFee
        onDetailsClick={openSettingsModal}
        className={styles.feeLine}
      />
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
              disabled={isBuyAmountInputDisabled}
              onChange={handleAmountOutChange}
              onPressEnter={handleSubmit}
              onInputClick={handleBuyAmountInputClick}
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
        {!isCrosschain && <SwapDexChooser tokenIn={tokenIn} tokenOut={tokenOut} isStatic={isStatic} />}

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
        isOpen={currentSubModal === 'settings'}
        onClose={closeSubModal}
        onNetworkFeeClick={openFeeModal}
        showFullNetworkFee={isInsufficientFee}
      />
      <FeeDetailsModal
        isOpen={currentSubModal === 'feeDetails'}
        onClose={closeSubModal}
        fullFee={explainedFee.fullFee?.networkTerms}
        realFee={explainedFee.realFee?.networkTerms}
        realFeePrecision={explainedFee.realFee?.precision}
        excessFee={explainedFee.excessFee}
        excessFeePrecision="approximate"
        token={tokenIn}
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

function useReverseProhibited(
  isCrosschain: boolean,
  pairsBySlug: Record<string, AssetPairs> | undefined,
  currentTokenInSlug: string,
  currentTokenOutSlug: string,
  showNotification: (arg: ActionPayloads['showNotification']) => void,
  lang: LangFn,
) {
  const isReverseProhibited = isCrosschain
    || pairsBySlug?.[currentTokenInSlug]?.[currentTokenOutSlug]?.isReverseProhibited;
  const isBuyAmountInputDisabled = isReverseProhibited;

  const handleBuyAmountInputClick = useMemo(() => {
    return isReverseProhibited
      ? () => {
        void vibrate();
        showNotification({ message: lang('$swap_reverse_prohibited') });
      }
      : undefined;
  }, [isReverseProhibited, lang, showNotification]);

  return [isBuyAmountInputDisabled, handleBuyAmountInputClick] as const;
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

function useSubModals(explainedFee: ExplainedSwapFee) {
  const isFeeModalAvailable = explainedFee.realFee?.precision !== 'exact';
  const [currentModal, setCurrentModal] = useState<'settings' | 'feeDetails'>();

  const openSettings = useLastCallback(() => setCurrentModal('settings'));
  const openFeeDetailsIfAvailable = useMemo(
    () => (isFeeModalAvailable ? () => setCurrentModal('feeDetails') : undefined),
    [isFeeModalAvailable],
  );
  const close = useLastCallback(() => setCurrentModal(undefined));

  return [currentModal, openSettings, openFeeDetailsIfAvailable, close] as const;
}
