import { DappConnectState, TransferState } from '../../types';

import { TON_TOKEN_SLUG } from '../../../config';
import { callApi } from '../../../api';
import { bigStrToHuman } from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearCurrentDappTransfer,
  clearCurrentSignature,
  clearCurrentTransfer,
  updateAccountState,
  updateCurrentDappTransfer,
  updateCurrentSignature,
  updateCurrentTransfer,
  updateDappConnectRequest,
} from '../../reducers';
import { selectAccount, selectAccountState, selectNewestTxIds } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'createTransaction': {
      const {
        promiseId,
        amount,
        toAddress,
        fee,
        comment,
        rawPayload,
        parsedPayload,
        stateInit,
      } = update;

      global = clearCurrentTransfer(global);
      global = updateCurrentTransfer(global, {
        state: TransferState.Confirm,
        toAddress,
        amount: bigStrToHuman(amount), // TODO Unsafe?
        fee,
        comment,
        promiseId,
        tokenSlug: TON_TOKEN_SLUG,
        rawPayload,
        parsedPayload,
        stateInit,
      });
      setGlobal(global);

      break;
    }

    case 'createSignature': {
      const { promiseId, dataHex } = update;

      global = clearCurrentSignature(global);
      global = updateCurrentSignature(global, {
        promiseId,
        dataHex,
      });
      setGlobal(global);

      break;
    }

    case 'showTxDraftError': {
      const { error } = update;
      actions.showTxDraftError({ error });

      break;
    }

    case 'showError': {
      const { error } = update;
      actions.showError({ error });

      break;
    }

    case 'updateTonProxyState': {
      const { isEnabled } = update;

      setGlobal({
        ...global,
        settings: {
          ...global.settings,
          isTonProxyEnabled: isEnabled,
        },
      });

      break;
    }

    case 'updateTonMagicState': {
      const { isEnabled } = update;

      setGlobal({
        ...global,
        settings: {
          ...global.settings,
          isTonMagicEnabled: isEnabled,
        },
      });

      break;
    }

    case 'dappConnect': {
      const {
        promiseId,
        dapp,
        accountId,
        permissions,
        proof,
      } = update;

      const { isHardware } = selectAccount(global, accountId)!;

      global = updateDappConnectRequest(global, {
        state: DappConnectState.Info,
        promiseId,
        accountId,
        dapp,
        permissions: {
          isAddressRequired: permissions.address,
          isPasswordRequired: permissions.proof && !isHardware,
        },
        proof,
      });
      setGlobal(global);

      break;
    }

    case 'updateActiveDapp': {
      const { accountId, origin } = update;

      global = updateAccountState(global, accountId, {
        activeDappOrigin: origin,
      });
      setGlobal(global);
      break;
    }

    case 'dappDisconnect': {
      const { accountId, origin } = update;
      const accountState = selectAccountState(global, accountId);

      if (accountState?.activeDappOrigin === origin) {
        global = updateAccountState(global, accountId, {
          activeDappOrigin: undefined,
        });
        global = clearCurrentDappTransfer(global);
        setGlobal(global);
      }
      break;
    }

    case 'dappSendTransactions': {
      const {
        promiseId,
        transactions,
        fee,
        accountId,
        dapp,
      } = update;

      (async () => {
        const { currentAccountId } = global;
        if (currentAccountId !== accountId) {
          const newestTxIds = selectNewestTxIds(global, accountId);
          await callApi('activateAccount', accountId, newestTxIds);
          setGlobal({
            ...getGlobal(),
            currentAccountId: accountId,
          });
        }

        global = getGlobal();
        global = clearCurrentDappTransfer(global);
        global = updateCurrentDappTransfer(global, {
          state: TransferState.Initial,
          promiseId,
          transactions,
          fee,
          dapp,
        });
        setGlobal(global);
      })();

      break;
    }

    case 'updateDeeplinkHookState': {
      const { isEnabled } = update;

      setGlobal({
        ...global,
        settings: {
          ...global.settings,
          isDeeplinkHookEnabled: isEnabled,
        },
      });

      break;
    }

    case 'prepareTransaction': {
      const {
        amount,
        toAddress,
        comment,
      } = update;

      global = clearCurrentTransfer(global);
      global = updateCurrentTransfer(global, {
        state: TransferState.Initial,
        toAddress,
        amount: bigStrToHuman(amount || '0'),
        comment,
        tokenSlug: TON_TOKEN_SLUG,
      });

      setGlobal(global);
    }
  }
});
