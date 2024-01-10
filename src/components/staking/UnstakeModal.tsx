import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiStakingType } from '../../api/types';
import type { GlobalState, UserToken } from '../../global/types';
import { StakingState } from '../../global/types';

import {
  IS_CAPACITOR,
  MIN_BALANCE_FOR_UNSTAKE, STAKING_CYCLE_DURATION_MS, TON_SYMBOL, TON_TOKEN_SLUG,
} from '../../config';
import { Big } from '../../lib/big.js';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatRelativeHumanDateTime } from '../../util/dateFormat';
import { formatCurrency } from '../../util/formatNumber';
import resolveModalTransitionName from '../../util/resolveModalTransitionName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useForceUpdate from '../../hooks/useForceUpdate';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';
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
  stakingType?: ApiStakingType;
  stakingBalance?: number;
  endOfStakingCycle?: number;
  stakingInfo: GlobalState['stakingInfo'];
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
  stakingType,
  stakingBalance,
  endOfStakingCycle,
  stakingInfo,
}: StateProps) {
  const {
    setStakingScreen,
    cancelStaking,
    clearStakingError,
    submitStakingInitial,
    submitStakingPassword,
    fetchStakingHistory,
  } = getActions();

  const lang = useLang();
  const isOpen = IS_OPEN_STATES.has(state);
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens]);

  const [renderedStakingBalance, setRenderedStakingBalance] = useState(stakingBalance);
  const [renderedBalance, setRenderedBalance] = useState(tonToken?.amount);

  const [isLongUnstake, setIsLongUnstake] = useState(false);

  useEffect(() => {
    const instantAvailable = Big(stakingInfo.liquid?.instantAvailable ?? 0);
    const isInstantUnstake = stakingType === 'liquid'
      ? Big(stakingBalance ?? 0).lte(instantAvailable)
      : false;

    setIsLongUnstake(!isInstantUnstake);
  }, [stakingType, stakingBalance, stakingInfo]);

  const [unstakeDate, setUnstakeDate] = useState<number>(Date.now() + STAKING_CYCLE_DURATION_MS);
  const hasBalanceForUnstake = tonToken && tonToken.amount >= MIN_BALANCE_FOR_UNSTAKE;
  const forceUpdate = useForceUpdate();

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);

  useEffect(() => {
    if (isOpen) {
      fetchStakingHistory();
    }
  }, [isOpen, fetchStakingHistory]);

  useSyncEffect(() => {
    if (endOfStakingCycle) {
      setUnstakeDate(endOfStakingCycle);
    }
  }, [endOfStakingCycle]);

  const refreshUnstakeDate = useLastCallback(() => {
    if (unstakeDate < Date.now()) {
      fetchStakingHistory();
    }
    forceUpdate();
  });

  useInterval(refreshUnstakeDate, UPDATE_UNSTAKE_DATE_INTERVAL_MS);

  const handleBackClick = useLastCallback(() => {
    if (state === StakingState.UnstakePassword) {
      setStakingScreen({ state: StakingState.UnstakeInitial });
    }
  });

  const handleStartUnstakeClick = useLastCallback(() => {
    submitStakingInitial({ isUnstaking: true });
  });

  const handleTransferSubmit = useLastCallback((password: string) => {
    setRenderedStakingBalance(stakingBalance);
    setRenderedBalance(tonToken?.amount);

    submitStakingPassword({ password, isUnstaking: true });
  });

  function renderUnstakingShortInfo() {
    if (!tonToken || !stakingBalance) return undefined;

    const logoPath = tonToken.image || ASSET_LOGO_PATHS[tonToken.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
    const className = buildClassName(
      styles.stakingShortInfo,
      styles.unstake,
      !IS_CAPACITOR && styles.stakingShortInfoInsidePasswordForm,
    );

    return (
      <div className={className}>
        <img src={logoPath} alt={tonToken.symbol} className={styles.tokenIcon} />
        <span>{formatCurrency(stakingBalance, tonToken.symbol)}</span>
      </div>
    );
  }

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
              {isLongUnstake
                ? lang('$unstake_information_with_time', {
                  time: <strong>{formatRelativeHumanDateTime(lang.code, unstakeDate)}</strong>,
                })
                : lang('$unstake_information_instantly')}
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
                balance: `${MIN_BALANCE_FOR_UNSTAKE} ${TON_SYMBOL}`,
              })}
            </p>
          )}

          <div className={modalStyles.buttons}>
            <Button className={modalStyles.button} onClick={cancelStaking}>{lang('Cancel')}</Button>
            <Button
              isPrimary
              isLoading={isLoading}
              isDisabled={!hasBalanceForUnstake}
              className={modalStyles.button}
              onClick={handleStartUnstakeClick}
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
        {!IS_CAPACITOR && <ModalHeader title={lang('Confirm Unstaking')} onClose={cancelStaking} />}
        <PasswordForm
          isActive={isActive}
          isLoading={isLoading}
          error={error}
          placeholder={lang('Confirm operation with your password')}
          withCloseButton={IS_CAPACITOR}
          onUpdate={clearStakingError}
          onSubmit={handleTransferSubmit}
          submitLabel={lang('Confirm')}
          onCancel={handleBackClick}
          cancelLabel={lang('Back')}
        >
          {renderUnstakingShortInfo()}
        </PasswordForm>
      </>
    );
  }

  function renderComplete(isActive: boolean) {
    return (
      <>
        <ModalHeader
          title={lang('Request for unstaking is sent!')}
          onClose={cancelStaking}
        />

        <div className={modalStyles.transitionContent}>
          <TransferResult
            color="green"
            playAnimation={isActive}
            amount={renderedStakingBalance}
            noSign
            balance={renderedBalance}
            operationAmount={renderedStakingBalance}
          />

          {isLongUnstake && (
            <div className={styles.unstakeTime}>
              <i className={buildClassName(styles.unstakeTimeIcon, 'icon-clock')} aria-hidden />
              {lang('$unstaking_when_receive', {
                time: <strong>{formatRelativeHumanDateTime(lang.code, unstakeDate)}</strong>,
              })}
            </div>
          )}

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
      isOpen={isOpen}
      hasCloseButton
      noBackdropClose
      dialogClassName={styles.modalDialog}
      nativeBottomSheetKey="unstake"
      forceFullNative={renderingKey === StakingState.UnstakePassword}
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

export default memo(withGlobal((global): StateProps => {
  const tokens = selectCurrentAccountTokens(global);
  const currentAccountState = selectCurrentAccountState(global);

  return {
    ...global.staking,
    tokens,
    stakingType: currentAccountState?.staking?.type,
    stakingBalance: currentAccountState?.staking?.balance,
    endOfStakingCycle: currentAccountState?.staking?.end,
    stakingInfo: global.stakingInfo,
  };
})(UnstakeModal));
