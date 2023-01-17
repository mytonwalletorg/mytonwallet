import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { GlobalState, StakingState, UserToken } from '../../global/types';

import { TON_TOKEN_SLUG } from '../../config';
import buildClassName from '../../util/buildClassName';
import { selectCurrentAccountTokens } from '../../global/selectors';
import usePrevious from '../../hooks/usePrevious';
import useLang from '../../hooks/useLang';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';

import Modal from '../ui/Modal';
import Transition from '../ui/Transition';
import ModalHeader from '../ui/ModalHeader';
import StakingInitial from './StakingInitial';
import PasswordForm from '../ui/PasswordForm';
import Button from '../ui/Button';
import TransferResult from '../common/TransferResult';

import styles from './Staking.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface OwnProps {
  onViewStakingInfo: NoneToVoidFunction;
}

type StateProps = GlobalState['staking'] & {
  tokens?: UserToken[];
};

const IS_OPEN_STATES = new Set([
  StakingState.StakeInitial,
  StakingState.StakePassword,
  StakingState.StakeComplete,
]);

function StakeModal({
  state,
  isLoading,
  amount,
  error,
  tokens,
  onViewStakingInfo,
}: OwnProps & StateProps) {
  const {
    startStaking,
    setStakingScreen,
    cancelStaking,
    cleanStakingError,
    submitStakingPassword,
  } = getActions();

  const lang = useLang();
  const isOpen = IS_OPEN_STATES.has(state);
  const renderingState = useCurrentOrPrev(isOpen ? state : undefined, true) ?? -1;
  const [nextKey, setNextKey] = useState(renderingState + 1);
  const updateNextKey = useCallback(() => {
    setNextKey(renderingState + 1);
  }, [renderingState]);
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens]);
  const renderedTokenBalance = usePrevious(tonToken?.amount, true);
  const renderedStakingAmount = usePrevious(amount, true);

  useEffect(() => {
    if (isOpen) {
      updateNextKey();
    }
  }, [isOpen, updateNextKey]);

  const handleModalClose = useCallback(() => {
    setNextKey(StakingState.None);
  }, []);

  const handleBackClick = useCallback(() => {
    if (state === StakingState.StakePassword) {
      setStakingScreen({ state: StakingState.StakeInitial });
    }
    setNextKey(nextKey - 1);
  }, [nextKey, setStakingScreen, state]);

  const handleTransferSubmit = useCallback((password: string) => {
    submitStakingPassword({ password });
  }, [submitStakingPassword]);

  const handleViewStakingInfoClick = useCallback(() => {
    onViewStakingInfo();
    cancelStaking();
  }, [cancelStaking, onViewStakingInfo]);

  function renderPassword(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Confirm Staking')} onClose={cancelStaking} />
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          placeholder={lang('Confirm operation with your password')}
          onCleanError={cleanStakingError}
          onSubmit={handleTransferSubmit}
          submitLabel={lang('Confirm')}
          onCancel={handleBackClick}
          cancelLabel={lang('Back')}
        />
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
            balance={renderedTokenBalance}
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
            <StakingInitial />
          </>
        );

      case StakingState.StakePassword:
        return renderPassword(isActive);

      case StakingState.StakeComplete:
        return renderComplete(isActive);
    }
  }

  return (
    <Modal
      hasCloseButton
      isSlideUp
      isOpen={isOpen}
      onClose={cancelStaking}
      noBackdropClose
      onCloseAnimationEnd={handleModalClose}
      dialogClassName={styles.modalDialog}
    >
      <Transition
        name="push-slide"
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={renderingState}
        nextKey={nextKey}
        onStop={updateNextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(withGlobal<OwnProps>((global) => {
  const tokens = selectCurrentAccountTokens(global);

  return {
    ...global.staking,
    tokens,
  };
})(StakeModal));
