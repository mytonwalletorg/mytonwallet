import type { ApiDappTransaction, ApiToken } from '../../../api/types';
import type { UserToken } from '../../types';
import { ApiTransactionDraftError } from '../../../api/types';
import { TransferState } from '../../types';

import {
  buildCollectionByKey, findLast, mapValues, unique,
} from '../../../util/iteratees';
import { pause } from '../../../util/schedulers';
import { callApi } from '../../../api';
import { ApiUserRejectsError } from '../../../api/errors';
import {
  bigStrToHuman, getIsSwapId, getIsTxIdLocal, humanToBigStr,
} from '../../helpers';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';
import {
  clearCurrentTransfer,
  updateAccountState,
  updateActivitiesIsHistoryEndReached,
  updateActivitiesIsLoading,
  updateCurrentAccountState,
  updateCurrentSignature,
  updateCurrentTransfer,
  updateSendingLoading,
  updateSettings,
} from '../../reducers';
import {
  selectAccount, selectAccountSettings, selectAccountState, selectCurrentAccountState, selectLastTxIds,
} from '../../selectors';

const IMPORT_TOKEN_PAUSE = 250;

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

addActionHandler('setTransferAmount', (global, actions, { amount }) => {
  setGlobal(
    updateCurrentTransfer(global, {
      amount,
    }),
  );
});

addActionHandler('setTransferToAddress', (global, actions, { toAddress }) => {
  setGlobal(
    updateCurrentTransfer(global, {
      toAddress,
    }),
  );
});

addActionHandler('setTransferComment', (global, actions, { comment }) => {
  setGlobal(
    updateCurrentTransfer(global, {
      comment,
    }),
  );
});

addActionHandler('setTransferShouldEncrypt', (global, actions, { shouldEncrypt }) => {
  setGlobal(
    updateCurrentTransfer(global, {
      shouldEncrypt,
    }),
  );
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

  if (!result || 'error' in result) {
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
      actions.showError({ error: result?.error });
    }

    return;
  }

  setGlobal(updateCurrentTransfer(global, {
    state: TransferState.Confirm,
    error: undefined,
    toAddress,
    resolvedAddress: result.resolvedAddress,
    normalizedAddress: result.normalizedAddress,
    amount,
    comment,
    shouldEncrypt,
    fee: result.fee,
    toAddressName: result.addressName,
    tokenSlug,
    isToNewAddress: result.isToAddressNew,
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
    resolvedAddress,
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
    toAddress: resolvedAddress!,
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
    resolvedAddress,
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

  const ledgerApi = await import('../../../util/ledger');

  if (promiseId) {
    const message: ApiDappTransaction = {
      toAddress: toAddress!,
      amount: humanToBigStr(amount!, decimals),
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
        void callApi('cancelDappRequest', promiseId, 'Unknown error');
      }
    }
    return;
  }

  const options = {
    accountId: global.currentAccountId!,
    password: '',
    slug: tokenSlug!,
    toAddress: resolvedAddress!,
    amount: humanToBigStr(amount!, decimals),
    comment,
    fee,
  };

  const result = await ledgerApi.submitLedgerTransfer(options);

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
  const { promiseId, tokenSlug } = global.currentTransfer;

  if (promiseId) {
    void callApi('cancelDappRequest', promiseId, 'Canceled by the user');
  }

  global = clearCurrentTransfer(global);
  global = updateCurrentTransfer(global, { tokenSlug });

  setGlobal(global);
});

addActionHandler('fetchTokenTransactions', async (global, actions, payload) => {
  const { limit } = payload || {};
  const slug = payload.slug;

  global = updateActivitiesIsLoading(global, true);
  setGlobal(global);

  let { idsBySlug } = selectCurrentAccountState(global)?.activities || {};
  let tokenIds = (idsBySlug && idsBySlug[slug]) || [];

  const offsetId = findLast(tokenIds, (id) => !getIsTxIdLocal(id) && !getIsSwapId(id));

  const result = await callApi('fetchTokenActivitySlice', global.currentAccountId!, slug, offsetId, limit);
  global = getGlobal();
  global = updateActivitiesIsLoading(global, false);

  if (!result || !result.length) {
    global = updateActivitiesIsHistoryEndReached(global, true);
    setGlobal(global);
    return;
  }

  const newById = buildCollectionByKey(result, 'id');
  const newOrderedIds = Object.keys(newById);
  const currentActivities = selectCurrentAccountState(global)?.activities;

  idsBySlug = currentActivities?.idsBySlug || {};
  tokenIds = unique(idsBySlug[slug] || []).concat(newOrderedIds);

  global = updateCurrentAccountState(global, {
    activities: {
      ...currentActivities,
      byId: { ...(currentActivities?.byId || {}), ...newById },
      idsBySlug: { ...idsBySlug, [slug]: tokenIds },
    },
  });

  setGlobal(global);
});

addActionHandler('fetchAllTransactions', async (global, actions, payload) => {
  const { limit } = payload || {};

  global = updateActivitiesIsLoading(global, true);
  setGlobal(global);

  const accountId = global.currentAccountId!;
  const lastTxIds = selectLastTxIds(global, accountId);

  const result = await callApi('fetchAllActivitySlice', global.currentAccountId!, lastTxIds, limit);
  global = getGlobal();
  global = updateActivitiesIsLoading(global, false);

  if (!result || !result.length) {
    global = updateActivitiesIsHistoryEndReached(global, true);
    setGlobal(global);
    return;
  }

  const newById = buildCollectionByKey(result, 'id');
  const currentActivities = selectCurrentAccountState(global)?.activities;
  let idsBySlug = { ...currentActivities?.idsBySlug };

  idsBySlug = result.reduce((acc, activity) => {
    const { id, slug } = activity;
    acc[slug] = (acc[slug] || []).concat([id]);
    return acc;
  }, idsBySlug);

  idsBySlug = mapValues(idsBySlug, (txIds) => unique(txIds));

  global = updateCurrentAccountState(global, {
    activities: {
      ...currentActivities,
      byId: { ...(currentActivities?.byId || {}), ...newById },
      idsBySlug,
    },
  });

  setGlobal(global);
});

addActionHandler('resetIsHistoryEndReached', (global) => {
  global = updateActivitiesIsHistoryEndReached(global, false);
  setGlobal(global);
});

addActionHandler('setIsBackupRequired', (global, actions, { isMnemonicChecked }) => {
  const { isBackupRequired } = selectCurrentAccountState(global);

  setGlobal(updateCurrentAccountState(global, {
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

addActionHandler('addToken', (global, actions, { token }) => {
  const accountId = global.currentAccountId!;
  const { balances } = selectAccountState(global, accountId) || {};
  const accountSettings = selectAccountSettings(global, accountId) ?? {};

  if (balances?.bySlug[token.slug]) {
    return;
  }

  const apiToken: ApiToken = {
    name: token.name,
    symbol: token.symbol,
    slug: token.slug,
    decimals: token.decimals,
    image: token.image,
    keywords: token.keywords,
    quote: {
      price: token.price ?? 0,
      percentChange1h: 0,
      percentChange24h: token.change24h ?? 0,
      percentChange7d: token.change7d ?? 0,
      percentChange30d: token.change30d ?? 0,
      history24h: token.history24h ?? [],
      history7d: token.history7d ?? [],
      history30d: token.history30d ?? [],
    },
  };

  global = updateAccountState(global, accountId, {
    balances: {
      ...balances,
      bySlug: {
        ...balances?.bySlug,
        [apiToken.slug]: '0',
      },
    },
  });

  global = updateSettings(global, {
    byAccountId: {
      ...global.settings.byAccountId,
      [accountId]: {
        ...accountSettings,
        orderedSlugs: [
          ...accountSettings.orderedSlugs ?? [],
          apiToken.slug,
        ],
      },
    },
  });

  setGlobal({
    ...global,
    tokenInfo: {
      ...global.tokenInfo,
      bySlug: {
        ...global.tokenInfo.bySlug,
        [apiToken.slug]: apiToken,
      },
    },
  });

  actions.toggleDisabledToken({ slug: apiToken.slug });
});

addActionHandler('importToken', async (global, actions, { address }) => {
  setGlobal(
    updateSettings(global, {
      importToken: {
        isLoading: true,
        token: undefined,
      },
    }),
  );

  const baseToken = await callApi('importToken', global.currentAccountId!, address);
  await pause(IMPORT_TOKEN_PAUSE);

  if (!baseToken) {
    global = getGlobal();
    setGlobal(
      updateSettings(global, {
        importToken: {
          isLoading: false,
          token: undefined,
        },
      }),
    );
    return;
  }

  const {
    slug, symbol, name, image, decimals, keywords,
  } = baseToken;
  const amount = bigStrToHuman('0', decimals);

  const token: UserToken = {
    symbol,
    slug,
    amount,
    name,
    image,
    decimals,
    price: 0,
    change24h: 0,
    change7d: 0,
    change30d: 0,
    keywords,
  };

  global = getGlobal();
  setGlobal(
    updateSettings(global, {
      importToken: {
        isLoading: false,
        token,
      },
    }),
  );
});

addActionHandler('resetImportToken', (global) => {
  setGlobal(
    updateSettings(global, {
      importToken: {
        isLoading: false,
        token: undefined,
      },
    }),
  );
});

addActionHandler('verifyHardwareAddress', async (global) => {
  const accountId = global.currentAccountId!;

  const ledgerApi = await import('../../../util/ledger');

  if (!(await ledgerApi.reconnectLedger())) {
    getActions().showError({ error: '$ledger_not_ready' });
    return;
  }

  try {
    await ledgerApi.verifyAddress(accountId);
  } catch (err) {
    getActions().showError({ error: err as string });
  }
});

addActionHandler('setActiveContentTabIndex', (global, actions, { index }) => {
  global = updateCurrentAccountState(global, {
    activeContentTabIndex: index,
  });
  setGlobal(global);
});
