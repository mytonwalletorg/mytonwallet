import { DappConnectState, TransferState } from '../../types';

import { TON_TOKEN_SLUG } from '../../../config';
import { IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { bigStrToHuman } from '../../helpers';
import { addActionHandler, setGlobal } from '../../index';
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
import {
  selectAccountState,
} from '../../selectors';

import { callActionInNative } from '../../../hooks/useDelegatedBottomSheet';

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

    case 'showError': {
      const { error } = update;
      actions.showError({ error });

      break;
    }

    case 'dappConnect': {
      if (IS_DELEGATING_BOTTOM_SHEET) {
        callActionInNative('apiUpdateDappConnect', update);
      }

      actions.apiUpdateDappConnect(update);

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

    case 'dappLoading': {
      const { connectionType } = update;

      if (connectionType === 'connect') {
        global = updateDappConnectRequest(global, {
          state: DappConnectState.Info,
        });
      } else if (connectionType === 'sendTransaction') {
        global = updateCurrentDappTransfer(global, {
          state: TransferState.Initial,
        });
      }
      setGlobal(global);
      break;
    }

    case 'dappSendTransactions': {
      if (IS_DELEGATING_BOTTOM_SHEET) {
        callActionInNative('apiUpdateDappSendTransaction', update);
      }

      actions.apiUpdateDappSendTransaction(update);

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
