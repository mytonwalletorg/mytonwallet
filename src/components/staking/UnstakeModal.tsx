import type { TeactNode } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiBaseCurrency, ApiStakingState } from '../../api/types';
import type { GlobalState, Theme, UserToken } from '../../global/types';
import { ApiTransactionDraftError } from '../../api/types';
import { StakingState } from '../../global/types';

import {
  ANIMATED_STICKER_TINY_ICON_PX,
  IS_CAPACITOR,
  TONCOIN,
  VALIDATION_PERIOD_MS,
} from '../../config';
import { Big } from '../../lib/big.js';
import renderText from '../../global/helpers/renderText';
import {
  selectAccountStakingState,
  selectCurrentAccountTokens,
  selectIsCurrentAccountViewMode,
  selectIsMultichainAccount,
} from '../../global/selectors';
import { getDoesUsePinPad } from '../../util/biometrics';
import buildClassName from '../../util/buildClassName';
import { formatRelativeHumanDateTime } from '../../util/dateFormat';
import { fromDecimal, toBig, toDecimal } from '../../util/decimals';
import { getTonStakingFees } from '../../util/fee/getTonOperationFees';
import { formatCurrency, getShortCurrencySymbol } from '../../util/formatNumber';
import resolveSlideTransitionName from '../../util/resolveSlideTransitionName';
import { getIsLongUnstake, getUnstakeTime } from '../../util/staking';
import { getIsMobileTelegramApp } from '../../util/windowEnvironment';
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
import AmountFieldMaxButton from '../ui/AmountFieldMaxButton';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Fee from '../ui/Fee';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';
import RichNumberInput from '../ui/RichNumberInput';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Staking.module.scss';

type StateProps = GlobalState['currentStaking'] & {
  isViewMode: boolean;
  tokens?: UserToken[];
  baseCurrency?: ApiBaseCurrency;
  isNominators?: boolean;
  theme: Theme;
  isMultichainAccount: boolean;
  stakingState?: ApiStakingState;
  isSensitiveDataHidden?: true;
};

const IS_OPEN_STATES = new Set([
  StakingState.UnstakeInitial,
  StakingState.UnstakePassword,
  StakingState.UnstakeConnectHardware,
  StakingState.UnstakeConfirmHardware,
  StakingState.UnstakeComplete,
]);

const FULL_SIZE_NBS_STATES = new Set([
  StakingState.UnstakePassword,
  StakingState.UnstakeConnectHardware,
  StakingState.UnstakeConfirmHardware,
]);

const UPDATE_UNSTAKE_DATE_INTERVAL_MS = 30000; // 30 sec

function UnstakeModal({
  state,
  isViewMode,
  isLoading,
  error,
  tokens,
  baseCurrency,
  isNominators,
  isMultichainAccount,
  theme,
  amount,
  stakingState,
  isSensitiveDataHidden,
}: StateProps) {
  const {
    setStakingScreen,
    cancelStaking,
    clearStakingError,
    submitStakingInitial,
    submitStakingPassword,
    submitStakingHardware,
    fetchStakingHistory,
  } = getActions();

  const {
    type: stakingType,
    tokenSlug,
    balance: stakingBalance,
  } = stakingState ?? {};

  const lang = useLang();
  const isOpen = IS_OPEN_STATES.has(state);

  const { gas: networkFee, real: realFee } = getTonStakingFees(stakingState?.type).stake;

  const nativeToken = useMemo(() => tokens?.find(({ slug }) => slug === TONCOIN.slug), [tokens]);
  const isNativeEnough = nativeToken && nativeToken.amount >= networkFee;
  const instantAvailable = stakingState?.type === 'liquid' ? stakingState.instantAvailable : undefined;

  const token = useMemo(() => {
    return tokenSlug ? tokens?.find(({ slug }) => slug === tokenSlug) : undefined;
  }, [tokenSlug, tokens]);

  const logoPath = token
    && (ASSET_LOGO_PATHS[token.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS] || token.image);

  const [hasAmountError, setHasAmountError] = useState<boolean>(false);

  const [isInsufficientBalance, setIsInsufficientBalance] = useState(false);

  const [unstakeAmount, setUnstakeAmount] = useState(isNominators ? stakingBalance : undefined);
  const [successUnstakeAmount, setSuccessUnstakeAmount] = useState<bigint | undefined>(undefined);

  const unstakeTime = getUnstakeTime(stakingState);
  const isLongUnstake = stakingState ? getIsLongUnstake(stakingState, unstakeAmount) : undefined;

  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  const [unstakeDate, setUnstakeDate] = useState<number>(unstakeTime ?? Date.now() + VALIDATION_PERIOD_MS);
  const forceUpdate = useForceUpdate();
  const appTheme = useAppTheme(theme);

  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, isOpen);

  const amountInCurrency = token && token.price && unstakeAmount
    ? toBig(unstakeAmount, token.decimals)
      .mul(token.price)
      .round(token.decimals, Big.roundHalfUp)
      .toString()
    : undefined;
  const renderingAmountInCurrency = useCurrentOrPrev(amountInCurrency, true);
  const isUnstakeDisabled = !isNativeEnough || isInsufficientBalance || !unstakeAmount;

  const { shouldRender: shouldRenderCurrency, ref: currencyRef } = useShowTransition({
    isOpen: Boolean(amountInCurrency),
    withShouldRender: true,
  });

  useEffect(() => {
    if (isOpen) {
      fetchStakingHistory();
      setUnstakeAmount(isNominators ? stakingBalance : undefined);
      setHasAmountError(false);
      setIsInsufficientBalance(false);
    }
  }, [isOpen, fetchStakingHistory, isNominators, stakingBalance]);

  useSyncEffect(() => {
    if (unstakeTime) {
      setUnstakeDate(unstakeTime);
    }
  }, [unstakeTime]);

  useEffect(() => {
    if (error === ApiTransactionDraftError.InsufficientBalance) {
      setIsInsufficientBalance(true);
    }
  }, [error]);

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
    setIsInsufficientBalance(false);
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

  function renderTransactionBanner() {
    if (!token || !unstakeAmount) return undefined;

    return (
      <TransactionBanner
        tokenIn={token}
        withChainIcon={isMultichainAccount}
        color="green"
        text={formatCurrency(toDecimal(unstakeAmount, token.decimals), token.symbol)}
        className={!getDoesUsePinPad() ? styles.transactionBanner : undefined}
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

  const handleMaxAmountClick = useLastCallback(() => {
    if (!stakingBalance) {
      return;
    }

    validateAndSetAmount(stakingBalance);
  });

  const handleAmountChange = useLastCallback((stringValue?: string) => {
    const value = stringValue ? fromDecimal(stringValue, token?.decimals) : undefined;
    validateAndSetAmount(value);
  });

  function renderBalance() {
    return (
      <AmountFieldMaxButton
        maxAmount={stakingBalance}
        token={token}
        isLoading={stakingBalance === undefined || !token}
        isSensitiveDataHidden={isSensitiveDataHidden}
        isAllMode
        onAmountClick={handleMaxAmountClick}
      />
    );
  }

  function renderCurrencyValue() {
    return (
      <span ref={currencyRef} className={styles.amountInCurrency}>
        ≈&thinsp;{formatCurrency(renderingAmountInCurrency || '0', shortBaseSymbol)}
      </span>
    );
  }

  function renderBottomRight() {
    const activeKey = isInsufficientBalance ? 0
      : !isNativeEnough ? 1
        : instantAvailable ? 2
          : 3;

    let content: string | React.JSX.Element | TeactNode[] = token ? lang('$fee_value', {
      fee: <Fee terms={{ native: realFee }} precision="approximate" token={token} />,
    }) : '';

    if (token) {
      if (isInsufficientBalance) {
        content = <span className={styles.balanceError}>{lang('Insufficient balance')}</span>;
      } else if (!isNativeEnough) {
        content = (
          <span className={styles.balanceError}>
            {lang('$insufficient_fee', {
              fee: formatCurrency(toBig(networkFee), nativeToken?.symbol ?? ''),
            })}
          </span>
        );
      } else if (instantAvailable) {
        content = lang('$unstake_up_to_information', {
          value: formatCurrency(toDecimal(instantAvailable, token.decimals), token.symbol),
        });
      }
    }

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
    const unstakeDateText = stakingType === 'ethena'
      ? renderText(lang('$unstaking_when_receive_ethena'))
      : lang('$unstaking_when_receive', {
        time: (
          <strong>{formatRelativeHumanDateTime(lang.code, unstakeDate)}</strong>
        ),
      });

    return (
      <div className={buildClassName(styles.unstakeTime)}>
        <AnimatedIconWithPreview
          play={isOpen}
          size={ANIMATED_STICKER_TINY_ICON_PX}
          className={styles.unstakeTimeIcon}
          nonInteractive
          noLoop={false}
          tgsUrl={ANIMATED_STICKERS_PATHS[appTheme].iconClockGray}
          previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview.iconClockGray}
        />
        <div>{unstakeDateText}</div>
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

  function renderInitial() {
    return (
      <>
        <ModalHeader title={lang('$unstake_asset', { symbol: token?.symbol })} onClose={cancelStaking} />
        <div className={modalStyles.transitionContent}>
          {!isNominators && renderBalance()}
          <RichNumberInput
            key="unstaking_amount"
            id="unstaking_amount"
            hasError={hasAmountError}
            value={unstakeAmount === undefined ? undefined : toDecimal(unstakeAmount, token?.decimals)}
            labelText={lang('Amount to unstake')}
            onChange={handleAmountChange}
            className={styles.amountInput}
            decimals={token?.decimals}
            disabled={isNominators}
          >
            <div className={styles.ton}>
              <img src={logoPath} alt="" className={styles.tonIcon} />
              <span className={styles.tonName}>{token?.symbol}</span>
            </div>
          </RichNumberInput>

          <div className={styles.amountBottomWrapper}>
            <div className={styles.amountBottom}>
              {shouldRenderCurrency && renderCurrencyValue()}
              {renderBottomRight()}
            </div>
          </div>

          {renderUnstakeInfo()}

          {!isViewMode && (
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
          )}
        </div>
      </>
    );
  }

  function renderPassword(isActive: boolean) {
    return (
      <>
        {!getDoesUsePinPad() && (
          <ModalHeader title={lang('Confirm Unstaking')} onClose={cancelStaking} />
        )}
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
          skipAuthScreen
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
          title={getIsMobileTelegramApp()
            ? lang('Request is sent!')
            : stakingType === 'ethena'
              ? lang('Request for unstaking is sent!')
              : lang('Coins have been unstaked!')}
          onClose={cancelStaking}
        />

        <div className={modalStyles.transitionContent}>
          <TransferResult
            color={stakingType !== 'ethena' ? 'green' : undefined}
            playAnimation={isActive}
            amount={successUnstakeAmount}
            tokenSymbol={token?.symbol}
            decimals={token?.decimals}
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

  function renderContent(isActive: boolean, isFrom: boolean, currentKey: StakingState) {
    switch (currentKey) {
      case StakingState.UnstakeInitial:
        return renderInitial();

      case StakingState.UnstakePassword:
        return renderPassword(isActive);

      case StakingState.UnstakeConnectHardware:
        return (
          <LedgerConnect
            isActive={isActive}
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
        name={resolveSlideTransitionName()}
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
  const accountId = global.currentAccountId!;
  const tokens = selectCurrentAccountTokens(global);
  const baseCurrency = global.settings.baseCurrency;
  const isMultichainAccount = selectIsMultichainAccount(global, accountId);
  const stakingState = selectAccountStakingState(global, accountId);
  const isNominators = stakingState?.type === 'nominators';

  return {
    ...global.currentStaking,
    tokens,
    baseCurrency,
    isNominators,
    theme: global.settings.theme,
    isMultichainAccount,
    stakingState,
    isSensitiveDataHidden: global.settings.isSensitiveDataHidden,
    isViewMode: selectIsCurrentAccountViewMode(global),
  };
})(UnstakeModal));
