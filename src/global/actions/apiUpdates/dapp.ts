import { TransferState } from '../../types';

import { TONCOIN } from '../../../config';
import { processDeeplink } from '../../../util/deeplink';
import { callActionInNative } from '../../../util/multitab';
import { IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { addActionHandler, setGlobal } from '../../index';
import {
  clearCurrentDappTransfer,
  clearCurrentSignature,
  clearCurrentTransfer,
  clearDappConnectRequest,
  updateCurrentSignature,
  updateCurrentTransfer,
} from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'createTransaction': {
      const {
        promiseId,
        amount,
        toAddress,
        fee,
        realFee,
        comment,
        rawPayload,
        parsedPayload,
        stateInit,
      } = update;

      global = clearCurrentTransfer(global);
      global = updateCurrentTransfer(global, {
        state: TransferState.Confirm,
        toAddress,
        amount,
        fee,
        realFee,
        comment,
        promiseId,
        tokenSlug: TONCOIN.slug,
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

    case 'dappConnectComplete': {
      global = clearDappConnectRequest(global);
      setGlobal(global);

      break;
    }

    case 'dappDisconnect': {
      const { url } = update;

      if (global.currentDappTransfer.dapp?.url === url) {
        global = clearCurrentDappTransfer(global);
        setGlobal(global);
      }
      break;
    }

    case 'dappLoading': {
      if (IS_DELEGATING_BOTTOM_SHEET) {
        callActionInNative('apiUpdateDappLoading', update);
      }

      actions.apiUpdateDappLoading(update);

      break;
    }

    case 'dappCloseLoading': {
      if (IS_DELEGATING_BOTTOM_SHEET) {
        callActionInNative('apiUpdateDappCloseLoading', update);
      }

      actions.apiUpdateDappCloseLoading(update);

      break;
    }

    case 'dappSendTransactions': {
      if (IS_DELEGATING_BOTTOM_SHEET) {
        callActionInNative('apiUpdateDappSendTransaction', update);
      }

      actions.apiUpdateDappSendTransaction(update);
      break;
    }

    case 'dappSignData': {
      if (IS_DELEGATING_BOTTOM_SHEET) {
        callActionInNative('apiUpdateDappSignData', update);
      }

      actions.apiUpdateDappSignData(update);
      break;
    }

    case 'updateDapps': {
      if (IS_DELEGATING_BOTTOM_SHEET) {
        callActionInNative('getDapps');
      }

      actions.getDapps();
      break;
    }

    case 'prepareTransaction': {
      const {
        amount,
        toAddress,
        comment,
        binPayload,
      } = update;

      global = clearCurrentTransfer(global);
      global = updateCurrentTransfer(global, {
        state: TransferState.Initial,
        toAddress,
        amount: amount ?? 0n,
        comment,
        tokenSlug: TONCOIN.slug,
        binPayload,
      });

      setGlobal(global);
      break;
    }

    case 'processDeeplink': {
      const { url } = update;

      void processDeeplink(url);
      break;
    }
  }
});
