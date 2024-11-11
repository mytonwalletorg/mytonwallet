import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiActivity } from '../../api/types';
import type { Account, GlobalState, UserSwapToken } from '../../global/types';
import { SwapState, SwapType } from '../../global/types';

import { IS_CAPACITOR } from '../../config';
import {
  selectCurrentAccount,
  selectCurrentAccountState,
  selectSwapTokens,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatCurrencyExtended } from '../../util/formatNumber';
import resolveModalTransitionName from '../../util/resolveModalTransitionName';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';

import TokenSelector from '../common/TokenSelector';
import TransactionBanner from '../common/TransactionBanner';
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
  addressByChain?: Account['addressByChain'];
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
    payoutAddress,
    payinExtraId,
    isSettingsModalOpen,
    networkFee,
    shouldResetOnClose,
  },
  swapTokens,
  activityById,
  addressByChain,
}: StateProps) {
  const {
    startSwap,
    cancelSwap,
    setSwapScreen,
    submitSwap,
    showActivityInfo,
    submitSwapCex,
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
  const [renderedNetworkFee, setRenderedNetworkFee] = useState(networkFee);
  const [renderedActivity, setRenderedActivity] = useState<ApiActivity | undefined>();

  useEffect(() => {
    if (!isOpen || !activityId || !activityById?.[activityId]) {
      setRenderedActivity(undefined);
      return;
    }

    const activity = activityById[activityId];
    setRenderedActivity(activity);

    if (activity.kind === 'swap' && swapType === SwapType.CrosschainToWallet) {
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
    setRenderedNetworkFee(networkFee);
    setRenderedSwapType(swapType);

    if (swapType === SwapType.OnChain) {
      submitSwap({ password });
      return;
    }

    submitSwapCex({ password });
  });

  const handleBackClick = useLastCallback(() => {
    if (state === SwapState.Password) {
      if (swapType === SwapType.CrosschainFromWallet) {
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
    cancelSwap({ shouldReset: isPortrait || shouldResetOnClose });
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

    return (
      <TransactionBanner
        tokenIn={tokenIn}
        withChainIcon
        tokenOut={tokenOut}
        text={formatCurrencyExtended(amountIn, tokenIn.symbol ?? '', true)}
        secondText={formatCurrencyExtended(amountOut, tokenOut.symbol ?? '', true)}
        className={!IS_CAPACITOR ? styles.transactionBanner : undefined}
      />
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
            payoutAddress={payoutAddress}
            payinExtraId={payinExtraId}
            addressByChain={addressByChain}
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
      case SwapState.Complete: {
        const networkFeeValue = renderedActivity && 'networkFee' in renderedActivity
          ? renderedActivity.networkFee
          : renderedNetworkFee;

        return (
          <SwapComplete
            isActive={isActive}
            tokenIn={renderedTransactionTokenIn}
            tokenOut={renderedTransactionTokenOut}
            amountIn={renderedTransactionAmountIn}
            amountOut={renderedTransactionAmountOut}
            swapType={renderedSwapType}
            toAddress={toAddress}
            networkFee={networkFeeValue}
            onClose={handleModalCloseWithReset}
            onInfoClick={handleTransactionInfoClick}
            onStartSwap={handleStartSwap}
          />
        );
      }
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
  const account = selectCurrentAccount(global);
  const activityById = accountState?.activities?.byId;

  return {
    currentSwap: global.currentSwap,
    swapTokens: selectSwapTokens(global),
    activityById,
    addressByChain: account?.addressByChain,
  };
})(SwapModal));
