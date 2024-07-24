import type { ApiTransactionError } from '../../../api/types';
import { StakingState } from '../../types';

import {
  IS_CAPACITOR, MIN_BALANCE_FOR_UNSTAKE, TONCOIN_SLUG,
} from '../../../config';
import { vibrateOnSuccess } from '../../../util/capacitor';
import { callActionInMain } from '../../../util/multitab';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearIsPinAccepted,
  clearStaking,
  setIsPinAccepted,
  updateAccountState,
  updateStaking,
} from '../../reducers';
import { selectAccount, selectAccountState } from '../../selectors';

addActionHandler('startStaking', (global, actions, payload) => {
  const isOpen = global.staking.state !== StakingState.None;
  if (IS_DELEGATED_BOTTOM_SHEET && !isOpen) {
    callActionInMain('startStaking', payload);
    return;
  }

  const { isUnstaking } = payload || {};

  const accountState = selectAccountState(global, global.currentAccountId!);
  const balance = accountState?.balances?.bySlug[TONCOIN_SLUG] ?? 0n;
  const isNotEnoughBalance = balance < MIN_BALANCE_FOR_UNSTAKE;

  const state = isUnstaking
    ? isNotEnoughBalance
      ? StakingState.NotEnoughBalance
      : StakingState.UnstakeInitial
    : StakingState.StakeInitial;

  setGlobal(updateStaking(global, {
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

  const result = await callApi(
    'checkStakeDraft',
    currentAccountId,
    amount!,
  );
  if (!result || 'error' in result) {
    return;
  }

  global = getGlobal();
  global = updateStaking(global, {
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

  setGlobal(updateStaking(global, { isLoading: true, error: undefined }));

  if (isUnstaking) {
    const result = await callApi('checkUnstakeDraft', currentAccountId, amount!);
    global = getGlobal();
    global = updateStaking(global, { isLoading: false });

    if (result) {
      if ('error' in result) {
        global = updateStaking(global, { error: result.error });
      } else {
        const account = selectAccount(global, currentAccountId)!;
        if (account.isHardware) {
          actions.resetHardwareWalletConnect();
          global = updateStaking(getGlobal(), { state: StakingState.UnstakeConnectHardware });
        } else {
          global = updateStaking(global, { state: StakingState.UnstakePassword });
        }

        global = updateStaking(global, {
          fee: result.fee,
          amount,
          error: undefined,
          type: result.type,
          tokenAmount: result.tokenAmount,
        });
      }
    }
  } else {
    const result = await callApi(
      'checkStakeDraft',
      currentAccountId,
      amount!,
    );
    global = getGlobal();
    global = updateStaking(global, { isLoading: false });

    if (result) {
      if ('error' in result) {
        global = updateStaking(global, { error: result.error });
      } else {
        const account = selectAccount(global, currentAccountId)!;
        if (account.isHardware) {
          actions.resetHardwareWalletConnect();
          global = updateStaking(getGlobal(), { state: StakingState.StakeConnectHardware });
        } else {
          global = updateStaking(global, { state: StakingState.StakePassword });
        }

        global = updateStaking(global, {
          fee: result.fee,
          amount,
          error: undefined,
          type: result.type,
        });
      }
    }
  }

  setGlobal(global);
});

addActionHandler('submitStakingPassword', async (global, actions, payload) => {
  const { password, isUnstaking } = payload;
  const {
    fee,
    type,
    amount,
    tokenAmount,
  } = global.staking;
  const { currentAccountId } = global;

  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateStaking(getGlobal(), { error: 'Wrong password, please try again.' }));

    return;
  }

  global = getGlobal();

  if (IS_CAPACITOR) {
    global = setIsPinAccepted(global);
  }

  global = updateStaking(global, {
    isLoading: true,
    error: undefined,
  });
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
  }

  global = getGlobal();

  if (isUnstaking) {
    const { instantAvailable } = global.stakingInfo.liquid ?? {};
    const stakingBalance = selectAccountState(global, currentAccountId!)!.staking!.balance;

    const unstakeAmount = type === 'nominators' ? stakingBalance : tokenAmount!;
    const result = await callApi(
      'submitUnstake',
      global.currentAccountId!,
      password,
      type!,
      unstakeAmount,
      fee,
    );

    const isLongUnstakeRequested = Boolean(
      type === 'nominators' || (type === 'liquid' && instantAvailable && instantAvailable < stakingBalance),
    );

    global = getGlobal();
    global = updateAccountState(global, currentAccountId!, { isLongUnstakeRequested });
    global = updateStaking(global, { isLoading: false });
    setGlobal(global);

    if (!result) {
      actions.showDialog({
        message: 'Unstaking was unsuccessful. Try again later.',
      });
      global = getGlobal();

      if (IS_CAPACITOR) {
        global = clearIsPinAccepted(global);
      }
    } else {
      global = getGlobal();
      global = updateStaking(global, { state: StakingState.UnstakeComplete });
    }
  } else {
    const result = await callApi(
      'submitStake',
      global.currentAccountId!,
      password,
      amount!,
      type!,
      fee,
    );

    global = getGlobal();
    global = updateStaking(global, { isLoading: false });
    setGlobal(global);

    if (!result) {
      actions.showDialog({
        message: 'Staking was unsuccessful. Try again later.',
      });

      global = getGlobal();
      if (IS_CAPACITOR) {
        global = clearIsPinAccepted(global);
      }
    } else {
      global = getGlobal();
      global = updateStaking(global, { state: StakingState.StakeComplete });
    }
  }

  setGlobal(global);
});

addActionHandler('submitStakingHardware', async (global, actions, payload) => {
  const { isUnstaking } = payload || {};
  const {
    fee,
    amount,
    type,
    tokenAmount,
  } = global.staking;
  const { currentAccountId } = global;

  global = updateStaking(global, {
    isLoading: true,
    error: undefined,
    state: StakingState.StakeConfirmHardware,
  });
  setGlobal(global);

  const ledgerApi = await import('../../../util/ledger');
  global = getGlobal();

  let result: string | { error: ApiTransactionError } | undefined;
  const accountId = global.currentAccountId!;

  if (isUnstaking) {
    const { instantAvailable } = global.stakingInfo.liquid ?? {};
    const stakingBalance = selectAccountState(global, currentAccountId!)!.staking!.balance;
    const unstakeAmount = type === 'nominators' ? stakingBalance : tokenAmount!;

    result = await ledgerApi.submitLedgerUnstake(accountId, type!, unstakeAmount);

    const isLongUnstakeRequested = Boolean(
      type === 'nominators' || (type === 'liquid' && instantAvailable && instantAvailable < stakingBalance),
    );

    global = getGlobal();
    global = updateAccountState(global, currentAccountId!, { isLongUnstakeRequested });
    setGlobal(global);
  } else {
    result = await ledgerApi.submitLedgerStake(
      accountId,
      amount!,
      type!,
      fee,
    );
  }

  global = getGlobal();
  global = updateStaking(global, { isLoading: false });
  setGlobal(global);

  if (!result) {
    actions.showDialog({
      message: isUnstaking
        ? 'Unstaking was unsuccessful. Try again later.'
        : 'Staking was unsuccessful. Try again later.',
    });
  } else if (typeof result !== 'string' && 'error' in result) {
    actions.showError({ error: result.error });
  } else {
    global = getGlobal();
    global = updateStaking(global, {
      state: isUnstaking ? StakingState.UnstakeComplete : StakingState.StakeComplete,
    });
    setGlobal(global);
  }
});

addActionHandler('clearStakingError', (global) => {
  setGlobal(updateStaking(global, { error: undefined }));
});

addActionHandler('cancelStaking', (global) => {
  if (IS_CAPACITOR) {
    global = clearIsPinAccepted(global);
  }

  global = clearStaking(global);
  setGlobal(global);
});

addActionHandler('setStakingScreen', (global, actions, payload) => {
  const { state } = payload;

  setGlobal(updateStaking(global, { state }));
});

addActionHandler('fetchStakingHistory', async (global, actions, payload) => {
  const { limit, offset } = payload ?? {};
  const stakingHistory = await callApi('getStakingHistory', global.currentAccountId!, limit, offset);

  if (!stakingHistory) {
    return;
  }

  global = getGlobal();
  global = updateAccountState(global, global.currentAccountId!, { stakingHistory }, true);
  setGlobal(global);
});

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
