import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChain } from '../../api/types';
import type {
  Account, ActionPayloads, AssetPairs, GlobalState, UserSwapToken,
} from '../../global/types';
import type { LangFn } from '../../hooks/useLang';
import { SwapInputSource, SwapState, SwapType } from '../../global/types';

import {
  ANIMATED_STICKER_TINY_SIZE_PX,
  ANIMATION_LEVEL_MAX,
  CHAIN_CONFIG,
  CHANGELLY_AML_KYC,
  CHANGELLY_PRIVACY_POLICY,
  CHANGELLY_TERMS_OF_USE,
  DEFAULT_OUR_SWAP_FEE,
  DEFAULT_SWAP_SECOND_TOKEN_SLUG,
  TONCOIN,
} from '../../config';
import { Big } from '../../lib/big.js';
import { selectCurrentAccount, selectIsMultichainAccount, selectSwapTokens } from '../../global/selectors';
import { bigintDivideToNumber, bigintMax } from '../../util/bigint';
import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { findChainConfig } from '../../util/chain';
import { fromDecimal, toDecimal } from '../../util/decimals';
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

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
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
    networkFee = '0',
    realNetworkFee = '0',
    priceImpact = 0,
    inputSource,
    swapType,
    limits,
    isLoading,
    pairs,
    isSettingsModalOpen,
    dieselStatus,
    ourFeePercent = DEFAULT_OUR_SWAP_FEE,
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
    toggleSwapSettingsModal,
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
  const nativeBalance = nativeUserTokenIn?.amount ?? 0n;
  const isNativeIn = currentTokenInSlug && currentTokenInSlug === nativeTokenInSlug;
  const isTonIn = tokenIn?.chain === 'ton';

  const amountInBigint = amountIn && tokenIn ? fromDecimal(amountIn, tokenIn.decimals) : 0n;
  const amountOutBigint = amountOut && tokenOut ? fromDecimal(amountOut, tokenOut.decimals) : 0n;
  const balanceIn = tokenIn?.amount ?? 0n;

  const networkFeeBigint = (() => {
    let value = 0n;

    if (Number(networkFee) > 0) {
      value = fromDecimal(networkFee, nativeUserTokenIn?.decimals);
    }

    return value;
  })();

  const dieselFeeBigint = dieselFee && tokenIn ? fromDecimal(dieselFee, tokenIn.decimals) : 0n;

  const maxAmount = (() => {
    let value = balanceIn;

    if (isNativeIn) {
      value -= networkFeeBigint;
    }

    if (swapType === SwapType.OnChain) {
      if (dieselFeeBigint) {
        value -= dieselFeeBigint;
      }

      if (ourFeePercent) {
        value = bigintDivideToNumber(value, 1 + (ourFeePercent / 100));
      }
    }

    return bigintMax(value, 0n);
  })();

  const totalNativeAmount = networkFeeBigint + (isNativeIn ? amountInBigint : 0n);
  const isEnoughNative = nativeBalance >= totalNativeAmount;
  const amountOutValue = amountInBigint <= 0n && inputSource === SwapInputSource.In
    ? ''
    : amountOut?.toString();

  const dieselRealFee = useMemo(() => {
    if (!dieselFee || !realNetworkFee) return 0;

    const nativeDeficit = toDecimal(totalNativeAmount - nativeBalance);
    return Big(dieselFee!).div(nativeDeficit).mul(realNetworkFee ?? 0).toNumber();
  }, [dieselFee, totalNativeAmount, nativeBalance, realNetworkFee]);

  const isErrorExist = errorType !== undefined;

  const isGaslessSwap = Boolean(swapType === SwapType.OnChain
    && !isEnoughNative
    && tokenIn?.tokenAddress
    && dieselStatus
    && dieselStatus !== 'not-available');

  const isCorrectAmountIn = Boolean(
    amountIn
    && tokenIn
    && amountInBigint > 0
    && amountInBigint <= maxAmount,
  ) || (tokenIn && !nativeTokenInSlug);

  const isEnoughFee = swapType !== SwapType.CrosschainToWallet
    ? (isEnoughNative && (swapType === SwapType.CrosschainFromWallet || swapType === SwapType.OnChain))
    || (swapType === SwapType.OnChain && dieselStatus && ['available', 'not-authorized'].includes(dieselStatus))
    : true;

  const isCorrectAmountOut = amountOut && amountOutBigint > 0;
  const canSubmit = Boolean(isCorrectAmountIn && isCorrectAmountOut && isEnoughFee && !isEstimating && !isErrorExist);

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

    const hasError = fromDecimal(amount, tokenIn.decimals) > maxAmount;
    setHasAmountInError(hasError);
  });

  useEffect(() => {
    validateAmountIn(amountIn);
  }, [amountIn, tokenIn, validateAmountIn, swapType, maxAmount]);

  const handleAmountInChange = useLastCallback(
    (amount: string | undefined, noReset = false) => {
      setSwapIsMaxAmount({ isMaxAmount: false });
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
      setSwapIsMaxAmount({ isMaxAmount: false });
      debounceSetAmountOut({ amount });
    },
  );

  const handleMaxAmountClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();

    void vibrate();

    const amount = toDecimal(maxAmount, tokenIn!.decimals);
    validateAmountIn(amount);
    setSwapIsMaxAmount({ isMaxAmount: true });
    setSwapAmountIn({ amount });
  };

  const handleSubmit = useLastCallback((e) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    if (isGaslessSwap && dieselStatus === 'not-authorized') {
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
          {renderPriceImpactWarning()}
          {renderChangellyInfo()}

          <div className={styles.footerButtonsContainer}>
            <Button
              isText
              isSimple
              className={styles.detailsButton}
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => toggleSwapSettingsModal({ isOpen: true })}
            >
              {lang('Details')}
            </Button>

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

        </div>
      </form>
      <SwapSettingsModal
        isOpen={Boolean(isSettingsModalOpen)}
        onClose={closeSettingsModal}
        isGaslessSwap={isGaslessSwap}
        realNetworkFeeInDiesel={dieselRealFee}
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
