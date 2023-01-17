import { TransferState } from '../../types';

import { addActionHandler, setGlobal } from '../../index';

import { bigStrToHuman } from '../../helpers';
import {
  clearCurrentSignature,
  clearCurrentTransfer,
  updateCurrentSignature,
  updateCurrentTransfer,
} from '../../reducers';
import { TON_TOKEN_SLUG } from '../../../config';

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
    }
  }
});
