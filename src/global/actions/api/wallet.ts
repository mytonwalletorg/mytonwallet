import { ApiTransactionDraftError } from '../../../api/types';
import { TransferState } from '../../types';
import type { ApiDappTransaction } from '../../../api/types';

import {
  buildCollectionByKey, findLast, mapValues, unique,
} from '../../../util/iteratees';
import { signLedgerTransactions, submitLedgerTransfer } from '../../../util/ledger';
import { callApi } from '../../../api';
import { ApiUserRejectsError } from '../../../api/errors';
import { getIsTxIdLocal, humanToBigStr } from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  clearCurrentTransfer,
  updateCurrentAccountsState,
  updateCurrentAccountState,
  updateCurrentSignature,
  updateCurrentTransfer,
  updateSendingLoading,
  updateTransactionsIsLoading,
} from '../../reducers';
import { selectAccount, selectCurrentAccountState, selectLastTxIds } from '../../selectors';

addActionHandler('startTransfer', (global, actions, payload) => {
  const {
    tokenSlug, toAddress, amount, comment,
  } = payload || {};

  setGlobal(updateCurrentTransfer(global, {
    state: TransferState.Initial,
    error: undefined,
    toAddress,
    amount,
    comment,
    tokenSlug,
  }));
});

addActionHandler('changeTransferToken', (global, actions, { tokenSlug }) => {
  setGlobal(updateCurrentTransfer(global, { tokenSlug }));
});

addActionHandler('setTransferScreen', (global, actions, payload) => {
  const { state } = payload;

  setGlobal(updateCurrentTransfer(global, { state }));
});

addActionHandler('submitTransferInitial', async (global, actions, payload) => {
  const {
    tokenSlug, toAddress, amount, comment, shouldEncrypt,
  } = payload;
  const { decimals } = global.tokenInfo!.bySlug[tokenSlug];

  setGlobal(updateSendingLoading(global, true));

  const result = await callApi(
    'checkTransactionDraft',
    global.currentAccountId!,
    tokenSlug,
    toAddress,
    humanToBigStr(amount, decimals),
    comment,
    shouldEncrypt,
  );

  global = getGlobal();
  global = updateSendingLoading(global, false);

  if (!result || result.error) {
    if (result?.addressName) {
      global = updateCurrentTransfer(global, { toAddressName: result.addressName });
    }
    if (result?.fee) {
      global = updateCurrentTransfer(global, { fee: result.fee });
    }

    setGlobal(global);

    if (result?.error === ApiTransactionDraftError.InsufficientBalance) {
      actions.showDialog({ message: 'The network fee has slightly changed, try sending again.' });
    } else {
      actions.showTxDraftError({ error: result?.error });
    }

    return;
  }

  setGlobal(updateCurrentTransfer(global, {
    state: TransferState.Confirm,
    error: undefined,
    toAddress,
    amount,
    comment,
    shouldEncrypt,
    fee: result.fee,
    toAddressName: result.addressName,
    tokenSlug,
  }));
});

addActionHandler('fetchFee', async (global, actions, payload) => {
  const {
    tokenSlug, toAddress, amount, comment, shouldEncrypt,
  } = payload;
  const { decimals } = global.tokenInfo!.bySlug[tokenSlug];

  const result = await callApi(
    'checkTransactionDraft',
    global.currentAccountId!,
    tokenSlug,
    toAddress,
    humanToBigStr(amount, decimals),
    comment,
    shouldEncrypt,
  );

  if (result?.fee) {
    setGlobal(updateCurrentTransfer(getGlobal(), { fee: result.fee }));
  }
});

addActionHandler('submitTransferConfirm', (global, actions) => {
  const accountId = global.currentAccountId!;
  const account = selectAccount(global, accountId)!;

  if (account.isHardware) {
    actions.resetHardwareWalletConnect();
    global = updateCurrentTransfer(getGlobal(), { state: TransferState.ConnectHardware });
  } else {
    global = updateCurrentTransfer(global, { state: TransferState.Password });
  }

  setGlobal(global);
});

addActionHandler('submitTransferPassword', async (global, actions, payload) => {
  const { password } = payload;
  const {
    toAddress,
    comment,
    amount,
    promiseId,
    tokenSlug,
    fee,
    shouldEncrypt,
  } = global.currentTransfer;
  const { decimals } = global.tokenInfo!.bySlug[tokenSlug!];

  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateCurrentTransfer(getGlobal(), { error: 'Wrong password, please try again' }));

    return;
  }

  setGlobal(updateCurrentTransfer(getGlobal(), {
    isLoading: true,
    error: undefined,
  }));

  if (promiseId) {
    void callApi('confirmDappRequest', promiseId, password);
    return;
  }

  const options = {
    accountId: global.currentAccountId!,
    password,
    slug: tokenSlug!,
    toAddress: toAddress!,
    amount: humanToBigStr(amount!, decimals),
    comment,
    fee,
    shouldEncrypt,
  };

  const result = await callApi('submitTransfer', options);

  setGlobal(updateCurrentTransfer(getGlobal(), {
    isLoading: false,
  }));

  if (!result || 'error' in result) {
    actions.showError({ error: result?.error });
  }
});

addActionHandler('submitTransferHardware', async (global) => {
  const {
    toAddress,
    comment,
    amount,
    promiseId,
    tokenSlug,
    fee,
    rawPayload,
    parsedPayload,
    stateInit,
  } = global.currentTransfer;
  const { decimals } = global.tokenInfo!.bySlug[tokenSlug!];

  const accountId = global.currentAccountId!;

  setGlobal(updateCurrentTransfer(getGlobal(), {
    isLoading: true,
    error: undefined,
    state: TransferState.ConfirmHardware,
  }));

  if (promiseId) {
    const message: ApiDappTransaction = {
      toAddress: toAddress!,
      amount: humanToBigStr(amount!, decimals),
      rawPayload,
      payload: parsedPayload,
      stateInit,
    };

    try {
      const signedMessage = await signLedgerTransactions(accountId, [message]);
      void callApi('confirmDappRequest', promiseId, signedMessage);
    } catch (err) {
      if (err instanceof ApiUserRejectsError) {
        setGlobal(updateCurrentTransfer(getGlobal(), {
          isLoading: false,
          error: 'Canceled by the user',
        }));
      } else {
        void callApi('cancelDappRequest', promiseId, 'Unknown error');
      }
    }
    return;
  }

  const options = {
    accountId: global.currentAccountId!,
    password: '',
    slug: tokenSlug!,
    toAddress: toAddress!,
    amount: humanToBigStr(amount!, decimals),
    comment,
    fee,
  };

  const result = await submitLedgerTransfer(options);

  const error = result === undefined ? 'Transfer error' : undefined;

  setGlobal(updateCurrentTransfer(getGlobal(), {
    isLoading: false,
    error,
  }));
});

addActionHandler('clearTransferError', (global) => {
  setGlobal(updateCurrentTransfer(global, { error: undefined }));
});

addActionHandler('cancelTransfer', (global) => {
  const { promiseId } = global.currentTransfer;

  if (promiseId) {
    void callApi('cancelDappRequest', promiseId, 'Canceled by the user');
  }

  setGlobal(clearCurrentTransfer(global));
});

addActionHandler('fetchTokenTransactions', async (global, actions, payload) => {
  const { limit } = payload || {};
  const slug = payload.slug;

  global = updateTransactionsIsLoading(global, true);
  setGlobal(global);

  let { txIdsBySlug } = selectCurrentAccountState(global)?.transactions || {};
  let tokenTxIds = (txIdsBySlug && txIdsBySlug[slug]) || [];

  const offsetId = findLast(tokenTxIds, (txId) => !getIsTxIdLocal(txId));

  const result = await callApi('fetchTokenTransactionSlice', global.currentAccountId!, slug, offsetId, limit);
  global = getGlobal();
  global = updateTransactionsIsLoading(global, false);

  if (!result) {
    setGlobal(global);
    return;
  }

  const newTxsById = buildCollectionByKey(result, 'txId');
  const newOrderedTxIds = Object.keys(newTxsById);
  const currentTxs = selectCurrentAccountState(global)?.transactions;

  txIdsBySlug = currentTxs?.txIdsBySlug || {};
  tokenTxIds = unique(txIdsBySlug[slug] || []).concat(newOrderedTxIds);

  global = updateCurrentAccountState(global, {
    transactions: {
      ...currentTxs,
      byTxId: { ...(currentTxs?.byTxId || {}), ...newTxsById },
      txIdsBySlug: { ...txIdsBySlug, [slug]: tokenTxIds },
    },
  });

  setGlobal(global);
});

addActionHandler('fetchAllTransactions', async (global, actions, payload) => {
  const { limit } = payload || {};

  global = updateTransactionsIsLoading(global, true);
  setGlobal(global);

  const accountId = global.currentAccountId!;
  const lastTxIds = selectLastTxIds(global, accountId);

  const result = await callApi('fetchAllTransactionSlice', global.currentAccountId!, lastTxIds, limit);
  global = getGlobal();
  global = updateTransactionsIsLoading(global, false);

  if (!result || !result.length) {
    setGlobal(global);
    return;
  }

  const newTxsById = buildCollectionByKey(result, 'txId');
  const currentTxs = selectCurrentAccountState(global)?.transactions;
  let txIdsBySlug = { ...currentTxs?.txIdsBySlug };

  txIdsBySlug = result.reduce((acc, { slug, txId }) => {
    acc[slug] = (acc[slug] || []).concat([txId]);
    return acc;
  }, txIdsBySlug);

  txIdsBySlug = mapValues(txIdsBySlug, (txIds) => unique(txIds));

  global = updateCurrentAccountState(global, {
    transactions: {
      ...currentTxs,
      byTxId: { ...(currentTxs?.byTxId || {}), ...newTxsById },
      txIdsBySlug,
    },
  });

  setGlobal(global);
});

addActionHandler('fetchNfts', async (global) => {
  // TODO limit, offset
  const result = await callApi('fetchNfts', global.currentAccountId!);
  if (!result) {
    return;
  }

  const nfts = buildCollectionByKey(result, 'address');
  global = getGlobal();
  global = updateCurrentAccountState(global, {
    nfts: {
      byAddress: nfts,
      orderedAddresses: Object.keys(nfts),
    },
  });
  setGlobal(global);
});

addActionHandler('setIsBackupRequired', (global, actions, { isMnemonicChecked }) => {
  const { isBackupRequired } = selectCurrentAccountState(global);

  setGlobal(updateCurrentAccountsState(global, {
    isBackupRequired: isMnemonicChecked ? undefined : isBackupRequired,
  }));
});

addActionHandler('submitSignature', async (global, actions, payload) => {
  const { password } = payload;
  const { promiseId } = global.currentSignature!;

  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateCurrentSignature(getGlobal(), { error: 'Wrong password, please try again' }));

    return;
  }

  await callApi('confirmDappRequest', promiseId, password!);

  setGlobal(updateCurrentSignature(getGlobal(), { isSigned: true }));
});

addActionHandler('clearSignatureError', (global) => {
  setGlobal(updateCurrentSignature(global, { error: undefined }));
});

addActionHandler('cancelSignature', (global) => {
  const { promiseId } = global.currentSignature || {};

  if (promiseId) {
    void callApi('cancelDappRequest', promiseId, 'Canceled by the user');
  }

  setGlobal({
    ...global,
    currentSignature: undefined,
  });
});
