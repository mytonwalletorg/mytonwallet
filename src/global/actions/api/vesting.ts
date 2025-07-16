import type { ApiSubmitTransferOptions } from '../../../api/methods/types';
import { VestingUnfreezeState } from '../../types';

import {
  CLAIM_ADDRESS,
  CLAIM_AMOUNT,
  CLAIM_COMMENT,
  MYCOIN,
  MYCOIN_TESTNET,
} from '../../../config';
import { getDoesUsePinPad } from '../../../util/biometrics';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/haptics';
import { callActionInMain } from '../../../util/multitab';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearIsPinAccepted,
  setIsPinAccepted,
  updateVesting,
} from '../../reducers';
import { selectIsHardwareAccount, selectVestingPartsReadyToUnfreeze } from '../../selectors';

addActionHandler('submitClaimingVesting', async (global, actions, { password = '' } = {}) => {
  const accountId = global.currentAccountId!;
  const isHardware = selectIsHardwareAccount(global);
  if (!isHardware && !(await callApi('verifyPassword', password))) {
    setGlobal(updateVesting(getGlobal(), accountId, { error: 'Wrong password, please try again.' }));

    return;
  }
  global = getGlobal();

  if (!isHardware && getDoesUsePinPad()) {
    global = setIsPinAccepted(global);
  }

  global = updateVesting(global, accountId, {
    isLoading: true,
    error: undefined,
    ...(isHardware && { unfreezeState: VestingUnfreezeState.ConfirmHardware }),
  });
  setGlobal(global);
  if (!isHardware) {
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
    if (!isHardware && getDoesUsePinPad()) {
      global = getGlobal();
      global = clearIsPinAccepted(global);
      setGlobal(global);
    }
    void vibrateOnError();
    actions.showError({ error: result?.error });
    return;
  } else {
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

addActionHandler('loadMycoin', (global, actions) => {
  const { isTestnet } = global.settings;

  actions.importToken({ address: isTestnet ? MYCOIN_TESTNET.minterAddress : MYCOIN.minterAddress });
});
