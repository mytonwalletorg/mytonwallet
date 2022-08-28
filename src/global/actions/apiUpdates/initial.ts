import { GlobalState } from '../../types';

import { addActionHandler, setGlobal } from '../../index';

import { updateBalance, updateTokens, updateTransaction } from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  let newGlobal: GlobalState | undefined;
  switch (update.type) {
    case 'updateBalance':
      newGlobal = updateBalance(global, update.accountId, update.slug, update.balance);
      if (newGlobal) {
        setGlobal(newGlobal);
      }

      break;

    case 'newTransaction':
      newGlobal = updateTransaction(global, update.transaction);
      setGlobal(newGlobal);
      break;

    case 'updateTokens':
      newGlobal = updateTokens(global, update.tokens);
      setGlobal(newGlobal);

      break;
  }
});
