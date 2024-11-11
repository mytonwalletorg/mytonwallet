import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiBaseCurrency, ApiStakingType } from '../../api/types';
import type {
  GlobalState, HardwareConnectState, Theme, UserToken,
} from '../../global/types';
import { StakingState } from '../../global/types';

import {
  ANIMATED_STICKER_TINY_ICON_PX,
  IS_CAPACITOR,
  MIN_BALANCE_FOR_UNSTAKE,
  STAKING_CYCLE_DURATION_MS,
  TONCOIN,
} from '../../config';
import { Big } from '../../lib/big.js';
import {
  selectAccountState,
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectIsHardwareAccount, selectIsMultichainAccount,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatRelativeHumanDateTime } from '../../util/dateFormat';
import { fromDecimal, toBig, toDecimal } from '../../util/decimals';
import {
  formatCurrency, formatCurrencySimple, getShortCurrencySymbol,
} from '../../util/formatNumber';
import resolveModalTransitionName from '../../util/resolveModalTransitionName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useAppTheme from '../../hooks/useAppTheme';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useForceUpdate from '../../hooks/useForceUpdate';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';
import useShowTransition from '../../hooks/useShowTransition';
import useSyncEffect from '../../hooks/useSyncEffect';

import TransactionBanner from '../common/TransactionBanner';
import TransferResult from '../common/TransferResult';
import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import RichNumberInput from '../ui/RichNumberInput';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Staking.module.scss';

type StateProps = GlobalState['staking'] & {
  tokens?: UserToken[];
  stakingType?: ApiStakingType;
  stakingBalance?: bigint;
  endOfStakingCycle?: number;
  stakingInfo: GlobalState['stakingInfo'];
  baseCurrency?: ApiBaseCurrency;
  shouldUseNominators?: boolean;
  isHardwareAccount?: boolean;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  theme: Theme;
  isMultichainAccount: boolean;
};

const IS_OPEN_STATES = new Set([
  StakingState.UnstakeInitial,
  StakingState.UnstakePassword,
  StakingState.UnstakeConnectHardware,
  StakingState.UnstakeConfirmHardware,
  StakingState.UnstakeComplete,
  StakingState.NotEnoughBalance,
]);

const FULL_SIZE_NBS_STATES = new Set([
  StakingState.UnstakePassword,
  StakingState.UnstakeConnectHardware,
  StakingState.UnstakeConfirmHardware,
]);

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
  baseCurrency,
  shouldUseNominators,
  isHardwareAccount,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
  isMultichainAccount,
  theme,
  amount,
}: StateProps) {
  const {
    setStakingScreen,
    cancelStaking,
    clearStakingError,
    submitStakingInitial,
    submitStakingPassword,
    submitStakingHardware,
    fetchStakingHistory,
    openReceiveModal,
  } = getActions();

  const lang = useLang();
  const isOpen = IS_OPEN_STATES.has(state);

  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TONCOIN.slug), [tokens]);

  const [hasAmountError, setHasAmountError] = useState<boolean>(false);

  const [isLongUnstake, setIsLongUnstake] = useState(false);

  const [isInsufficientBalance, setIsInsufficientBalance] = useState(false);

  const [unstakeAmount, setUnstakeAmount] = useState(shouldUseNominators ? stakingBalance : undefined);
  const [successUnstakeAmount, setSuccessUnstakeAmount] = useState<bigint | undefined>(undefined);

  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  useEffect(() => {
    const isInstantUnstake = Boolean(
      stakingType === 'liquid' && (stakingBalance ?? 0n) < (stakingInfo.liquid?.instantAvailable ?? 0n),
    );

    setIsLongUnstake(!isInstantUnstake);
  }, [stakingType, stakingBalance, stakingInfo]);

  const [unstakeDate, setUnstakeDate] = useState<number>(Date.now() + STAKING_CYCLE_DURATION_MS);
  const hasBalanceForUnstake = tonToken && tonToken.amount >= MIN_BALANCE_FOR_UNSTAKE;
  const forceUpdate = useForceUpdate();
  const appTheme = useAppTheme(theme);

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);

  const amountInCurrency = tonToken && tonToken.price && unstakeAmount
    ? toBig(unstakeAmount, tonToken.decimals).mul(tonToken.price).round(tonToken.decimals, Big.roundHalfUp).toString()
    : undefined;
  const renderingAmountInCurrency = useCurrentOrPrev(amountInCurrency, true);
  const isUnstakeDisabled = !hasBalanceForUnstake || isInsufficientBalance || !unstakeAmount;

  const { shouldRender: shouldRenderCurrency, transitionClassNames: currencyClassNames } = useShowTransition(
    Boolean(amountInCurrency),
  );

  useEffect(() => {
    if (isOpen) {
      fetchStakingHistory();
      setUnstakeAmount(shouldUseNominators ? stakingBalance : undefined);
      setHasAmountError(false);
      setIsInsufficientBalance(false);
    }
  }, [isOpen, fetchStakingHistory, shouldUseNominators, stakingBalance]);

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
    submitStakingInitial({ isUnstaking: true, amount: unstakeAmount });
  });

  const handleTransferSubmit = useLastCallback((password: string) => {
    setSuccessUnstakeAmount(amount);

    submitStakingPassword({ password, isUnstaking: true });
  });

  const handleLedgerConnect = useLastCallback(() => {
    setSuccessUnstakeAmount(amount);
    submitStakingHardware({ isUnstaking: true });
  });

  const handleGetTon = useLastCallback(() => {
    cancelStaking();
    openReceiveModal();
  });

  function renderTransactionBanner() {
    if (!tonToken || !unstakeAmount) return undefined;

    return (
      <TransactionBanner
        tokenIn={tonToken}
        withChainIcon={isMultichainAccount}
        color="green"
        text={formatCurrency(toDecimal(unstakeAmount), tonToken.symbol)}
        className={!IS_CAPACITOR ? styles.transactionBanner : undefined}
      />
    );
  }

  const validateAndSetAmount = useLastCallback(
    (newAmount: bigint | undefined, noReset = false) => {
      if (!noReset) {
        setHasAmountError(false);
        setIsInsufficientBalance(false);
      }

      if (newAmount === undefined) {
        setUnstakeAmount(undefined);
        return;
      }

      if (newAmount < 0) {
        setHasAmountError(true);
        return;
      }

      if (!stakingBalance || newAmount > stakingBalance) {
        setHasAmountError(true);
        setIsInsufficientBalance(true);
      }

      setUnstakeAmount(newAmount);
    },
  );

  const handleMaxAmountClick = useLastCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault();

      if (!stakingBalance) {
        return;
      }

      validateAndSetAmount(stakingBalance);
    },
  );

  const handleAmountChange = useLastCallback((stringValue?: string) => {
    const value = stringValue ? fromDecimal(stringValue, tonToken?.decimals) : undefined;
    validateAndSetAmount(value);
  });

  function renderBalance() {
    return (
      <div className={styles.balanceContainer}>
        <span className={styles.balance}>
          {lang('$all_balance', {
            balance: (
              <a href="#" onClick={handleMaxAmountClick} className={styles.balanceLink}>
                {
                  stakingBalance !== undefined
                    ? formatCurrencySimple(stakingBalance, tonToken?.symbol!, tonToken?.decimals!)
                    : lang('Loading...')
                }
              </a>
            ),
          })}
        </span>
      </div>
    );
  }

  function renderCurrencyValue() {
    return (
      <span className={buildClassName(styles.amountInCurrency, currencyClassNames)}>
        ≈&thinsp;{formatCurrency(renderingAmountInCurrency || '0', shortBaseSymbol)}
      </span>
    );
  }

  function renderBottomRight() {
    const instantAvailable = stakingInfo.liquid?.instantAvailable;

    const activeKey = isInsufficientBalance ? 0
      : !hasBalanceForUnstake ? 1
        : instantAvailable ? 2
          : 3;

    const insufficientBalanceText = <span className={styles.balanceError}>{lang('Insufficient balance')}</span>;
    const insufficientFeeText = (
      <span className={styles.balanceError}>
        {lang('$insufficient_fee', {
          fee: formatCurrency(toBig(MIN_BALANCE_FOR_UNSTAKE), TONCOIN.symbol),
        })}
      </span>
    );
    const instantAvailableText = instantAvailable
      ? (
        lang('$unstake_up_to_information', {
          value: formatCurrency(toDecimal(instantAvailable, tonToken?.decimals), TONCOIN.symbol),
        })
      ) : ' ';

    const content = isInsufficientBalance ? insufficientBalanceText
      : !hasBalanceForUnstake ? insufficientFeeText
        : instantAvailable ? instantAvailableText
          : ' ';

    return (
      <Transition
        className={styles.amountBottomRight}
        slideClassName={styles.amountBottomRight_slide}
        name="fade"
        activeKey={activeKey}
      >
        {content}
      </Transition>
    );
  }

  function renderUnstakeTimer() {
    return (
      <div className={buildClassName(styles.unstakeTime)}>
        <AnimatedIconWithPreview
          play={isOpen}
          size={ANIMATED_STICKER_TINY_ICON_PX}
          className={styles.unstakeTimeIcon}
          nonInteractive
          noLoop={false}
          tgsUrl={ANIMATED_STICKERS_PATHS[appTheme].iconClockGrayWhite}
          previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview.iconClockGrayWhite}
        />
        <div>
          {lang('$unstaking_when_receive', {
            time: (
              <strong>
                {formatRelativeHumanDateTime(lang.code, unstakeDate)}
              </strong>
            ),
          })}
        </div>
      </div>
    );
  }

  function renderUnstakeInfo() {
    const shouldShowInfo = !isInsufficientBalance && unstakeAmount;

    return (
      <Transition name="fade" activeKey={!shouldShowInfo ? 0 : !isLongUnstake ? 1 : 2}>
        {!shouldShowInfo ? undefined
          : (
            !isLongUnstake
              ? (
                <div className={styles.unstakeInfo}>
                  {lang('$unstake_information_instantly')}
                </div>
              )
              : renderUnstakeTimer()
          )}
      </Transition>
    );
  }

  function renderNotEnoughBalance(isActive: boolean) {
    return (
      <>
        <ModalHeader title={lang('Unstake TON')} onClose={cancelStaking} />
        <div className={buildClassName(modalStyles.transitionContent, styles.notEnoughBalanceContent)}>
          <AnimatedIconWithPreview
            play={isActive}
            tgsUrl={ANIMATED_STICKERS_PATHS.forge}
            previewUrl={ANIMATED_STICKERS_PATHS.forgePreview}
            noLoop={false}
            nonInteractive
            className={styles.sticker}
          />
          <div className={styles.notEnoughBalanceText}>
            {lang('$unstaking_not_enough_balance', {
              value: (
                <span className={styles.notEnoughBalanceTextBold}>
                  {formatCurrency(toBig(MIN_BALANCE_FOR_UNSTAKE), TONCOIN.symbol)}
                </span>
              ),
            })}
          </div>
          <div className={modalStyles.buttons}>
            <Button
              isPrimary
              className={modalStyles.button}
              onClick={handleGetTon}
            >
              {lang('Get TON')}
            </Button>
          </div>
        </div>
      </>
    );
  }

  function renderInitial() {
    return (
      <>
        <ModalHeader title={lang('Unstake TON')} onClose={cancelStaking} />
        <div className={modalStyles.transitionContent}>
          {!isHardwareAccount && renderBalance()}
          <RichNumberInput
            key="unstaking_amount"
            id="unstaking_amount"
            hasError={hasAmountError}
            value={unstakeAmount === undefined ? undefined : toDecimal(unstakeAmount, tonToken?.decimals)}
            labelText={lang('Amount to unstake')}
            onChange={handleAmountChange}
            className={styles.amountInput}
            decimals={tonToken?.decimals}
            disabled={shouldUseNominators}
          >
            <div className={styles.ton}>
              <img src={ASSET_LOGO_PATHS.ton} alt="" className={styles.tonIcon} />
              <span className={styles.tonName}>{tonToken?.symbol}</span>
            </div>
          </RichNumberInput>

          <div className={styles.amountBottomWrapper}>
            <div className={styles.amountBottom}>
              {shouldRenderCurrency && renderCurrencyValue()}
              {renderBottomRight()}
            </div>
          </div>

          {renderUnstakeInfo()}

          <div className={modalStyles.buttons}>
            <Button
              isPrimary
              isLoading={isLoading}
              isDisabled={isUnstakeDisabled}
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
          withCloseButton={IS_CAPACITOR}
          operationType="unstaking"
          error={error}
          placeholder="Confirm operation with your password"
          submitLabel={lang('Confirm')}
          cancelLabel={lang('Back')}
          onSubmit={handleTransferSubmit}
          onCancel={handleBackClick}
          onUpdate={clearStakingError}
        >
          {renderTransactionBanner()}
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
            amount={successUnstakeAmount}
            noSign
          />

          {isLongUnstake && renderUnstakeTimer()}

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
      case StakingState.NotEnoughBalance:
        return renderNotEnoughBalance(isActive);

      case StakingState.UnstakeInitial:
        return renderInitial();

      case StakingState.UnstakePassword:
        return renderPassword(isActive);

      case StakingState.UnstakeConnectHardware:
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

      case StakingState.UnstakeConfirmHardware:
        return (
          <LedgerConfirmOperation
            text={lang('Please confirm operation on your Ledger')}
            error={error}
            onClose={cancelStaking}
            onTryAgain={handleLedgerConnect}
          />
        );

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
      forceFullNative={FULL_SIZE_NBS_STATES.has(renderingKey)}
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
  const baseCurrency = global.settings.baseCurrency;
  const accountState = selectAccountState(global, global.currentAccountId!);
  const shouldUseNominators = accountState?.staking?.type === 'nominators';
  const isHardwareAccount = selectIsHardwareAccount(global);
  const isMultichainAccount = selectIsMultichainAccount(global, global.currentAccountId!);

  const {
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  } = global.hardware;

  return {
    ...global.staking,
    tokens,
    stakingType: currentAccountState?.staking?.type,
    stakingBalance: currentAccountState?.staking?.balance,
    endOfStakingCycle: currentAccountState?.staking?.end,
    stakingInfo: global.stakingInfo,
    baseCurrency,
    shouldUseNominators,
    isHardwareAccount,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
    theme: global.settings.theme,
    isMultichainAccount,
  };
})(UnstakeModal));
