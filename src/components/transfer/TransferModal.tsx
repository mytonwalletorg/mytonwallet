import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState, HardwareConnectState, UserToken } from '../../global/types';
import { TransferState } from '../../global/types';

import { BURN_ADDRESS, IS_CAPACITOR, NFT_BATCH_SIZE } from '../../config';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import resolveModalTransitionName from '../../util/resolveModalTransitionName';
import { shortenAddress } from '../../util/shortenAddress';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';
import usePrevious from '../../hooks/usePrevious';
import useWindowSize from '../../hooks/useWindowSize';

import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';
import TransferComplete from './TransferComplete';
import TransferConfirm from './TransferConfirm';
import TransferInitial from './TransferInitial';
import TransferMultiNftProcess from './TransferMultiNftProcess';
import TransferPassword from './TransferPassword';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Transfer.module.scss';

interface StateProps {
  currentTransfer: GlobalState['currentTransfer'];
  tokens?: UserToken[];
  savedAddresses?: Record<string, string>;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  isMediaViewerOpen?: boolean;
}

const SCREEN_HEIGHT_FOR_FORCE_FULLSIZE_NBS = 762; // Computed empirically

function TransferModal({
  currentTransfer: {
    state,
    amount,
    toAddress,
    fee,
    comment,
    error,
    isLoading,
    txId,
    tokenSlug,
    nfts,
    sentNftsCount,
  }, tokens, savedAddresses, hardwareState, isLedgerConnected, isTonAppConnected, isMediaViewerOpen,
}: StateProps) {
  const {
    submitTransferConfirm,
    submitTransferPassword,
    submitTransferHardware,
    setTransferScreen,
    cancelTransfer,
    showActivityInfo,
  } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  const isOpen = state !== TransferState.None;

  const { screenHeight } = useWindowSize();
  const selectedToken = useMemo(() => tokens?.find((token) => token.slug === tokenSlug), [tokenSlug, tokens]);
  const decimals = selectedToken?.decimals;
  const [renderedTokenBalance, setRenderedTokenBalance] = useState(selectedToken?.amount);
  const renderedTransactionAmount = usePrevious(amount, true);
  const symbol = selectedToken?.symbol || '';
  const isNftTransfer = Boolean(nfts?.length);
  const isBurning = toAddress === BURN_ADDRESS;

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);

  useEffect(() => (
    state === TransferState.Confirm
      ? captureKeyboardListeners({
        onEnter: () => {
          submitTransferConfirm();
        },
      })
      : undefined
  ), [state, submitTransferConfirm]);

  const handleTransferSubmit = useLastCallback((password: string) => {
    setRenderedTokenBalance(selectedToken?.amount);

    submitTransferPassword({ password });
  });

  const handleBackClick = useLastCallback(() => {
    if (state === TransferState.Confirm) {
      setTransferScreen({ state: TransferState.Initial });
    }
    if (state === TransferState.Password) {
      setTransferScreen({ state: TransferState.Confirm });
    }
  });

  const handleTransactionInfoClick = useLastCallback(() => {
    cancelTransfer({ shouldReset: true });
    showActivityInfo({ id: txId! });
  });

  const handleModalClose = useLastCallback(() => {
    cancelTransfer({ shouldReset: isPortrait });
    updateNextKey();
  });

  const handleModalCloseWithReset = useLastCallback(() => {
    cancelTransfer({ shouldReset: true });
  });

  const handleLedgerConnect = useLastCallback(() => {
    submitTransferHardware();
  });

  function renderTransferShortInfo() {
    const transferInfoClassName = buildClassName(
      styles.transferShortInfo,
      !IS_CAPACITOR && styles.transferShortInfoInsidePasswordForm,
    );
    const logoPath = isNftTransfer
      ? nfts![0]?.thumbnail
      : selectedToken?.image || ASSET_LOGO_PATHS[symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];

    return (
      <div className={transferInfoClassName}>
        {logoPath && <img src={logoPath} alt={symbol} className={styles.tokenIcon} />}
        <span className={styles.transferShortInfoText}>
          {lang('%amount% to %address%', {
            amount: (
              <span className={styles.bold}>
                {isNftTransfer
                  ? (nfts!.length > 1 ? lang('%amount% NFTs', { amount: nfts!.length }) : nfts![0]?.name || 'NFT')
                  : formatCurrency(toDecimal(amount!, decimals), symbol)}
              </span>
            ),
            address: <span className={styles.bold}>{shortenAddress(toAddress!)}</span>,
          })}
        </span>
      </div>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case TransferState.Initial:
        return (
          <>
            <ModalHeader title={lang(isNftTransfer ? 'Send NFT' : 'Send')} onClose={handleModalCloseWithReset} />
            <TransferInitial />
          </>
        );
      case TransferState.Confirm:
        return (
          <TransferConfirm
            isActive={isActive}
            symbol={symbol}
            decimals={selectedToken?.decimals}
            savedAddresses={savedAddresses}
            onBack={isPortrait ? handleBackClick : handleModalClose}
            onClose={handleModalCloseWithReset}
          />
        );
      case TransferState.Password:
        return (
          <TransferPassword
            isActive={isActive}
            isLoading={isLoading}
            isBurning={isBurning}
            error={error}
            onSubmit={handleTransferSubmit}
            onCancel={handleModalCloseWithReset}
          >
            {renderTransferShortInfo()}
          </TransferPassword>
        );
      case TransferState.ConnectHardware:
        return (
          <LedgerConnect
            isActive={isActive}
            state={hardwareState}
            isLedgerConnected={isLedgerConnected}
            isTonAppConnected={isTonAppConnected}
            onConnected={handleLedgerConnect}
            onClose={handleModalCloseWithReset}
          />
        );
      case TransferState.ConfirmHardware:
        return (
          <LedgerConfirmOperation
            text={lang('Please confirm transaction on your Ledger')}
            error={error}
            onClose={handleModalCloseWithReset}
            onTryAgain={submitTransferHardware}
          />
        );
      case TransferState.Complete:
        return (nfts?.length || 0) <= NFT_BATCH_SIZE ? (
          <TransferComplete
            isActive={isActive}
            nfts={nfts}
            amount={renderedTransactionAmount}
            symbol={symbol}
            balance={renderedTokenBalance}
            fee={fee}
            operationAmount={amount}
            txId={txId}
            tokenSlug={tokenSlug}
            toAddress={toAddress}
            comment={comment}
            onInfoClick={handleTransactionInfoClick}
            onClose={handleModalCloseWithReset}
            decimals={decimals}
          />
        ) : (
          <TransferMultiNftProcess
            nfts={nfts!}
            sentNftsCount={sentNftsCount}
            toAddress={toAddress}
            onClose={handleModalCloseWithReset}
          />
        );
    }
  }

  return (
    <Modal
      isOpen={isOpen && !isMediaViewerOpen}
      noBackdropClose
      dialogClassName={styles.modalDialog}
      nativeBottomSheetKey="transfer"
      forceFullNative={screenHeight <= SCREEN_HEIGHT_FOR_FORCE_FULLSIZE_NBS || renderingKey === TransferState.Password}
      onClose={handleModalCloseWithReset}
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

  const {
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  } = global.hardware;

  return {
    currentTransfer: global.currentTransfer,
    tokens: selectCurrentAccountTokens(global),
    savedAddresses: accountState?.savedAddresses,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
    isMediaViewerOpen: Boolean(global.mediaViewer.mediaId),
  };
})(TransferModal));
