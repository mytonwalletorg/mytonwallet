import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';

import { StakingState } from '../../global/types';
import type { GlobalState, UserToken } from '../../global/types';

import {
  CARD_SECONDARY_VALUE_SYMBOL, MIN_BALANCE_FOR_UNSTAKE, STAKING_CYCLE_DURATION_MS, TON_TOKEN_SLUG,
} from '../../config';
import { getActions, withGlobal } from '../../global';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatRelativeHumanDateTime } from '../../util/dateFormat';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useForceUpdate from '../../hooks/useForceUpdate';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';
import usePrevious from '../../hooks/usePrevious';
import useSyncEffect from '../../hooks/useSyncEffect';

import TransferResult from '../common/TransferResult';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import RichNumberField from '../ui/RichNumberField';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Staking.module.scss';

type StateProps = GlobalState['staking'] & {
  tokens?: UserToken[];
  stakingBalance?: number;
  endOfStakingCycle?: number;
};

const IS_OPEN_STATES = new Set([
  StakingState.UnstakeInitial,
  StakingState.UnstakePassword,
  StakingState.UnstakeComplete,
]);

const ICON_SIZE = 80;
const UPDATE_UNSTAKE_DATE_INTERVAL_MS = 30000; // 30 sec

function UnstakeModal({
  state,
  isLoading,
  error,
  tokens,
  stakingBalance,
  endOfStakingCycle,
}: StateProps) {
  const {
    setStakingScreen,
    cancelStaking,
    clearStakingError,
    submitStakingInitial,
    submitStakingPassword,
    fetchBackendStakingState,
  } = getActions();

  const lang = useLang();
  const isOpen = IS_OPEN_STATES.has(state);
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens]);
  const renderedStakingBalance = usePrevious(stakingBalance, true);
  const renderedTokenBalance = usePrevious(tonToken?.amount, true);
  const [unstakeDate, setUnstakeDate] = useState<number>(Date.now() + STAKING_CYCLE_DURATION_MS);
  const hasBalanceForUnstake = tonToken && tonToken.amount >= MIN_BALANCE_FOR_UNSTAKE;
  const forceUpdate = useForceUpdate();

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);

  useEffect(() => {
    if (isOpen) {
      fetchBackendStakingState();
    }
  }, [isOpen, fetchBackendStakingState]);

  useSyncEffect(() => {
    if (endOfStakingCycle) {
      setUnstakeDate(endOfStakingCycle);
    }
  }, [endOfStakingCycle]);

  const refreshUnstakeDate = useCallback(() => {
    if (unstakeDate < Date.now()) {
      fetchBackendStakingState();
    }
    forceUpdate();
  }, [fetchBackendStakingState, forceUpdate, unstakeDate]);

  useInterval(refreshUnstakeDate, UPDATE_UNSTAKE_DATE_INTERVAL_MS);

  const handleBackClick = useCallback(() => {
    if (state === StakingState.UnstakePassword) {
      setStakingScreen({ state: StakingState.UnstakeInitial });
    }
  }, [setStakingScreen, state]);

  const handleStartUnstakeClick = useCallback(() => {
    submitStakingInitial({ isUnstaking: true });
  }, [submitStakingInitial]);

  const handleTransferSubmit = useCallback((password: string) => {
    submitStakingPassword({ password, isUnstaking: true });
  }, [submitStakingPassword]);

  function renderInitial(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Unstake TON')} onClose={cancelStaking} />
        <div className={modalStyles.transitionContent}>
          <div className={styles.welcome}>
            <AnimatedIconWithPreview
              size={ICON_SIZE}
              play={isActive}
              noLoop={false}
              nonInteractive
              className={styles.sticker}
              tgsUrl={ANIMATED_STICKERS_PATHS.snitch}
              previewUrl={ANIMATED_STICKERS_PATHS.snitchPreview}
            />
            <div className={styles.unstakeInformation}>
              {lang('$unstake_information_with_time', {
                time: <strong>{formatRelativeHumanDateTime(lang.code, unstakeDate)}</strong>,
              })}
            </div>
          </div>

          <RichNumberField
            key="unstaking_amount"
            id="unstaking_amount"
            error={error ? lang(error) : undefined}
            value={stakingBalance}
            labelText={lang('Amount to unstake')}
            decimals={tonToken?.decimals}
          >
            <div className={styles.ton}>
              <img src={ASSET_LOGO_PATHS.ton} alt="" className={styles.tonIcon} />
              <span className={styles.tonName}>{tonToken?.symbol}</span>
            </div>
          </RichNumberField>
          {!hasBalanceForUnstake && (
            <p className={styles.insufficientBalance}>
              {lang('$unstake_insufficient_balance', {
                balance: `${MIN_BALANCE_FOR_UNSTAKE} ${CARD_SECONDARY_VALUE_SYMBOL}`,
              })}
            </p>
          )}

          <div className={modalStyles.buttons}>
            <Button onClick={cancelStaking}>{lang('Cancel')}</Button>
            <Button
              isPrimary
              onClick={handleStartUnstakeClick}
              isLoading={isLoading}
              isDisabled={!hasBalanceForUnstake}
            >
              {lang('Unstake')}
            </Button>
          </div>
        </div>
      </>
    );
  }

  function renderPassword(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Confirm Unstaking')} onClose={cancelStaking} />
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
        <ModalHeader title={lang('Request for unstaking is sent!')} onClose={cancelStaking} />

        <div className={modalStyles.transitionContent}>
          <TransferResult
            color="green"
            playAnimation={isActive}
            amount={renderedStakingBalance}
            noSign
            balance={renderedTokenBalance}
            operationAmount={stakingBalance}
          />

          <div className={styles.unstakeTime}>
            <i className={buildClassName(styles.unstakeTimeIcon, 'icon-clock')} aria-hidden />
            {lang('$unstaking_when_receive', {
              time: <strong>{formatRelativeHumanDateTime(lang.code, unstakeDate)}</strong>,
            })}
          </div>

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
      case StakingState.UnstakeInitial:
        return renderInitial(isActive);

      case StakingState.UnstakePassword:
        return renderPassword(isActive);

      case StakingState.UnstakeComplete:
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
      dialogClassName={styles.modalDialog}
      onCloseAnimationEnd={updateNextKey}
    >
      <Transition
        name="pushSlide"
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
  const tokens = selectCurrentAccountTokens(global);
  const currentAccountState = selectCurrentAccountState(global);

  return {
    ...global.staking,
    tokens,
    stakingBalance: currentAccountState?.stakingBalance,
    endOfStakingCycle: currentAccountState?.poolState?.endOfCycle,
  };
})(UnstakeModal));
