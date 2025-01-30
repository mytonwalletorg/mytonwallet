import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiJettonStakingState } from '../../api/types';
import type { HardwareConnectState, UserToken } from '../../global/types';
import { StakingState } from '../../global/types';

import {
  IS_CAPACITOR,
  SHORT_FRACTION_DIGITS,
  TONCOIN,
} from '../../config';
import renderText from '../../global/helpers/renderText';
import {
  selectAccount,
  selectAccountStakingState,
  selectCurrentAccountTokens,
  selectIsHardwareAccount,
  selectIsMultichainAccount,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { getTonStakingFees } from '../../util/fee/getTonOperationFees';
import { formatCurrency } from '../../util/formatNumber';
import resolveSlideTransitionName from '../../util/resolveSlideTransitionName';
import { shortenAddress } from '../../util/shortenAddress';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useModalTransitionKeys from '../../hooks/useModalTransitionKeys';

import TransactionBanner from '../common/TransactionBanner';
import LedgerConfirmOperation from '../ledger/LedgerConfirmOperation';
import LedgerConnect from '../ledger/LedgerConnect';
import Fee from '../ui/Fee';
import Modal from '../ui/Modal';
import PasswordForm from '../ui/PasswordForm';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './StakingClaimModal.module.scss';

interface StateProps {
  stakingState?: ApiJettonStakingState;
  isOpen?: boolean;
  tokens?: UserToken[];
  isLoading?: boolean;
  address?: string;
  error?: string;
  state?: StakingState;
  hardwareState?: HardwareConnectState;
  isLedgerConnected?: boolean;
  isTonAppConnected?: boolean;
  isHardwareAccount?: boolean;
  isMultichainAccount: boolean;
}

const IS_OPEN_STATES = new Set([
  StakingState.ClaimPassword,
  StakingState.ClaimConfirmHardware,
  StakingState.ClaimConnectHardware,
]);

function StakingClaimModal({
  stakingState,
  isOpen,
  tokens,
  isLoading,
  address,
  error,
  state = StakingState.ClaimPassword,
  hardwareState,
  isLedgerConnected,
  isTonAppConnected,
  isHardwareAccount,
  isMultichainAccount,
}: StateProps) {
  const {
    submitStakingClaim,
    submitStakingClaimHardware,
    cancelStakingClaim,
    clearStakingError,
  } = getActions();

  const {
    tokenSlug,
    unclaimedRewards = 0n,
  } = stakingState ?? {};

  const lang = useLang();

  const token = useMemo(() => tokens?.find(({ slug }) => slug === tokenSlug), [tokens, tokenSlug]);
  const nativeToken = useMemo(() => tokens?.find(({ slug }) => slug === TONCOIN.slug), [tokens]);
  const nativeBalance = nativeToken?.amount ?? 0n;

  const { gas: networkFee, real: realNetworkFee } = getTonStakingFees('jetton').claim!;
  const isNativeEnough = nativeBalance > networkFee;
  const { renderingKey, nextKey, updateNextKey } = useModalTransitionKeys(state, Boolean(isOpen));
  const withModalHeader = !isHardwareAccount && !IS_CAPACITOR;

  const handleSubmit = useLastCallback((password: string) => {
    if (!isNativeEnough) return;
    submitStakingClaim({ password });
  });

  const handleHardwareSubmit = useLastCallback(() => {
    if (!isNativeEnough) return;
    submitStakingClaimHardware();
  });

  function renderInfo() {
    return (
      <>
        <TransactionBanner
          tokenIn={token}
          withChainIcon={isMultichainAccount}
          text={formatCurrency(toDecimal(unclaimedRewards, token!.decimals), token!.symbol, SHORT_FRACTION_DIGITS)}
          className={!IS_CAPACITOR ? styles.transactionBanner : undefined}
          secondText={shortenAddress(address!)}
        />
        <div className={buildClassName(styles.operationInfoFee, !IS_CAPACITOR && styles.operationInfoFeeWithGap)}>
          {token && renderText(lang('$fee_value_bold', {
            fee: (
              <Fee
                terms={{ native: isNativeEnough ? realNetworkFee : networkFee }}
                precision={isNativeEnough ? 'approximate' : 'lessThan'}
                token={token}
              />
            ),
          }))}
        </div>
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case StakingState.ClaimConnectHardware:
        return (
          <LedgerConnect
            isActive={isActive}
            state={hardwareState}
            isLedgerConnected={isLedgerConnected}
            isTonAppConnected={isTonAppConnected}
            onConnected={handleHardwareSubmit}
            onClose={cancelStakingClaim}
          />
        );

      case StakingState.ClaimConfirmHardware:
        return (
          <LedgerConfirmOperation
            text={lang('Please confirm transaction on your Ledger')}
            error={error}
            onClose={cancelStakingClaim}
            onTryAgain={handleHardwareSubmit}
          />
        );

      case StakingState.ClaimPassword:
        return (
          <PasswordForm
            isActive={Boolean(isOpen)}
            isLoading={isLoading}
            withCloseButton
            operationType="claim"
            error={!isNativeEnough ? lang('Insufficient Balance for Fee') : error}
            submitLabel={lang('Confirm')}
            onSubmit={handleSubmit}
            onCancel={cancelStakingClaim}
            onUpdate={clearStakingError}
          >
            {renderInfo()}
          </PasswordForm>
        );
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title={withModalHeader ? lang('Confirm Rewards Claim') : undefined}
      hasCloseButton={withModalHeader}
      forceFullNative
      nativeBottomSheetKey="staking-claim"
      contentClassName={styles.passwordModalDialog}
      onClose={cancelStakingClaim}
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
  const accountId = global.currentAccountId;
  const { addressByChain } = selectAccount(global, accountId!) || {};
  const isHardwareAccount = selectIsHardwareAccount(global);

  const {
    state,
    isLoading,
    error,
  } = global?.currentStaking || {};

  const stakingState = accountId ? selectAccountStakingState(global, accountId) : undefined;
  const tokens = selectCurrentAccountTokens(global);

  const {
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
  } = global.hardware;

  return {
    stakingState: stakingState?.type === 'jetton' ? stakingState : undefined,
    isOpen: IS_OPEN_STATES.has(state),
    state,
    tokens,
    isLoading,
    error,
    address: addressByChain?.ton,
    hardwareState,
    isLedgerConnected,
    isTonAppConnected,
    isHardwareAccount,
    isMultichainAccount: selectIsMultichainAccount(global, accountId!),
  };
})(StakingClaimModal));
