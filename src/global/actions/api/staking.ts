import { StakingState } from '../../types';

import { DEFAULT_DECIMAL_PLACES, IS_CAPACITOR } from '../../../config';
import { Big } from '../../../lib/big.js';
import { vibrateOnSuccess } from '../../../util/capacitor';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { humanToBigStr } from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearIsPinAccepted,
  clearStaking,
  setIsPinAccepted,
  updateAccountState,
  updateStaking,
} from '../../reducers';
import { selectAccountState } from '../../selectors';

import { callActionInMain } from '../../../hooks/useDelegatedBottomSheet';

addActionHandler('startStaking', (global, actions, payload) => {
  const isOpen = global.staking.state !== StakingState.None;
  if (IS_DELEGATED_BOTTOM_SHEET && !isOpen) {
    callActionInMain('startStaking', payload);
    return;
  }

  const { isUnstaking } = payload || {};

  setGlobal(updateStaking(global, {
    state: isUnstaking ? StakingState.UnstakeInitial : StakingState.StakeInitial,
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
    humanToBigStr(amount!, DEFAULT_DECIMAL_PLACES),
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
  const { isUnstaking } = payload || {};
  let { amount } = payload ?? {};
  const { currentAccountId } = global;

  if (!currentAccountId) {
    return;
  }

  setGlobal(updateStaking(global, { isLoading: true, error: undefined }));

  if (isUnstaking) {
    amount = selectAccountState(global, currentAccountId)!.staking!.balance;
    const result = await callApi('checkUnstakeDraft', currentAccountId, humanToBigStr(amount));
    global = getGlobal();
    global = updateStaking(global, { isLoading: false });

    if (result) {
      if ('error' in result) {
        global = updateStaking(global, { error: result.error });
      } else {
        global = updateStaking(global, {
          state: StakingState.UnstakePassword,
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
      humanToBigStr(amount!, DEFAULT_DECIMAL_PLACES),
    );
    global = getGlobal();
    global = updateStaking(global, { isLoading: false });

    if (result) {
      if ('error' in result) {
        global = updateStaking(global, { error: result.error });
      } else {
        global = updateStaking(global, {
          state: StakingState.StakePassword,
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

    const unstakeAmount = type === 'nominators' ? humanToBigStr(stakingBalance) : tokenAmount!;
    const result = await callApi(
      'submitUnstake',
      global.currentAccountId!,
      password,
      type!,
      unstakeAmount,
      fee,
    );

    const isLongUnstakeRequested = type === 'liquid'
      ? Boolean(instantAvailable) && Big(instantAvailable).lt(stakingBalance)
      : true;

    global = getGlobal();
    global = updateAccountState(global, currentAccountId!, { isLongUnstakeRequested });
    global = updateStaking(global, { isLoading: false });
    setGlobal(global);

    if (!result) {
      actions.showDialog({
        message: 'Unstaking was unsuccessful. Try again later',
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
      humanToBigStr(amount!, DEFAULT_DECIMAL_PLACES),
      type!,
      fee,
    );

    global = getGlobal();
    global = updateStaking(global, { isLoading: false });
    setGlobal(global);

    if (!result) {
      actions.showDialog({
        message: 'Staking was unsuccessful. Try again later',
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
