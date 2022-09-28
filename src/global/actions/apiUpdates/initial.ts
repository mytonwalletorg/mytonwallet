import { addActionHandler, setGlobal } from '../../index';

import { updateBalance, updateTokens } from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'updateBalance': {
      const newGlobal = updateBalance(global, update.accountId, update.slug, update.balance);
      if (newGlobal) {
        setGlobal(newGlobal);
      }

      break;
    }

    case 'updateTokens':
      global = updateTokens(global, update.tokens);
      setGlobal(global);

      break;
  }
});
