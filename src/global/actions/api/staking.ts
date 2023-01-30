import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { StakingState } from '../../types';

import { callApi } from '../../../api';
import { DEFAULT_DECIMAL_PLACES } from '../../../config';
import {
  clearStaking,
  updateAccountState,
  updateStaking,
  updatePoolState,
} from '../../reducers';
import { humanToBigStr } from '../../helpers';

addActionHandler('fetchStakingState', async (global) => {
  const { currentAccountId } = global;

  const stakingState = await callApi('getStakingState', currentAccountId!);
  if (!stakingState) {
    return;
  }

  setGlobal(updateAccountState(getGlobal(), currentAccountId!, {
    stakingBalance: stakingState.amount + stakingState.pendingDepositAmount,
    isUnstakeRequested: stakingState.isUnstakeRequested,
  }, true));
});

addActionHandler('startStaking', (global, actions, payload) => {
  const { isUnstaking } = payload || {};

  setGlobal(updateStaking(global, {
    state: isUnstaking ? StakingState.UnstakeInitial : StakingState.StakeInitial,
    error: undefined,
  }));
});

addActionHandler('submitStakingInitial', async (global, actions, payload) => {
  const { amount, isUnstaking } = payload || {};
  const { currentAccountId } = global;

  if (!currentAccountId) {
    return;
  }

  setGlobal(updateStaking(global, { isLoading: true, error: undefined }));

  if (isUnstaking) {
    const result = await callApi('checkUnstakeDraft', currentAccountId);
    global = getGlobal();
    global = updateStaking(global, { isLoading: false });

    if (result) {
      if (result.error) {
        global = updateStaking(global, { error: result.error });
      } else {
        global = updateStaking(global, {
          state: StakingState.UnstakePassword,
          fee: result.fee,
          amount,
          error: undefined,
        });
      }
    }
  } else {
    const result = await callApi(
      'checkStakeDraft',
      currentAccountId,
      humanToBigStr(amount!, DEFAULT_DECIMAL_PLACES),
    );
    global = getGlobal();
    global = updateStaking(global, { isLoading: false });

    if (result) {
      if (result.error) {
        global = updateStaking(global, { error: result.error });
      } else {
        global = updateStaking(global, {
          state: StakingState.StakePassword,
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
  const { amount, fee } = global.staking;

  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateStaking(getGlobal(), { error: 'Wrong password, please try again' }));

    return;
  }

  setGlobal(updateStaking(getGlobal(), {
    isLoading: true,
    error: undefined,
  }));

  if (isUnstaking) {
    const result = await callApi(
      'submitUnstake',
      global.currentAccountId!,
      password,
      fee,
    );

    global = getGlobal();
    global = updateStaking(global, { isLoading: false });
    if (!result) {
      actions.showDialog({
        message: 'Unstaking was unsuccessful. Try again later',
      });
    } else {
      global = updateStaking(global, { state: StakingState.UnstakeComplete });
    }
  } else {
    const result = await callApi(
      'submitStake',
      global.currentAccountId!,
      password,
      humanToBigStr(amount!, DEFAULT_DECIMAL_PLACES),
      fee,
    );

    global = getGlobal();
    global = updateStaking(global, { isLoading: false });
    if (!result) {
      actions.showDialog({
        message: 'Staking was unsuccessful. Try again later',
      });
    } else {
      global = updateStaking(global, { state: StakingState.StakeComplete });
    }
  }

  setGlobal(global);
});

addActionHandler('cleanStakingError', (global) => {
  setGlobal(updateStaking(global, { error: undefined }));
});

addActionHandler('cancelStaking', (global) => {
  setGlobal(clearStaking(global));
});

addActionHandler('setStakingScreen', (global, actions, payload) => {
  const { state } = payload;

  setGlobal(updateStaking(global, { state }));
});

addActionHandler('fetchPoolState', async (global) => {
  const poolState = await callApi('getPoolState', global.currentAccountId!);
  if (!poolState) {
    return;
  }

  global = getGlobal();
  global = updatePoolState(global, poolState, true);
  setGlobal(global);
});

addActionHandler('fetchStakingHistory', async (global) => {
  const result = await callApi('getStakingHistory', global.currentAccountId!);

  if (!result) {
    return;
  }

  global = getGlobal();
  global = updateAccountState(global, global.currentAccountId!, { stakingHistory: result }, true);
  setGlobal(global);
});
