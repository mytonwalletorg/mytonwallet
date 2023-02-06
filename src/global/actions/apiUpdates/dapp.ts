import { TransferState } from '../../types';

import { addActionHandler, setGlobal } from '../../index';

import { TON_TOKEN_SLUG } from '../../../config';
import { bigStrToHuman } from '../../helpers';
import {
  clearCurrentSignature,
  clearCurrentTransfer,
  updateAccountState,
  updateCurrentSignature,
  updateCurrentTransfer,
  updateDappConnectRequest,
} from '../../reducers';
import { selectAccountState } from '../../selectors';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update.type) {
    case 'createTransaction': {
      const {
        promiseId,
        amount,
        toAddress,
        fee,
        comment,
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
      } = update;

      global = updateDappConnectRequest(global, {
        promiseId,
        accountId,
        dapp,
        permissions: {
          isAddressRequired: permissions.address,
          isPasswordRequired: permissions.proof,
        },
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
        setGlobal(global);
      }
      break;
    }
  }
});
