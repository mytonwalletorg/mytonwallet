import React, { memo, useMemo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState, HardwareConnectState, UserToken } from '../../global/types';
import { StakingState } from '../../global/types';

import { IS_CAPACITOR, TONCOIN_SLUG } from '../../config';
import { selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import resolveModalTransitionName from '../../util/resolveModalTransitionName';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';

import TransferResult from '../common/TransferResult';
import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import Transition from '../ui/Transition';
import StakingInitial from './StakingInitial';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Staking.module.scss';

type StateProps = GlobalState['staking'] & {
  tokens?: UserToken[];
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
};

const IS_OPEN_STATES = new Set([
  StakingState.StakeInitial,
  StakingState.StakePassword,
  StakingState.StakeConnectHardware,
  StakingState.StakeConfirmHardware,
  StakingState.StakeComplete,
]);

function StakeModal({
  state,
  isLoading,
  amount,
  error,
  tokens,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
}: StateProps) {
  const {
    startStaking,
    setStakingScreen,
    cancelStaking,
    clearStakingError,
    submitStakingPassword,
    submitStakingHardware,
    openStakingInfo,
  } = getActions();

  const lang = useLang();
  const isOpen = IS_OPEN_STATES.has(state);
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TONCOIN_SLUG), [tokens]);
  const [renderedStakingAmount, setRenderedStakingAmount] = useState(amount);

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);

  const handleBackClick = useLastCallback(() => {
    if (state === StakingState.StakePassword) {
      clearStakingError();
      setStakingScreen({ state: StakingState.StakeInitial });
    }
  });

  const handleLedgerConnect = useLastCallback(() => {
    setRenderedStakingAmount(amount);
    submitStakingHardware();
  });

  const handleTransferSubmit = useLastCallback((password: string) => {
    setRenderedStakingAmount(amount);
    submitStakingPassword({ password });
  });

  const handleViewStakingInfoClick = useLastCallback(() => {
    cancelStaking();
    openStakingInfo();
  });

  function renderStakingShortInfo() {
    if (!tonToken || !amount) return undefined;

    const logoPath = tonToken.image || ASSET_LOGO_PATHS[tonToken.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
    const stakingInfoClassName = buildClassName(
      styles.stakingShortInfo,
      !IS_CAPACITOR && styles.stakingShortInfoInsidePasswordForm,
    );

    return (
      <div className={stakingInfoClassName}>
        <img src={logoPath} alt={tonToken.symbol} className={styles.tokenIcon} />
        <span>{formatCurrency(toDecimal(amount), tonToken.symbol)}</span>
      </div>
    );
  }

  function renderPassword(isActive: boolean) {
    return (
      <>
        {!IS_CAPACITOR && <ModalHeader title={lang('Confirm Staking')} onClose={cancelStaking} />}
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          withCloseButton={IS_CAPACITOR}
          operationType="staking"
          placeholder="Confirm operation with your password"
          submitLabel={lang('Confirm')}
          cancelLabel={lang('Back')}
          onSubmit={handleTransferSubmit}
          onCancel={handleBackClick}
          onUpdate={clearStakingError}
        >
          {renderStakingShortInfo()}
        </PasswordForm>
      </>
    );
  }

  function renderComplete(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Coins have been staked!')} onClose={cancelStaking} />

        <div className={modalStyles.transitionContent}>
          <TransferResult
            color="purple"
            playAnimation={isActive}
            amount={renderedStakingAmount}
            noSign
            balance={tonToken?.amount ?? 0n}
            operationAmount={amount ? -amount : undefined}
            firstButtonText={lang('View')}
            secondButtonText={lang('Stake More')}
            onFirstButtonClick={handleViewStakingInfoClick}
            onSecondButtonClick={startStaking}
          />

          <div className={modalStyles.buttons}>
            <Button onClick={cancelStaking} isPrimary>{lang('Close')}</Button>
          </div>
        </div>
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case StakingState.StakeInitial:
        return (
          <>
            <ModalHeader title={lang('Stake TON')} onClose={cancelStaking} />
            <StakingInitial isActive={isActive} />
          </>
        );

      case StakingState.StakePassword:
        return renderPassword(isActive);

      case StakingState.StakeConnectHardware:
        return (
          <LedgerConnect
            isActive={isActive}
            state={hardwareState}
            isLedgerConnected={isLedgerConnected}
            isTonAppConnected={isTonAppConnected}
            onConnected={handleLedgerConnect}
            onClose={cancelStaking}
          />
        );

      case StakingState.StakeConfirmHardware:
        return (
          <LedgerConfirmOperation
            text={lang('Please confirm operation on your Ledger')}
            error={error}
            onClose={cancelStaking}
            onTryAgain={handleLedgerConnect}
          />
        );

      case StakingState.StakeComplete:
        return renderComplete(isActive);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      hasCloseButton
      noBackdropClose
      dialogClassName={styles.modalDialog}
      nativeBottomSheetKey="stake"
      forceFullNative={renderingKey === StakingState.StakePassword}
      onClose={cancelStaking}
      onCloseAnimationEnd={updateNextKey}
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

export default memo(withGlobal((global) => {
  const tokens = selectCurrentAccountTokens(global);

  const {
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  } = global.hardware;

  return {
    ...global.staking,
    tokens,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  };
})(StakeModal));
