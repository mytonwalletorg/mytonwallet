import type { ApiJettonStakingState } from '../../../api/types';
import { StakingState } from '../../types';

import { getDoesUsePinPad } from '../../../util/biometrics';
import { getTonStakingFees } from '../../../util/fee/getTonOperationFees';
import { pause } from '../../../util/schedulers';
import {
  getIsActiveStakingState,
  getIsLongUnstake,
  getIsNewStakeAllowed,
  getIsStakingClaimable,
  getIsStakingUnstakeable,
} from '../../../util/staking';
import { callApi } from '../../../api';
import { withEnclaveSessionRelease } from '../../helpers/enclave';
import { closeAllOverlays } from '../../helpers/misc';
import { handleTransferResult, isErrorTransferResult, prepareTransfer } from '../../helpers/transfer';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearCurrentStaking,
  clearIsPinAccepted,
  updateAccountStaking,
  updateAccountState,
  updateCurrentStaking,
} from '../../reducers';
import {
  selectAccountStakingState,
  selectAccountStakingStates,
  selectAccountStakingStatesBySlug,
  selectAccountState,
  selectCurrentAccountId,
} from '../../selectors';
import { switchAccount } from './auth';

const MODAL_CLOSING_DELAY = 50;

addActionHandler('switchStakingAccount', async (global, actions, { accountId, mode }) => {
  const currentAccountId = selectCurrentAccountId(global)!;
  if (accountId === currentAccountId) {
    return;
  }

  const prevTokenSlug = selectAccountStakingState(global, currentAccountId).tokenSlug;

  await switchAccount(global, accountId);

  // `switchAccount` keeps `currentStaking`, so clear it before restarting the flow on the new account
  global = getGlobal();
  global = clearCurrentStaking(global);
  setGlobal(global);

  // Prefer the new account's position for the same token, otherwise any position suitable for the mode
  const sameTokenState = selectAccountStakingStatesBySlug(global, accountId)[prevTokenSlug];

  function startStakingForAccount() {
    if (sameTokenState) {
      actions.startStaking({ tokenSlug: prevTokenSlug });
    } else {
      actions.startStaking();
    }
  }

  function startUnstakingForAccount() {
    const stakingState = sameTokenState && getIsStakingUnstakeable(sameTokenState)
      ? sameTokenState
      : selectAccountStakingStates(global, accountId).find(getIsStakingUnstakeable);

    if (stakingState) {
      actions.startUnstaking({ stakingId: stakingState.id });
    } else {
      // Nothing to unstake on the new account - offer staking the same token instead
      startStakingForAccount();
    }
  }

  switch (mode) {
    case 'stake':
      startStakingForAccount();
      break;

    case 'unstake':
      startUnstakingForAccount();
      break;

    case 'claim': {
      const stakingState = sameTokenState && getIsStakingClaimable(sameTokenState)
        ? sameTokenState
        : selectAccountStakingStates(global, accountId).find(getIsStakingClaimable);

      if (stakingState) {
        actions.startStakingClaim({ stakingId: stakingState.id });
      } else {
        // Nothing to claim - fall back to unstaking, or staking if there's no position
        startUnstakingForAccount();
      }
      break;
    }
  }
});

addActionHandler('startStaking', (global, actions, payload) => {
  const { stakingId, tokenSlug, initialAmount } = payload || {};
  const currentAccountId = selectCurrentAccountId(global)!;
  const states = selectAccountStakingStates(global, currentAccountId);
  const requestedState = stakingId
    ? states.find(({ id }) => id === stakingId)
    : tokenSlug
      ? selectAccountStakingStatesBySlug(global, currentAccountId)[tokenSlug]
      : selectAccountStakingState(global, currentAccountId);
  if (
    (stakingId || tokenSlug)
    && (!requestedState || (tokenSlug !== undefined && requestedState.tokenSlug !== tokenSlug))
  ) {
    return;
  }

  const effectiveTokenSlug = requestedState?.tokenSlug;
  if (!getIsNewStakeAllowed(effectiveTokenSlug)) {
    return;
  }

  if (requestedState) {
    global = updateAccountStaking(global, currentAccountId, { stakingId: requestedState.id });
  }

  const state = StakingState.StakeInitial;

  setGlobal(updateCurrentStaking(global, {
    state,
    initialAmount,
    error: undefined,
  }));
});

addActionHandler('startUnstaking', (global, actions, payload) => {
  const { stakingId } = payload || {};

  if (stakingId) {
    global = getGlobal();
    global = updateAccountStaking(global, selectCurrentAccountId(global)!, { stakingId });
    setGlobal(global);

    global = getGlobal();
  }

  const state = StakingState.UnstakeInitial;

  setGlobal(updateCurrentStaking(global, {
    state,
    error: undefined,
  }));
});

addActionHandler('fetchStakingFee', async (global, actions, payload) => {
  const { amount } = payload;
  const currentAccountId = selectCurrentAccountId(global);

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
  if (isErrorTransferResult(result)) {
    return;
  }

  global = getGlobal();
  global = updateCurrentStaking(global, {
    fee: result.explainedFee?.fullFee?.nativeSum,
  });
  setGlobal(global);
});

addActionHandler('submitStakingInitial', async (global, actions, payload) => {
  const { isUnstaking, amount } = payload ?? {};
  const currentAccountId = selectCurrentAccountId(global);

  if (!currentAccountId) {
    return;
  }

  const state = selectAccountStakingState(global, currentAccountId);

  // The stake form can still be reached with a blocked current position, e.g. via a stale `stakingId`
  if (!isUnstaking && !getIsNewStakeAllowed(state.tokenSlug)) {
    return;
  }

  setGlobal(updateCurrentStaking(global, { isLoading: true, error: undefined }));

  if (isUnstaking) {
    const result = await callApi('checkUnstakeDraft', currentAccountId, amount!, state);
    global = getGlobal();
    global = updateCurrentStaking(global, { isLoading: false });

    if (result) {
      if ('error' in result) {
        global = updateCurrentStaking(global, { error: result.error });
      } else {
        global = updateCurrentStaking(global, {
          state: StakingState.UnstakePassword,
          fee: result.explainedFee?.fullFee?.nativeSum,
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
        global = updateCurrentStaking(global, {
          state: StakingState.StakePassword,
          fee: result.explainedFee?.fullFee?.nativeSum,
          amount,
          error: undefined,
        });
      }
    }
  }

  setGlobal(global);
});

addActionHandler('submitStaking', withEnclaveSessionRelease(async (global, actions, payload = {}) => {
  const { enclaveToken, isUnstaking } = payload;
  const { amount, tokenAmount } = global.currentStaking;
  const currentAccountId = selectCurrentAccountId(global)!;

  prepareTransfer(updateCurrentStaking);

  global = getGlobal();
  const state = selectAccountStakingState(global, currentAccountId);

  if (isUnstaking) {
    const unstakeAmount = tokenAmount!;
    const result = await callApi(
      'submitUnstake',
      // This may be different from the `currentAccountId` if the user switched accounts
      // while the transaction was being signed
      selectCurrentAccountId(global)!,
      enclaveToken,
      unstakeAmount,
      state,
      getTonStakingFees(state.type).unstake.real,
    );

    if (!handleTransferResult(result, updateCurrentStaking)) {
      return;
    }

    global = getGlobal();
    const isLongUnstakeRequested = getIsLongUnstake(state, unstakeAmount);

    global = updateAccountState(global, currentAccountId, { isLongUnstakeRequested });
    global = updateCurrentStaking(global, { state: StakingState.UnstakeComplete });
    setGlobal(global);
  } else {
    const result = await callApi(
      'submitStake',
      // This may be different from the `currentAccountId` if the user switched accounts
      // while the transaction was being signed
      selectCurrentAccountId(global)!,
      enclaveToken,
      amount!,
      state,
      getTonStakingFees(state.type).stake.real,
    );

    if (!handleTransferResult(result, updateCurrentStaking)) {
      return;
    }

    global = getGlobal();
    global = updateCurrentStaking(global, { state: StakingState.StakeComplete });
    setGlobal(global);
  }
}));

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

addActionHandler('openAnyAccountStakingInfo', async (global, actions, { accountId, network, stakingId }) => {
  await Promise.all([
    closeAllOverlays(),
    switchAccount(global, accountId, network),
  ]);

  actions.changeCurrentStaking({ stakingId });
  actions.openStakingInfo();
});

// Should be called only when you're sure that the staking is active. Otherwise, call `openStakingInfoOrStart`.
addActionHandler('openStakingInfo', (global) => {
  global = { ...global, isStakingInfoModalOpen: true };
  setGlobal(global);
});

addActionHandler('closeStakingInfo', (global) => {
  global = { ...global, isStakingInfoModalOpen: undefined };
  setGlobal(global);
});

addActionHandler('changeCurrentStaking', async (global, actions, { stakingId, shouldReopenModal }) => {
  if (shouldReopenModal) {
    await pause(MODAL_CLOSING_DELAY);
  }

  global = getGlobal();
  global = updateAccountStaking(global, selectCurrentAccountId(global)!, { stakingId });
  setGlobal(global);

  if (shouldReopenModal) {
    actions.openStakingInfoOrStart();
  }
});

addActionHandler('startStakingClaim', (global, actions, payload) => {
  const { stakingId } = payload || {};

  if (stakingId) {
    global = getGlobal();
    global = updateAccountStaking(global, selectCurrentAccountId(global)!, { stakingId });
    setGlobal(global);

    global = getGlobal();
  }

  global = updateCurrentStaking(global, { state: StakingState.ClaimPassword });
  setGlobal(global);
});

addActionHandler('cancelStakingClaim', (global) => {
  global = updateCurrentStaking(global, { state: StakingState.None });
  setGlobal(global);
});

addActionHandler('submitStakingClaim', withEnclaveSessionRelease(async (global, actions, payload) => {
  const { enclaveToken } = payload ?? {};
  const accountId = selectCurrentAccountId(global)!;

  prepareTransfer(updateCurrentStaking);

  global = getGlobal();

  const stakingState = selectAccountStakingState(global, accountId) as ApiJettonStakingState;

  const result = await callApi(
    'submitStakingClaimOrUnlock',
    accountId,
    enclaveToken,
    stakingState,
    getTonStakingFees(stakingState.type).claim?.real,
  );

  if (!handleTransferResult(result, updateCurrentStaking)) {
    return;
  }

  global = getGlobal();
  global = updateCurrentStaking(global, {
    state: StakingState.None,
  });
  setGlobal(global);
}));

// Opens the staking info modal if the modal is available. Otherwise, opens the staking start modal.
addActionHandler('openStakingInfoOrStart', (global, actions) => {
  const currentAccountId = selectCurrentAccountId(global);

  if (!currentAccountId) {
    return;
  }

  let stakingState = selectAccountStakingState(global, currentAccountId);

  // Prefer the currently viewed token over the last one selected in the modal, when it supports staking
  const currentTokenSlug = selectAccountState(global, currentAccountId)?.currentTokenSlug;
  if (currentTokenSlug && stakingState.tokenSlug !== currentTokenSlug) {
    const activeTokenStakingState = selectAccountStakingStatesBySlug(global, currentAccountId)[currentTokenSlug];
    if (activeTokenStakingState) {
      global = updateAccountStaking(global, currentAccountId, { stakingId: activeTokenStakingState.id });
      setGlobal(global);
      stakingState = activeTokenStakingState;
    }
  }

  if (getIsActiveStakingState(stakingState)) {
    actions.openStakingInfo();
  } else {
    actions.startStaking();
  }
});
