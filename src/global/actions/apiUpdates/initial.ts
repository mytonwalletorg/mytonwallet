import { addActionHandler, setGlobal } from '../../index';

import {
  updateAccountState,
  updateBalance,
  updatePoolState,
  updateTokens,
} from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'updateBalance': {
      const newGlobal = updateBalance(global, update.accountId, update.slug, update.balance);
      if (newGlobal) {
        setGlobal(newGlobal);
      }

      break;
    }

    case 'updateStakingState': {
      global = updateAccountState(global, update.accountId, {
        stakingBalance: update.stakingState.amount + update.stakingState.pendingDepositAmount,
        isUnstakeRequested: update.stakingState.isUnstakeRequested,
      }, true);
      setGlobal(global);
      break;
    }

    case 'updatePoolState': {
      global = updatePoolState(global, update.poolState, true);
      setGlobal(global);

      break;
    }

    case 'updateTokens':
      global = updateTokens(global, update.tokens, true);
      setGlobal(global);

      break;
  }
});
