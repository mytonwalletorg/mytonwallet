import React from '../../../lib/teact/teact';

import type { ApiCheckTransactionDraftResult, ApiSubmitMultiTransferResult } from '../../../api/chains/ton/types';
import type { ApiSubmitTransferOptions, ApiSubmitTransferResult } from '../../../api/methods/types';
import { ApiTransactionDraftError } from '../../../api/types';
import { TransferState } from '../../types';

import { HELP_CENTER_SEED_SCAM_URL, NFT_BATCH_SIZE } from '../../../config';
import { bigintDivideToNumber } from '../../../util/bigint';
import { getDoesUsePinPad } from '../../../util/biometrics';
import { explainApiTransferFee, getDieselTokenAmount } from '../../../util/fee/transferFee';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/haptics';
import { getTranslation } from '../../../util/langProvider';
import { callActionInNative } from '../../../util/multitab';
import { shouldShowSeedPhraseScamWarning } from '../../../util/scamDetection';
import { IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearCurrentTransfer,
  clearIsPinAccepted,
  preserveMaxTransferAmount,
  setIsPinAccepted,
  updateAccount,
  updateAccountState,
  updateCurrentTransfer,
  updateCurrentTransferByCheckResult,
  updateCurrentTransferLoading,
} from '../../reducers';
import {
  selectAccountState,
  selectCurrentAccount,
  selectCurrentAccountTokens,
  selectCurrentNetwork,
  selectIsHardwareAccount,
  selectToken,
  selectTokenAddress,
} from '../../selectors';

addActionHandler('submitTransferInitial', async (global, actions, payload) => {
  if (IS_DELEGATING_BOTTOM_SHEET) {
    callActionInNative('submitTransferInitial', payload);
    return;
  }

  const {
    tokenSlug,
    toAddress,
    comment,
    shouldEncrypt,
    nfts,
    withDiesel,
    stateInit,
    isGaslessWithStars,
    binPayload,
  } = payload;
  let { amount } = payload;

  setGlobal(updateCurrentTransferLoading(global, true));

  const isNftTransfer = Boolean(nfts?.length);
  let result: ApiCheckTransactionDraftResult | undefined;

  if (isNftTransfer) {
    // This assignment is needed only for the amount checking hack in the 'newLocalActivity' handler in
    // `src/global/actions/apiUpdates/activities.ts` to work.
    amount = 0n;

    result = await callApi('checkNftTransferDraft', {
      accountId: global.currentAccountId!,
      nfts,
      toAddress,
      comment,
    });
  } else {
    const { tokenAddress, chain } = selectToken(global, tokenSlug);
    result = await callApi('checkTransactionDraft', chain, {
      accountId: global.currentAccountId!,
      tokenAddress,
      toAddress,
      amount,
      data: binPayload ?? comment,
      shouldEncrypt,
      stateInit,
      isBase64Data: Boolean(binPayload),
      allowGasless: true,
    });
  }

  global = getGlobal();
  global = updateCurrentTransferLoading(global, false);

  if (result) {
    global = updateCurrentTransferByCheckResult(global, result);
  }

  if (!result || 'error' in result) {
    setGlobal(global);

    if (result?.error === ApiTransactionDraftError.InsufficientBalance && !isNftTransfer) {
      actions.showDialog({ message: 'The network fee has slightly changed, try sending again.' });
    } else {
      actions.showError({ error: result?.error });
    }

    return;
  }

  setGlobal(updateCurrentTransfer(global, {
    state: TransferState.Confirm,
    error: undefined,
    toAddress,
    resolvedAddress: result.resolvedAddress,
    amount,
    comment,
    shouldEncrypt,
    tokenSlug,
    isToNewAddress: result.isToAddressNew,
    withDiesel,
    isGaslessWithStars,
  }));
});

addActionHandler('fetchTransferFee', async (global, actions, payload) => {
  global = updateCurrentTransfer(global, { isLoading: true, error: undefined });
  setGlobal(global);

  const {
    tokenSlug, toAddress, comment, shouldEncrypt, binPayload, stateInit,
  } = payload;

  const { tokenAddress, chain } = selectToken(global, tokenSlug);

  const result = await callApi('checkTransactionDraft', chain, {
    accountId: global.currentAccountId!,
    toAddress,
    data: binPayload ?? comment,
    tokenAddress,
    shouldEncrypt,
    isBase64Data: Boolean(binPayload),
    stateInit,
    allowGasless: true,
  });

  global = getGlobal();

  if (tokenSlug !== global.currentTransfer.tokenSlug || global.currentTransfer.nfts?.length) {
    // For cases when the user switches the token before the result arrives
    return;
  }

  global = updateCurrentTransfer(global, { isLoading: false });
  if (result) {
    global = updateCurrentTransferByCheckResult(global, result);
  }
  setGlobal(global);

  if (result?.error && result.error !== ApiTransactionDraftError.InsufficientBalance) {
    actions.showError({ error: result.error });
  }

  if (result?.error === ApiTransactionDraftError.InsufficientBalance) {
    const currentAccount = selectCurrentAccount(global)!;
    const accountTokens = selectCurrentAccountTokens(global)!;
    const { chain } = selectToken(global, tokenSlug);

    if (shouldShowSeedPhraseScamWarning(currentAccount, accountTokens, chain)) {
      const helpCenterLink = (
        HELP_CENTER_SEED_SCAM_URL[global.settings.langCode as keyof typeof HELP_CENTER_SEED_SCAM_URL]
        || HELP_CENTER_SEED_SCAM_URL.en
      );

      actions.showDialog({
        title: 'Warning!',
        message: getTranslation('$seed_phrase_scam_warning', {
          help_center_link: (
            <a href={helpCenterLink} target="_blank" rel="noreferrer">
              <b>{getTranslation('$help_center_prepositional')}</b>
            </a>
          ),
        }),
        noBackdropClose: true,
      });

      // Clear `importedAt` so the warning only shows once
      global = getGlobal();
      global = updateAccount(global, global.currentAccountId!, { importedAt: undefined });
      setGlobal(global);
    }
  }
});

addActionHandler('fetchNftFee', async (global, actions, payload) => {
  const { toAddress, nfts, comment } = payload;

  global = updateCurrentTransfer(global, { isLoading: true, error: undefined });
  setGlobal(global);

  const result = await callApi('checkNftTransferDraft', {
    accountId: global.currentAccountId!,
    nfts,
    toAddress,
    comment,
  });

  global = getGlobal();

  if (!global.currentTransfer.nfts?.length) {
    // For cases when the user switches the token transfer mode before the result arrives
    return;
  }

  global = updateCurrentTransfer(global, { isLoading: false });
  if (result) {
    global = updateCurrentTransferByCheckResult(global, result);
  }
  setGlobal(global);

  if (result?.error) {
    actions.showError({
      error: result?.error === ApiTransactionDraftError.InsufficientBalance
        ? 'Insufficient TON for fee.'
        : result.error,
    });
  }
});

addActionHandler('submitTransfer', async (global, actions, { password = '' } = {}) => {
  const {
    resolvedAddress,
    comment,
    amount,
    promiseId,
    tokenSlug,
    shouldEncrypt,
    binPayload,
    nfts,
    withDiesel,
    diesel,
    stateInit,
    isGaslessWithStars,
  } = global.currentTransfer;
  const isHardware = selectIsHardwareAccount(global);

  if (!isHardware && !(await callApi('verifyPassword', password))) {
    setGlobal(updateCurrentTransfer(getGlobal(), { error: 'Wrong password, please try again.' }));

    return;
  }

  global = updateCurrentTransfer(getGlobal(), {
    isLoading: true,
    error: undefined,
    ...(isHardware && { state: TransferState.ConfirmHardware }),
  });
  setGlobal(global);

  if (!isHardware) {
    if (getDoesUsePinPad()) {
      global = setIsPinAccepted(global);
      setGlobal(global);
    }
    await vibrateOnSuccess(true);
  }

  if (promiseId) {
    await callApi('confirmDappRequest', promiseId, password);
    return;
  }

  const explainedFee = explainApiTransferFee(global.currentTransfer);
  const fullNativeFee = explainedFee.fullFee?.nativeSum;
  const realNativeFee = explainedFee.realFee?.nativeSum;

  let result: ApiSubmitTransferResult | ApiSubmitMultiTransferResult | undefined;

  if (nfts?.length) {
    const chunks = [];
    for (let i = 0; i < nfts.length; i += NFT_BATCH_SIZE) {
      chunks.push(nfts.slice(i, i + NFT_BATCH_SIZE));
    }

    for (const chunk of chunks) {
      const batchResult = await callApi(
        'submitNftTransfers',
        global.currentAccountId!,
        password,
        chunk,
        resolvedAddress!,
        comment,
        realNativeFee && bigintDivideToNumber(realNativeFee, nfts.length / chunk.length),
      );

      global = getGlobal();
      global = updateCurrentTransfer(global, {
        sentNftsCount: (global.currentTransfer.sentNftsCount || 0) + chunk.length,
      });
      setGlobal(global);
      // TODO - process all responses from the API
      result = batchResult;
    }
  } else {
    const { tokenAddress, chain } = selectToken(global, tokenSlug);

    const options: ApiSubmitTransferOptions = {
      accountId: global.currentAccountId!,
      password,
      toAddress: resolvedAddress!,
      amount: amount!,
      comment: binPayload ?? comment,
      tokenAddress,
      fee: fullNativeFee,
      realFee: realNativeFee,
      shouldEncrypt,
      isBase64Data: Boolean(binPayload),
      withDiesel,
      dieselAmount: diesel && getDieselTokenAmount(diesel),
      stateInit,
      isGaslessWithStars,
    };

    result = await callApi('submitTransfer', chain, options);
  }

  global = getGlobal();
  global = updateCurrentTransfer(global, {
    isLoading: false,
  });
  setGlobal(global);

  if (!result || 'error' in result) {
    const errorMessage = result?.error ?? 'Declined';
    if (isHardware) {
      setGlobal(updateCurrentTransfer(getGlobal(), {
        isLoading: false,
        error: errorMessage,
      }));
    } else {
      if (getDoesUsePinPad()) {
        global = getGlobal();
        global = clearIsPinAccepted(global);
        setGlobal(global);
      }
      void vibrateOnError();
      actions.showError({
        error: errorMessage,
      });
    }
  } else if (!isHardware) {
    void vibrateOnSuccess();
  }
});

addActionHandler('cancelTransfer', (global, actions, { shouldReset } = {}) => {
  const { promiseId, tokenSlug } = global.currentTransfer;

  if (shouldReset) {
    if (promiseId) {
      void callApi('cancelDappRequest', promiseId, 'Canceled by the user');
    }

    global = clearCurrentTransfer(global);
    global = updateCurrentTransfer(global, { tokenSlug });

    setGlobal(global);
    return;
  }

  if (getDoesUsePinPad()) {
    global = clearIsPinAccepted(global);
  }
  global = updateCurrentTransfer(global, { state: TransferState.None });
  setGlobal(global);
});

addActionHandler('fetchTransferDieselState', async (global, actions, { tokenSlug }) => {
  const tokenAddress = selectTokenAddress(global, tokenSlug);
  if (!tokenAddress) return;

  const diesel = await callApi('fetchEstimateDiesel', global.currentAccountId!, tokenAddress);
  if (!diesel) return;

  global = getGlobal();
  const accountState = selectAccountState(global, global.currentAccountId!);
  global = preserveMaxTransferAmount(global, updateCurrentTransfer(global, { diesel }));
  if (accountState?.isDieselAuthorizationStarted && diesel.status !== 'not-authorized') {
    global = updateAccountState(global, global.currentAccountId!, { isDieselAuthorizationStarted: undefined });
  }
  setGlobal(global);
});

addActionHandler('checkTransferAddress', async (global, actions, { address }) => {
  if (!address) {
    global = updateCurrentTransfer(global, { toAddressName: undefined, resolvedAddress: undefined });
    setGlobal(global);

    return;
  }

  const network = selectCurrentNetwork(global);
  const result = await callApi('getAddressInfo', network, address);

  global = getGlobal();
  if (!result || 'error' in result) {
    global = updateCurrentTransfer(global, { toAddressName: undefined, resolvedAddress: undefined });
  } else {
    global = updateCurrentTransfer(global, {
      toAddressName: result.addressName,
      resolvedAddress: result.resolvedAddress,
    });
  }
  setGlobal(global);
});
