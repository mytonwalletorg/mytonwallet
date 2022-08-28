import { addActionHandler, getGlobal, setGlobal } from '../../index';

import { TransferState } from '../../types';

import { callApi } from '../../../api';
import {
  updateBackupWalletModal, updateCurrentTransfer, updateSendingLoading,
  updateCurrentSignature, clearCurrentTransfer, updateTransactionsIsLoading,
} from '../../reducers';
import { humanToBigStr } from '../../helpers';
import { buildCollectionByKey } from '../../../util/iteratees';
import { ApiTransactionDraftError } from '../../../api/types';
import { TRANSACTIONS_SLICE } from '../../../config';

addActionHandler('startTransfer', (global, actions, payload) => {
  const { toAddress, amount, comment } = payload || {};

  setGlobal(updateCurrentTransfer(global, {
    state: TransferState.Initial,
    error: undefined,
    toAddress,
    amount,
    comment,
  }));
});

addActionHandler('setTransferScreen', (global, actions, payload) => {
  const { state } = payload;

  setGlobal(updateCurrentTransfer(global, { state }));
});

addActionHandler('submitTransferInitial', async (global, actions, payload) => {
  const { toAddress, amount, comment } = payload;

  setGlobal(updateSendingLoading(global, true));

  const result = await callApi('checkTransactionDraft', toAddress, humanToBigStr(amount), comment);

  global = getGlobal();
  global = updateSendingLoading(global, false);

  if (!result || result.error) {
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
    fee: result.fee,
  }));
});

addActionHandler('fetchFee', async (global, actions, payload) => {
  const {
    toAddress, amount, comment,
  } = payload;

  const result = await callApi('checkTransactionDraft', toAddress, humanToBigStr(amount), comment);

  if (result?.fee) {
    setGlobal(updateCurrentTransfer(getGlobal(), { fee: result.fee }));
  }
});

addActionHandler('submitTransferConfirm', (global) => {
  setGlobal(updateCurrentTransfer(global, { state: TransferState.Password }));
});

addActionHandler('submitTransferPassword', async (global, actions, payload) => {
  const { password } = payload;
  const {
    toAddress,
    comment,
    amount,
    promiseId,
  } = global.currentTransfer;

  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateCurrentTransfer(getGlobal(), { error: 'Wrong password, please try again' }));

    return;
  }

  setGlobal(updateCurrentTransfer(getGlobal(), {
    state: TransferState.InProgress,
    error: undefined,
  }));

  if (promiseId) {
    void callApi('confirmDappRequest', promiseId, password);

    return;
  }

  const result = await callApi('submitTransfer', password, toAddress!, humanToBigStr(amount!), comment);
  if (!result) {
    actions.showDialog({
      message: 'Transfer was unsuccessful. Try again later',
    });
  }
});

addActionHandler('cleanTransferError', (global) => {
  setGlobal(updateCurrentTransfer(global, { error: undefined }));
});

addActionHandler('cancelTransfer', (global) => {
  const { promiseId } = global.currentTransfer;

  if (promiseId) {
    void callApi('cancelDappRequest', promiseId, 'Canceled by the user');
  }

  setGlobal(clearCurrentTransfer(global));
});

addActionHandler('fetchTransactions', async (global, actions, payload) => {
  const { offsetId, limit = TRANSACTIONS_SLICE } = payload || {};
  global = updateTransactionsIsLoading(global, true);
  setGlobal(global);

  const result = await callApi('fetchTransactionSlice', offsetId, limit);
  global = getGlobal();
  global = updateTransactionsIsLoading(global, false);

  if (!result) {
    setGlobal(global);
    return;
  }

  const transactions = buildCollectionByKey(result, 'txId');
  const orderedTxIds = Object.keys(transactions);

  setGlobal({
    ...global,
    transactions: {
      ...global.transactions,
      byTxId: { ...(global.transactions?.byTxId || {}), ...transactions },
      orderedTxIds: (global.transactions?.orderedTxIds || []).concat(orderedTxIds),
      nextOffsetTxId: orderedTxIds.length && orderedTxIds.length >= TRANSACTIONS_SLICE
        ? orderedTxIds[orderedTxIds.length - 1]
        : undefined,
    },
  });
});

addActionHandler('fetchNfts', async () => {
  // TODO limit, offset
  const result = await callApi('fetchNfts');
  if (!result) {
    return;
  }

  const nfts = buildCollectionByKey(result, 'address');

  setGlobal({
    ...getGlobal(),
    nfts: {
      byAddress: nfts,
      orderedAddresses: Object.keys(nfts),
    },
  });
});

addActionHandler('startBackupWallet', async (global, actions, payload) => {
  const { password } = payload;

  setGlobal(updateBackupWalletModal(global, {
    isLoading: true,
    error: undefined,
  }));

  const mnemonic = await callApi('getMnemonic', password);

  global = getGlobal();
  setGlobal(updateBackupWalletModal(global, {
    isLoading: false,
    error: !mnemonic ? 'Wrong password, please try again.' : undefined,
    mnemonic,
  }));
});

addActionHandler('cleanBackupWalletError', (global) => {
  setGlobal(updateBackupWalletModal(global, { error: undefined }));
});

addActionHandler('closeBackupWallet', (global, actions, payload) => {
  const { isMnemonicChecked } = payload || {};

  if (isMnemonicChecked) {
    global = {
      ...global, isBackupRequired: undefined,
    };
  }

  setGlobal({
    ...global,
    backupWallet: {},
  });
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

addActionHandler('cleanSignatureError', (global) => {
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
