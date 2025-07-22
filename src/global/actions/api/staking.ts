import type { ApiEthenaStakingState, ApiJettonStakingState, ApiTransactionError } from '../../../api/types';
import { ApiCommonError } from '../../../api/types';
import { StakingState } from '../../types';

import { getDoesUsePinPad } from '../../../util/biometrics';
import { getTonStakingFees } from '../../../util/fee/getTonOperationFees';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/haptics';
import { logDebugError } from '../../../util/logs';
import { callActionInMain, callActionInNative } from '../../../util/multitab';
import { pause } from '../../../util/schedulers';
import { getIsActiveStakingState, getIsLongUnstake } from '../../../util/staking';
import { IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { ApiHardwareBlindSigningNotEnabled, ApiUserRejectsError } from '../../../api/errors';
import { closeAllOverlays } from '../../helpers/misc';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearCurrentStaking,
  clearIsPinAccepted,
  resetHardware,
  setIsPinAccepted,
  updateAccountStaking,
  updateAccountState,
  updateCurrentStaking,
} from '../../reducers';
import { selectAccountStakingState, selectAccountStakingStatesBySlug, selectIsHardwareAccount } from '../../selectors';
import { switchAccount } from './auth';

const MODAL_CLOSING_DELAY = 50;

addActionHandler('startStaking', (global, actions, payload) => {
  const isOpen = global.currentStaking.state !== StakingState.None;
  const { tokenSlug } = payload || {};

  if (tokenSlug) {
    const stakingState = selectAccountStakingStatesBySlug(global, global.currentAccountId!)[tokenSlug];
    if (stakingState) {
      global = getGlobal();
      global = updateAccountStaking(global, global.currentAccountId!, { stakingId: stakingState.id });
      setGlobal(global);

      global = getGlobal();
    }
  }

  if (IS_DELEGATED_BOTTOM_SHEET && !isOpen) {
    callActionInMain('startStaking', payload);
    return;
  }

  const state = StakingState.StakeInitial;

  setGlobal(updateCurrentStaking(global, {
    state,
    error: undefined,
  }));
});

addActionHandler('startUnstaking', (global, actions, payload) => {
  const isOpen = global.currentStaking.state !== StakingState.None;
  const { stakingId } = payload || {};

  if (stakingId) {
    global = getGlobal();
    global = updateAccountStaking(global, global.currentAccountId!, { stakingId });
    setGlobal(global);

    global = getGlobal();
  }

  if (IS_DELEGATED_BOTTOM_SHEET && !isOpen) {
    callActionInMain('startUnstaking', payload);
    return;
  }

  const state = StakingState.UnstakeInitial;

  setGlobal(updateCurrentStaking(global, {
    state,
    error: undefined,
  }));
});

addActionHandler('fetchStakingFee', async (global, actions, payload) => {
  const { amount } = payload;
  const { currentAccountId } = global;

  if (!currentAccountId) {
    return;
  }

  const state = selectAccountStakingState(global, currentAccountId);

  const result = await callApi(
    'checkStakeDraft',
    currentAccountId,
    amount,
    state,
  );
  if (!result || 'error' in result) {
    return;
  }

  global = getGlobal();
  global = updateCurrentStaking(global, {
    fee: result.fee,
  });
  setGlobal(global);
});

addActionHandler('submitStakingInitial', async (global, actions, payload) => {
  const { isUnstaking, amount } = payload ?? {};
  const { currentAccountId } = global;

  if (!currentAccountId) {
    return;
  }

  setGlobal(updateCurrentStaking(global, { isLoading: true, error: undefined }));

  const state = selectAccountStakingState(global, currentAccountId);

  if (isUnstaking) {
    const result = await callApi('checkUnstakeDraft', currentAccountId, amount!, state);
    global = getGlobal();
    global = updateCurrentStaking(global, { isLoading: false });

    if (result) {
      if ('error' in result) {
        global = updateCurrentStaking(global, { error: result.error });
      } else {
        if (selectIsHardwareAccount(global)) {
          global = resetHardware(global);
          global = updateCurrentStaking(global, { state: StakingState.UnstakeConnectHardware });
        } else {
          global = updateCurrentStaking(global, { state: StakingState.UnstakePassword });
        }

        global = updateCurrentStaking(global, {
          fee: result.fee,
          amount,
          error: undefined,
          tokenAmount: result.tokenAmount,
        });
      }
    }
  } else {
    const result = await callApi(
      'checkStakeDraft',
      currentAccountId,
      amount!,
      state,
    );
    global = getGlobal();
    global = updateCurrentStaking(global, { isLoading: false });

    if (result) {
      if ('error' in result) {
        global = updateCurrentStaking(global, { error: result.error });
      } else {
        if (selectIsHardwareAccount(global)) {
          global = resetHardware(global);
          global = updateCurrentStaking(global, { state: StakingState.StakeConnectHardware });
        } else {
          global = updateCurrentStaking(global, { state: StakingState.StakePassword });
        }

        global = updateCurrentStaking(global, {
          fee: result.fee,
          amount,
          error: undefined,
        });
      }
    }
  }

  setGlobal(global);
});

addActionHandler('submitStakingPassword', async (global, actions, payload) => {
  const { password, isUnstaking } = payload;
  const { amount, tokenAmount } = global.currentStaking;
  const { currentAccountId } = global;

  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateCurrentStaking(getGlobal(), { error: 'Wrong password, please try again.' }));

    return;
  }

  global = getGlobal();

  const state = selectAccountStakingState(global, currentAccountId!);

  if (getDoesUsePinPad()) {
    global = setIsPinAccepted(global);
  }

  global = updateCurrentStaking(global, {
    isLoading: true,
    error: undefined,
  });
  setGlobal(global);

  await vibrateOnSuccess(true);
  global = getGlobal();

  if (isUnstaking) {
    const unstakeAmount = state.type === 'nominators' ? state.balance : tokenAmount!;
    const result = await callApi(
      'submitUnstake',
      global.currentAccountId!,
      password,
      unstakeAmount,
      state,
      getTonStakingFees(state.type).unstake.real,
    );

    const isLongUnstakeRequested = getIsLongUnstake(state, unstakeAmount);

    global = getGlobal();
    global = updateAccountState(global, currentAccountId!, { isLongUnstakeRequested });
    global = updateCurrentStaking(global, { isLoading: false });
    setGlobal(global);

    if (!result) {
      void vibrateOnError();
      actions.showDialog({
        message: 'Unstaking was unsuccessful. Try again later.',
      });
      global = getGlobal();

      if (getDoesUsePinPad()) {
        global = clearIsPinAccepted(global);
      }
    } else {
      void vibrateOnSuccess();
      global = getGlobal();
      global = updateCurrentStaking(global, { state: StakingState.UnstakeComplete });
    }
  } else {
    const result = await callApi(
      'submitStake',
      global.currentAccountId!,
      password,
      amount!,
      state,
      getTonStakingFees(state.type).stake.real,
    );

    global = getGlobal();
    global = updateCurrentStaking(global, { isLoading: false });
    setGlobal(global);

    if (!result) {
      void vibrateOnError();
      actions.showDialog({
        message: 'Staking was unsuccessful. Try again later.',
      });

      global = getGlobal();
      if (getDoesUsePinPad()) {
        global = clearIsPinAccepted(global);
      }
    } else {
      void vibrateOnSuccess();
      global = getGlobal();
      global = updateCurrentStaking(global, { state: StakingState.StakeComplete });
    }
  }

  setGlobal(global);
});

addActionHandler('submitStakingHardware', async (global, actions, payload) => {
  const { isUnstaking } = payload || {};
  const { amount, tokenAmount } = global.currentStaking;
  const { currentAccountId } = global;

  const state = selectAccountStakingState(global, currentAccountId!);

  global = updateCurrentStaking(global, {
    isLoading: true,
    error: undefined,
    state: isUnstaking
      ? StakingState.UnstakeConfirmHardware
      : StakingState.StakeConfirmHardware,
  });
  setGlobal(global);

  const ledgerApi = await import('../../../util/ledger');
  global = getGlobal();

  let result: string | { error: ApiTransactionError } | undefined;
  const accountId = global.currentAccountId!;

  try {
    if (isUnstaking) {
      const stakingBalance = state.balance;
      const unstakeAmount = state.type === 'nominators' ? stakingBalance : tokenAmount!;

      result = await ledgerApi.submitLedgerUnstake(
        accountId,
        state,
        unstakeAmount,
        getTonStakingFees(state.type).unstake.real,
      );

      const isLongUnstakeRequested = getIsLongUnstake(state, unstakeAmount);

      global = getGlobal();
      global = updateAccountState(global, currentAccountId!, { isLongUnstakeRequested });
      setGlobal(global);
    } else {
      result = await ledgerApi.submitLedgerStake(
        accountId,
        amount!,
        state,
        getTonStakingFees(state.type).stake.real,
      );
    }
  } catch (err: any) {
    if (err instanceof ApiHardwareBlindSigningNotEnabled) {
      setGlobal(updateCurrentStaking(getGlobal(), {
        isLoading: false,
        error: '$hardware_blind_sign_not_enabled_internal',
      }));
      return;
    } else if (err instanceof ApiUserRejectsError) {
      setGlobal(updateCurrentStaking(getGlobal(), {
        isLoading: false,
        error: 'Canceled by the user',
      }));
      return;
    }
    logDebugError('submitStakingHardware', err);
  }

  global = getGlobal();
  global = updateCurrentStaking(global, { isLoading: false });
  setGlobal(global);

  if (!result) {
    void vibrateOnError();
    actions.showDialog({
      message: isUnstaking
        ? 'Unstaking was unsuccessful. Try again later.'
        : 'Staking was unsuccessful. Try again later.',
    });
  } else if (typeof result !== 'string' && 'error' in result) {
    void vibrateOnError();
    actions.showError({ error: result.error });
  } else {
    void vibrateOnSuccess();
    global = getGlobal();
    global = updateCurrentStaking(global, {
      state: isUnstaking ? StakingState.UnstakeComplete : StakingState.StakeComplete,
    });
    setGlobal(global);
  }
});

addActionHandler('clearStakingError', (global) => {
  setGlobal(updateCurrentStaking(global, { error: undefined }));
});

addActionHandler('cancelStaking', (global) => {
  if (getDoesUsePinPad()) {
    global = clearIsPinAccepted(global);
  }

  global = clearCurrentStaking(global);
  setGlobal(global);
});

addActionHandler('setStakingScreen', (global, actions, payload) => {
  const { state } = payload;

  setGlobal(updateCurrentStaking(global, { state }));
});

addActionHandler('fetchStakingHistory', async (global) => {
  const stakingHistory = await callApi('getStakingHistory', global.currentAccountId!);

  if (!stakingHistory) {
    return;
  }

  global = getGlobal();
  global = updateAccountState(global, global.currentAccountId!, { stakingHistory }, true);
  setGlobal(global);
});

addActionHandler('openAnyAccountStakingInfo', async (global, actions, { accountId, network, stakingId }) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openAnyAccountStakingInfo', { accountId, network, stakingId });
    return;
  }

  await Promise.all([
    closeAllOverlays(),
    switchAccount(global, accountId, network),
  ]);

  actions.changeCurrentStaking({ stakingId });
  actions.openStakingInfo();
});

// Should be called only when you're sure that the staking is active. Otherwise, call `openStakingInfoOrStart`.
addActionHandler('openStakingInfo', (global) => {
  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('openStakingInfo');
    return;
  }

  global = { ...global, isStakingInfoModalOpen: true };
  setGlobal(global);
});

addActionHandler('closeStakingInfo', (global) => {
  global = { ...global, isStakingInfoModalOpen: undefined };
  setGlobal(global);
});

addActionHandler('changeCurrentStaking', async (global, actions, { stakingId, shouldReopenModal }) => {
  if (IS_DELEGATED_BOTTOM_SHEET && shouldReopenModal) {
    callActionInMain('changeCurrentStaking', { stakingId, shouldReopenModal });
    return;
  }

  if (shouldReopenModal) {
    await pause(MODAL_CLOSING_DELAY);
  }

  global = getGlobal();
  global = updateAccountStaking(global, global.currentAccountId!, { stakingId });
  setGlobal(global);

  if (shouldReopenModal) {
    actions.openStakingInfoOrStart();
  }
});

addActionHandler('startStakingClaim', (global, actions, payload) => {
  const { stakingId } = payload || {};

  if (stakingId) {
    global = getGlobal();
    global = updateAccountStaking(global, global.currentAccountId!, { stakingId });
    setGlobal(global);

    global = getGlobal();
  }

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('startStakingClaim', payload);
    return;
  }

  if (selectIsHardwareAccount(global)) {
    global = resetHardware(global);
    global = updateCurrentStaking(global, { state: StakingState.ClaimConnectHardware });
  } else {
    global = updateCurrentStaking(global, { state: StakingState.ClaimPassword });
  }
  setGlobal(global);
});

addActionHandler('cancelStakingClaim', (global) => {
  global = updateCurrentStaking(global, { state: StakingState.None });
  setGlobal(global);
});

addActionHandler('submitStakingClaim', async (global, actions, { password }) => {
  const accountId = global.currentAccountId!;
  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateCurrentStaking(getGlobal(), { error: 'Wrong password, please try again.' }));
    return;
  }
  global = getGlobal();

  if (getDoesUsePinPad()) {
    global = setIsPinAccepted(global);
  }

  global = updateCurrentStaking(global, {
    isLoading: true,
    error: undefined,
  });
  setGlobal(global);
  await vibrateOnSuccess(true);

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('submitStakingClaim', { password });
    return;
  }

  global = getGlobal();

  const stakingState = selectAccountStakingState(global, accountId) as ApiEthenaStakingState | ApiJettonStakingState;
  const isEthenaStaking = stakingState.type === 'ethena';

  const result = await callApi(
    'submitStakingClaimOrUnlock',
    accountId,
    password,
    stakingState,
    getTonStakingFees(stakingState.type).claim?.real,
  );

  global = getGlobal();
  global = updateCurrentStaking(global, { isLoading: false });
  setGlobal(global);

  if (!result || 'error' in result) {
    if (getDoesUsePinPad()) {
      global = getGlobal();
      global = clearIsPinAccepted(global);
      setGlobal(global);
    }
    void vibrateOnError();
    actions.showError({ error: result?.error });
    return;
  } else {
    void vibrateOnSuccess();
  }

  global = getGlobal();
  global = updateCurrentStaking(global, {
    state: isEthenaStaking ? StakingState.ClaimComplete : StakingState.None,
  });
  setGlobal(global);

  if (IS_DELEGATING_BOTTOM_SHEET) {
    callActionInNative('setStakingScreen', {
      state: isEthenaStaking ? StakingState.ClaimComplete : StakingState.None,
    });
  }
});

addActionHandler('submitStakingClaimHardware', async (global, actions) => {
  global = updateCurrentStaking(global, {
    isLoading: true,
    error: undefined,
    state: StakingState.ClaimConfirmHardware,
  });
  setGlobal(global);

  const ledgerApi = await import('../../../util/ledger');
  global = getGlobal();

  const accountId = global.currentAccountId!;
  const stakingState = selectAccountStakingState(global, accountId) as ApiJettonStakingState | ApiEthenaStakingState;
  const isEthenaStaking = stakingState.type === 'ethena';

  let result: string | { error: ApiTransactionError } | undefined;

  try {
    result = await ledgerApi.submitLedgerStakingClaimOrUnlock(
      accountId,
      stakingState,
      getTonStakingFees(stakingState.type).claim?.real,
    );
  } catch (err: any) {
    if (err instanceof ApiHardwareBlindSigningNotEnabled) {
      setGlobal(updateCurrentStaking(getGlobal(), {
        isLoading: false,
        error: '$hardware_blind_sign_not_enabled_internal',
      }));
      return;
    } else if (err instanceof ApiUserRejectsError) {
      setGlobal(updateCurrentStaking(getGlobal(), {
        isLoading: false,
        error: 'Canceled by the user',
      }));
      return;
    }
    logDebugError('submitStakingClaimHardware', err);
  }

  global = getGlobal();
  global = updateCurrentStaking(global, { isLoading: false });
  setGlobal(global);

  if (!result) {
    actions.showError({ error: ApiCommonError.Unexpected });
  } else if (typeof result === 'object' && 'error' in result) {
    actions.showError({ error: result.error });
  } else {
    global = getGlobal();
    global = updateCurrentStaking(global, {
      state: isEthenaStaking ? StakingState.ClaimComplete : StakingState.None,
    });
    setGlobal(global);
  }
});

// Opens the staking info modal if the modal is available. Otherwise, opens the staking start modal.
addActionHandler('openStakingInfoOrStart', (global, actions) => {
  if (!global.currentAccountId) {
    return;
  }

  const stakingState = selectAccountStakingState(global, global.currentAccountId);

  if (getIsActiveStakingState(stakingState)) {
    actions.openStakingInfo();
  } else {
    actions.startStaking();
  }
});
