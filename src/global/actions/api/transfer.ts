import type { ApiCheckTransactionDraftResult, ApiSubmitMultiTransferResult } from '../../../api/chains/ton/types';
import type { ApiSubmitTransferOptions, ApiSubmitTransferResult } from '../../../api/methods/types';
import { type ApiDappTransfer, ApiTransactionDraftError, type ApiTransactionError } from '../../../api/types';
import { TransferState } from '../../types';

import { IS_CAPACITOR, NFT_BATCH_SIZE } from '../../../config';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/capacitor';
import { callActionInNative } from '../../../util/multitab';
import { IS_DELEGATING_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { ApiHardwareBlindSigningNotEnabled, ApiUserRejectsError } from '../../../api/errors';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearCurrentTransfer,
  clearIsPinAccepted,
  preserveMaxTransferAmount,
  setIsPinAccepted,
  updateAccountState,
  updateCurrentTransfer,
  updateCurrentTransferByCheckResult,
  updateCurrentTransferLoading,
} from '../../reducers';
import { selectAccountState, selectToken, selectTokenAddress } from '../../selectors';

addActionHandler('submitTransferInitial', async (global, actions, payload) => {
  if (IS_DELEGATING_BOTTOM_SHEET) {
    callActionInNative('submitTransferInitial', payload);
    return;
  }

  const {
    tokenSlug,
    toAddress,
    amount,
    comment,
    shouldEncrypt,
    nftAddresses,
    withDiesel,
    stateInit,
    isGaslessWithStars,
    binPayload,
  } = payload;

  setGlobal(updateCurrentTransferLoading(global, true));

  const { tokenAddress, chain } = selectToken(global, tokenSlug);
  let result: ApiCheckTransactionDraftResult | undefined;

  if (nftAddresses?.length) {
    result = await callApi('checkNftTransferDraft', {
      accountId: global.currentAccountId!,
      nftAddresses,
      toAddress,
      comment,
    });
  } else {
    result = await callApi('checkTransactionDraft', chain, {
      accountId: global.currentAccountId!,
      tokenAddress,
      toAddress,
      amount,
      data: binPayload ?? comment,
      shouldEncrypt,
      stateInit,
      isBase64Data: Boolean(binPayload),
      isGaslessWithStars,
    });
  }

  global = getGlobal();
  global = updateCurrentTransferLoading(global, false);

  if (result) {
    global = updateCurrentTransferByCheckResult(global, result);
  }

  if (!result || 'error' in result) {
    setGlobal(global);

    if (result?.error === ApiTransactionDraftError.InsufficientBalance && !nftAddresses?.length) {
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
    chain,
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
    tokenSlug, toAddress, comment, shouldEncrypt, binPayload, stateInit, isGaslessWithStars,
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
    isGaslessWithStars,
  });

  global = getGlobal();

  if (tokenSlug !== global.currentTransfer.tokenSlug) {
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
});

addActionHandler('fetchNftFee', async (global, actions, payload) => {
  const { toAddress, nftAddresses, comment } = payload;

  global = updateCurrentTransfer(global, { isLoading: true, error: undefined });
  setGlobal(global);

  const result = await callApi('checkNftTransferDraft', {
    accountId: global.currentAccountId!,
    nftAddresses,
    toAddress,
    comment,
  });

  global = getGlobal();
  global = updateCurrentTransfer(global, { isLoading: false });

  if (result?.fee) {
    global = updateCurrentTransfer(global, { fee: result.fee });
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

addActionHandler('submitTransferPassword', async (global, actions, { password }) => {
  const {
    resolvedAddress,
    comment,
    amount,
    promiseId,
    tokenSlug,
    fee,
    shouldEncrypt,
    binPayload,
    nfts,
    withDiesel,
    diesel,
    stateInit,
    isGaslessWithStars,
  } = global.currentTransfer;

  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateCurrentTransfer(getGlobal(), { error: 'Wrong password, please try again.' }));

    return;
  }

  global = getGlobal();
  global = updateCurrentTransfer(getGlobal(), {
    isLoading: true,
    error: undefined,
  });
  if (IS_CAPACITOR) {
    global = setIsPinAccepted(global);
  }
  setGlobal(global);

  if (IS_CAPACITOR) {
    await vibrateOnSuccess(true);
  }

  if (promiseId) {
    if (IS_CAPACITOR) {
      global = getGlobal();
      global = setIsPinAccepted(global);
      setGlobal(global);
    }

    void callApi('confirmDappRequest', promiseId, password);
    return;
  }

  let result: ApiSubmitTransferResult | ApiSubmitMultiTransferResult | undefined;

  if (nfts?.length) {
    const chunks = [];
    for (let i = 0; i < nfts.length; i += NFT_BATCH_SIZE) {
      chunks.push(nfts.slice(i, i + NFT_BATCH_SIZE));
    }

    for (const chunk of chunks) {
      const addresses = chunk.map(({ address }) => address);
      const batchResult = await callApi(
        'submitNftTransfers',
        global.currentAccountId!,
        password,
        addresses,
        resolvedAddress!,
        comment,
        chunk,
        fee,
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
      fee,
      shouldEncrypt,
      isBase64Data: Boolean(binPayload),
      withDiesel,
      dieselAmount: diesel?.amount.token,
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
    if (IS_CAPACITOR) {
      global = getGlobal();
      global = clearIsPinAccepted(global);
      setGlobal(global);
      void vibrateOnError();
    }
    actions.showError({ error: result?.error });
  } else if (IS_CAPACITOR) {
    void vibrateOnSuccess();
  }
});

addActionHandler('submitTransferHardware', async (global, actions) => {
  const {
    toAddress,
    resolvedAddress,
    comment,
    amount,
    promiseId,
    tokenSlug,
    fee,
    rawPayload,
    parsedPayload,
    stateInit,
    nfts,
  } = global.currentTransfer;

  const accountId = global.currentAccountId!;

  setGlobal(updateCurrentTransfer(getGlobal(), {
    isLoading: true,
    error: undefined,
    state: TransferState.ConfirmHardware,
  }));

  const ledgerApi = await import('../../../util/ledger');

  if (promiseId) {
    const message: ApiDappTransfer = {
      toAddress: toAddress!,
      amount: amount!,
      rawPayload,
      payload: parsedPayload,
      stateInit,
    };

    try {
      const signedMessage = await ledgerApi.signLedgerTransactions(accountId, [message]);
      void callApi('confirmDappRequest', promiseId, signedMessage);
    } catch (err) {
      if (err instanceof ApiUserRejectsError) {
        setGlobal(updateCurrentTransfer(getGlobal(), {
          isLoading: false,
          error: 'Canceled by the user',
        }));
      } else {
        void callApi('cancelDappRequest', promiseId, 'Unknown error.');
      }
    }
    return;
  }

  let result: string | { error: ApiTransactionError } | undefined;
  let error: string | undefined;

  if (nfts?.length) {
    for (const nft of nfts) {
      const currentResult = await ledgerApi.submitLedgerNftTransfer({
        accountId: global.currentAccountId!,
        nftAddress: nft.address,
        password: '',
        toAddress: resolvedAddress!,
        comment,
        nft,
        fee,
      });

      global = getGlobal();
      global = updateCurrentTransfer(global, {
        sentNftsCount: (global.currentTransfer.sentNftsCount || 0) + 1,
      });
      setGlobal(global);
      result = currentResult;
    }
  } else {
    const tokenAddress = selectTokenAddress(global, tokenSlug);
    const options = {
      accountId: global.currentAccountId!,
      password: '',
      toAddress: resolvedAddress!,
      amount: amount!,
      comment,
      tokenAddress,
      fee,
    };

    try {
      result = await ledgerApi.submitLedgerTransfer(options, tokenSlug);
    } catch (err: any) {
      if (err instanceof ApiHardwareBlindSigningNotEnabled) {
        error = '$hardware_blind_sign_not_enabled';
      }
    }
  }

  if (!error && result === undefined) {
    error = 'Declined';
  } else if (typeof result === 'object' && 'error' in result) {
    actions.showError({
      error: result.error,
    });
  }

  setGlobal(updateCurrentTransfer(getGlobal(), {
    isLoading: false,
    error,
  }));
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

  if (IS_CAPACITOR) {
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
