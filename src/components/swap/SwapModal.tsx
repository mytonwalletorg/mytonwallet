import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiActivity } from '../../api/types';
import type { GlobalState, UserSwapToken } from '../../global/types';
import { SwapState, SwapType } from '../../global/types';

import { IS_CAPACITOR } from '../../config';
import { selectCurrentAccountState, selectSwapTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatCurrencyExtended } from '../../util/formatNumber';
import resolveModalTransitionName from '../../util/resolveModalTransitionName';
import getBlockchainNetworkIcon from '../../util/swap/getBlockchainNetworkIcon';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';

import TokenSelector from '../common/TokenSelector';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';
import SwapBlockchain from './SwapBlockchain';
import SwapComplete from './SwapComplete';
import SwapInitial from './SwapInitial';
import SwapPassword from './SwapPassword';
import SwapWaitTokens from './SwapWaitTokens';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Swap.module.scss';

interface StateProps {
  currentSwap: GlobalState['currentSwap'];
  swapTokens?: UserSwapToken[];
  activityById?: Record<string, ApiActivity>;
}

function SwapModal({
  currentSwap: {
    state,
    tokenInSlug,
    tokenOutSlug,
    amountIn = '0',
    amountOut = '0',
    isLoading,
    error,
    activityId,
    swapType,
    toAddress,
    payinAddress,
    payinExtraId,
    isSettingsModalOpen,
  },
  swapTokens,
  activityById,
}: StateProps) {
  const {
    startSwap,
    cancelSwap,
    setSwapScreen,
    submitSwap,
    showActivityInfo,
    submitSwapCexFromToncoin,
    submitSwapCexToToncoin,
  } = getActions();
  const lang = useLang();
  const { isPortrait } = useDeviceScreen();

  const isOpen = state !== SwapState.None;
  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);

  const tokenIn = useMemo(
    () => swapTokens?.find((token) => token.slug === tokenInSlug),
    [tokenInSlug, swapTokens],
  );

  const tokenOut = useMemo(
    () => swapTokens?.find((token) => token.slug === tokenOutSlug),
    [swapTokens, tokenOutSlug],
  );

  const [renderedSwapType, setRenderedSwapType] = useState(swapType);
  const [renderedTransactionAmountIn, setRenderedTransactionAmountIn] = useState(amountIn);
  const [renderedTransactionAmountOut, setRenderedTransactionAmountOut] = useState(amountOut);
  const [renderedTransactionTokenIn, setRenderedTransactionTokenIn] = useState(tokenIn);
  const [renderedTransactionTokenOut, setRenderedTransactionTokenOut] = useState(tokenOut);
  const [renderedActivity, setRenderedActivity] = useState<ApiActivity | undefined>();

  useEffect(() => {
    if (!isOpen || !activityById || !activityId || swapType !== SwapType.CrosschainToToncoin) {
      setRenderedActivity(undefined);
      return;
    }

    const activity = activityById[activityId];
    setRenderedActivity(activity);

    if (activity.kind === 'swap') {
      const status = activity.cex?.status;
      if (status === 'exchanging' || status === 'confirming') {
        setSwapScreen({ state: SwapState.Complete });
      }
    }
  }, [activityById, activityId, isOpen, swapType]);

  const handleTransferSubmit = useLastCallback((password: string) => {
    setRenderedTransactionAmountIn(amountIn);
    setRenderedTransactionAmountOut(amountOut);
    setRenderedTransactionTokenIn(tokenIn);
    setRenderedTransactionTokenOut(tokenOut);
    setRenderedSwapType(swapType);

    if (swapType === SwapType.OnChain) {
      submitSwap({ password });
      return;
    }

    if (swapType === SwapType.CrosschainToToncoin) {
      submitSwapCexToToncoin({ password });
    } else {
      submitSwapCexFromToncoin({ password });
    }
  });

  const handleBackClick = useLastCallback(() => {
    if (state === SwapState.Password) {
      if (swapType === SwapType.CrosschainFromToncoin) {
        setSwapScreen({ state: SwapState.Blockchain });
      } else {
        setSwapScreen({ state: isPortrait ? SwapState.Initial : SwapState.None });
      }
      return;
    }

    if (state === SwapState.SelectTokenTo || state === SwapState.SelectTokenFrom) {
      setSwapScreen({ state: isPortrait ? SwapState.Initial : SwapState.None });
    }

    if (state === SwapState.Blockchain) {
      setSwapScreen({ state: isPortrait ? SwapState.Initial : SwapState.None });
    }
  });

  const handleTransactionInfoClick = useLastCallback(() => {
    cancelSwap({ shouldReset: true });
    showActivityInfo({ id: activityId! });
  });

  const handleModalClose = useLastCallback(() => {
    cancelSwap({ shouldReset: isPortrait });
    updateNextKey();
  });

  const handleModalCloseWithReset = useLastCallback(() => {
    cancelSwap({ shouldReset: true });
  });

  const handleStartSwap = useLastCallback(() => {
    startSwap({
      amountIn: renderedTransactionAmountIn,
      tokenInSlug: renderedTransactionTokenIn?.slug,
      tokenOutSlug: renderedTransactionTokenOut?.slug,
    });
  });

  function renderSwapShortInfo() {
    if (!tokenIn || !tokenOut || !amountIn || !amountOut) return undefined;

    const logoIn = tokenIn.image ?? ASSET_LOGO_PATHS[tokenIn.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
    const logoOut = tokenOut.image ?? ASSET_LOGO_PATHS[tokenOut.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
    const swapInfoClassName = buildClassName(
      styles.swapShortInfo,
      !IS_CAPACITOR && styles.swapShortInfoInsidePasswordForm,
    );

    return (
      <div className={swapInfoClassName}>
        <div className={styles.tokenIconWrapper}>
          <img src={logoIn} alt={tokenIn.symbol} className={styles.swapShortInfoTokenIcon} />
          {tokenIn.blockchain && (
            <img
              src={getBlockchainNetworkIcon(tokenIn.blockchain)}
              className={styles.swapShortInfoBlockchainIcon}
              alt={tokenIn.blockchain}
            />
          )}
        </div>
        <span className={styles.swapShortValue}>
          {lang('%amount_from% to %amount_to%', {
            amount_from: (
              <span className={styles.swapShortAmount}>
                {formatCurrencyExtended(amountIn, tokenIn.symbol ?? '', true)}
              </span>),
            amount_to: (
              <span className={styles.swapShortAmount}>
                {formatCurrencyExtended(amountOut, tokenOut.symbol ?? '', true)}
              </span>),
          })}
        </span>
        <div className={styles.tokenIconWrapper}>
          <img src={logoOut} alt={tokenOut.symbol} className={styles.swapShortInfoTokenIcon} />
          {tokenOut.blockchain && (
            <img
              src={getBlockchainNetworkIcon(tokenOut.blockchain)}
              className={styles.swapShortInfoBlockchainIcon}
              alt={tokenOut.blockchain}
            />
          )}
        </div>
      </div>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case SwapState.Initial:
        return (
          <>
            <ModalHeader
              title={lang('SwapTitle')}
              onClose={cancelSwap}
            />
            <SwapInitial isActive={isActive} />
          </>
        );
      case SwapState.Blockchain:
        return (
          <SwapBlockchain
            isActive={isActive}
            toAddress={toAddress}
            tokenIn={tokenIn}
            tokenOut={tokenOut}
            swapType={swapType}
          />
        );
      case SwapState.WaitTokens:
        return (
          <SwapWaitTokens
            isActive={isActive}
            tokenIn={renderedTransactionTokenIn}
            tokenOut={renderedTransactionTokenOut}
            amountIn={renderedTransactionAmountIn}
            amountOut={renderedTransactionAmountOut}
            payinAddress={payinAddress}
            payinExtraId={payinExtraId}
            activity={renderedActivity}
            onClose={handleModalCloseWithReset}
          />
        );
      case SwapState.Password:
        return (
          <SwapPassword
            isActive={isActive}
            isLoading={isLoading}
            error={error}
            onSubmit={handleTransferSubmit}
            onBack={handleBackClick}
          >
            {renderSwapShortInfo()}
          </SwapPassword>
        );
      case SwapState.Complete:
        return (
          <SwapComplete
            isActive={isActive}
            tokenIn={renderedTransactionTokenIn}
            tokenOut={renderedTransactionTokenOut}
            amountIn={renderedTransactionAmountIn}
            amountOut={renderedTransactionAmountOut}
            onInfoClick={handleTransactionInfoClick}
            onStartSwap={handleStartSwap}
            swapType={renderedSwapType}
            toAddress={toAddress}
            onClose={handleModalCloseWithReset}
          />
        );
      case SwapState.SelectTokenFrom:
      case SwapState.SelectTokenTo:
        return (
          <TokenSelector
            isActive={isActive}
            shouldFilter={currentKey === SwapState.SelectTokenTo}
            onBack={handleBackClick}
            onClose={handleModalCloseWithReset}
          />
        );
    }
  }

  const forceFullNative = isSettingsModalOpen || (
    [SwapState.Password, SwapState.SelectTokenFrom, SwapState.SelectTokenTo].includes(renderingKey)
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={cancelSwap}
      noBackdropClose
      dialogClassName={styles.modalDialog}
      nativeBottomSheetKey="swap"
      forceFullNative={forceFullNative}
      hasCloseButton
      onCloseAnimationEnd={handleModalClose}
    >
      <Transition
        name={resolveModalTransitionName()}
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingKey}
        nextKey={nextKey}
        onStop={updateNextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const accountState = selectCurrentAccountState(global);
  const activityById = accountState?.activities?.byId;

  return {
    currentSwap: global.currentSwap,
    swapTokens: selectSwapTokens(global),
    activityById,
  };
})(SwapModal));
