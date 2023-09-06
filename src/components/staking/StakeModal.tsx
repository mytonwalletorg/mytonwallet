import React, { memo, useMemo } from '../../lib/teact/teact';

import { StakingState } from '../../global/types';
import type { GlobalState, UserToken } from '../../global/types';

import { TON_TOKEN_SLUG } from '../../config';
import { getActions, withGlobal } from '../../global';
import { selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';
import usePrevious from '../../hooks/usePrevious';

import TransferResult from '../common/TransferResult';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import Transition from '../ui/Transition';
import StakingInitial from './StakingInitial';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Staking.module.scss';

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
    clearStakingError,
    submitStakingPassword,
  } = getActions();

  const lang = useLang();
  const isOpen = IS_OPEN_STATES.has(state);
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens]);
  const renderedTokenBalance = usePrevious(tonToken?.amount, true);
  const renderedStakingAmount = usePrevious(amount, true);

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);

  const handleBackClick = useLastCallback(() => {
    if (state === StakingState.StakePassword) {
      setStakingScreen({ state: StakingState.StakeInitial });
    }
  });

  const handleTransferSubmit = useLastCallback((password: string) => {
    submitStakingPassword({ password });
  });

  const handleViewStakingInfoClick = useLastCallback(() => {
    onViewStakingInfo();
    cancelStaking();
  });

  function renderPassword(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Confirm Staking')} onClose={cancelStaking} />
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          placeholder={lang('Confirm operation with your password')}
          onUpdate={clearStakingError}
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
            <StakingInitial isActive={isActive} />
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
      isOpen={isOpen}
      onClose={cancelStaking}
      noBackdropClose
      dialogClassName={styles.modalDialog}
      onCloseAnimationEnd={updateNextKey}
    >
      <Transition
        name="slideLayers"
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

export default memo(withGlobal<OwnProps>((global) => {
  const tokens = selectCurrentAccountTokens(global);

  return {
    ...global.staking,
    tokens,
  };
})(StakeModal));
