import type { ApiSubmitTransferOptions } from '../../../api/methods/types';
import { ApiCommonError } from '../../../api/types';
import { VestingUnfreezeState } from '../../types';

import {
  CLAIM_ADDRESS,
  CLAIM_AMOUNT,
  CLAIM_COMMENT,
  IS_CAPACITOR,
  MYCOIN,
  MYCOIN_TESTNET,
  TONCOIN,
} from '../../../config';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/capacitor';
import { callActionInMain } from '../../../util/multitab';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearIsPinAccepted,
  setIsPinAccepted,
  updateVesting,
} from '../../reducers';
import { selectVestingPartsReadyToUnfreeze } from '../../selectors';

addActionHandler('submitClaimingVesting', async (global, actions, { password }) => {
  const accountId = global.currentAccountId!;
  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateVesting(getGlobal(), accountId, { error: 'Wrong password, please try again.' }));

    return;
  }
  global = getGlobal();

  if (IS_CAPACITOR) {
    global = setIsPinAccepted(global);
  }

  global = updateVesting(global, accountId, {
    isLoading: true,
    error: undefined,
  });
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
  }

  if (IS_DELEGATED_BOTTOM_SHEET) {
    callActionInMain('submitClaimingVesting', { password });
    return;
  }

  global = getGlobal();
  const unfreezeRequestedIds = selectVestingPartsReadyToUnfreeze(global, accountId);

  const options: ApiSubmitTransferOptions = {
    accountId: global.currentAccountId!,
    password,
    toAddress: CLAIM_ADDRESS,
    amount: CLAIM_AMOUNT,
    comment: CLAIM_COMMENT,
  };
  const result = await callApi('submitTransfer', 'ton', options);

  global = getGlobal();
  global = updateVesting(global, accountId, { isLoading: false });
  setGlobal(global);

  if (!result || 'error' in result) {
    if (IS_CAPACITOR) {
      global = getGlobal();
      global = clearIsPinAccepted(global);
      setGlobal(global);
      void vibrateOnError();
    }
    actions.showError({ error: result?.error });
    return;
  } else if (IS_CAPACITOR) {
    void vibrateOnSuccess();
  }

  global = getGlobal();
  global = updateVesting(global, accountId, {
    isConfirmRequested: undefined,
    unfreezeRequestedIds,
  });
  setGlobal(global);

  actions.openVestingModal();
});

addActionHandler('submitClaimingVestingHardware', async (global, actions) => {
  global = updateVesting(global, global.currentAccountId!, {
    isLoading: true,
    error: undefined,
    unfreezeState: VestingUnfreezeState.ConfirmHardware,
  });
  setGlobal(global);

  const ledgerApi = await import('../../../util/ledger');
  global = getGlobal();

  const accountId = global.currentAccountId!;
  const unfreezeRequestedIds = selectVestingPartsReadyToUnfreeze(global, accountId);
  const options: ApiSubmitTransferOptions = {
    accountId,
    password: '',
    toAddress: CLAIM_ADDRESS,
    amount: CLAIM_AMOUNT,
    comment: CLAIM_COMMENT,
  };

  const result = await ledgerApi.submitLedgerTransfer(options, TONCOIN.slug);

  global = getGlobal();
  global = updateVesting(global, accountId, { isLoading: false });
  setGlobal(global);

  if (!result) {
    actions.showError({ error: ApiCommonError.Unexpected });
  } else {
    global = getGlobal();
    global = updateVesting(global, accountId, {
      isConfirmRequested: undefined,
      unfreezeRequestedIds,
    });
    setGlobal(global);
    actions.openVestingModal();
  }
});

addActionHandler('loadMycoin', (global, actions) => {
  const { isTestnet } = global.settings;

  actions.importToken({ address: isTestnet ? MYCOIN_TESTNET.minterAddress : MYCOIN.minterAddress });
});
