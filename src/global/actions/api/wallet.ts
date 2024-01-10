import type {
  ApiActivity, ApiBaseToken, ApiDappTransaction, ApiSwapAsset, ApiToken,
} from '../../../api/types';
import type { UserSwapToken, UserToken } from '../../types';
import { ApiTransactionDraftError } from '../../../api/types';
import { ActiveTab, TransferState } from '../../types';

import { IS_CAPACITOR, TON_TOKEN_SLUG } from '../../../config';
import { vibrateOnError, vibrateOnSuccess } from '../../../util/capacitor';
import { compareActivities } from '../../../util/compareActivities';
import {
  buildCollectionByKey, findLast, mapValues, pick, unique,
} from '../../../util/iteratees';
import { onTickEnd, pause } from '../../../util/schedulers';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../../util/windowEnvironment';
import { callApi } from '../../../api';
import { ApiUserRejectsError } from '../../../api/errors';
import {
  getIsSwapId, getIsTinyTransaction, getIsTxIdLocal, humanToBigStr,
} from '../../helpers';
import {
  addActionHandler, getActions, getGlobal, setGlobal,
} from '../../index';
import {
  clearCurrentTransfer,
  clearIsPinAccepted,
  setIsPinAccepted,
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
  selectAccount,
  selectAccountSettings,
  selectAccountState,
  selectCurrentAccountState,
  selectLastTxIds,
} from '../../selectors';

import { callActionInMain } from '../../../hooks/useDelegatedBottomSheet';

const IMPORT_TOKEN_PAUSE = 250;

addActionHandler('startTransfer', (global, actions, payload) => {
  const isOpen = global.currentTransfer.state !== TransferState.None;
  if (IS_DELEGATED_BOTTOM_SHEET && !isOpen) {
    callActionInMain('startTransfer', payload);
    return;
  }

  const { isPortrait, ...rest } = payload ?? {};

  setGlobal(updateCurrentTransfer(global, {
    state: isPortrait ? TransferState.Initial : TransferState.None,
    error: undefined,
    ...rest,
  }));

  if (!isPortrait) {
    actions.setLandscapeActionsActiveTabIndex({ index: ActiveTab.Transfer });
  }
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

addActionHandler('submitTransferPassword', async (global, actions, { password }) => {
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
        void callApi('cancelDappRequest', promiseId, 'Unknown error.');
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

addActionHandler('fetchTokenTransactions', async (global, actions, { limit, slug, shouldLoadWithBudget }) => {
  global = updateActivitiesIsLoading(global, true);
  setGlobal(global);

  let { idsBySlug } = selectCurrentAccountState(global)?.activities || {};
  let shouldFetchMore = true;
  let fetchedActivities: ApiActivity[] = [];
  let tokenIds = (idsBySlug && idsBySlug[slug]) || [];
  let offsetId = findLast(tokenIds, (id) => !getIsTxIdLocal(id) && !getIsSwapId(id));

  while (shouldFetchMore) {
    const result = await callApi('fetchTokenActivitySlice', global.currentAccountId!, slug, offsetId, limit);

    global = getGlobal();

    if (!result || 'error' in result) {
      break;
    }

    if (!result.length) {
      global = updateActivitiesIsHistoryEndReached(global, true, slug);
      break;
    }

    const filteredResult = global.settings.areTinyTransfersHidden
      ? result.filter((tx) => tx.kind === 'transaction' && !getIsTinyTransaction(tx))
      : result;

    fetchedActivities = fetchedActivities.concat(result);
    shouldFetchMore = filteredResult.length < limit && fetchedActivities.length < limit;

    tokenIds = unique(tokenIds.concat(filteredResult.map((tx) => tx.id)));
    offsetId = findLast(tokenIds, (id) => !getIsTxIdLocal(id) && !getIsSwapId(id));
  }

  fetchedActivities.sort((a, b) => compareActivities(a, b));

  global = updateActivitiesIsLoading(global, false);

  const newById = buildCollectionByKey(fetchedActivities, 'id');
  const newOrderedIds = Object.keys(newById);
  const currentActivities = selectCurrentAccountState(global)?.activities;
  const byId = { ...(currentActivities?.byId || {}), ...newById };

  idsBySlug = currentActivities?.idsBySlug || {};
  tokenIds = unique((idsBySlug[slug] || []).concat(newOrderedIds));

  tokenIds.sort((a, b) => compareActivities(byId[a], byId[b]));

  global = updateCurrentAccountState(global, {
    activities: {
      ...currentActivities,
      byId,
      idsBySlug: { ...idsBySlug, [slug]: tokenIds },
    },
  });

  setGlobal(global);

  if (shouldLoadWithBudget) {
    onTickEnd(() => {
      actions.fetchTokenTransactions({ limit, slug });
    });
  }
});

addActionHandler('fetchAllTransactions', async (global, actions, { limit, shouldLoadWithBudget }) => {
  global = updateActivitiesIsLoading(global, true);
  setGlobal(global);

  const accountId = global.currentAccountId!;

  let lastTxIds = selectLastTxIds(global, accountId);
  let shouldFetchMore = true;
  let fetchedActivities: ApiActivity[] = [];

  while (shouldFetchMore) {
    const result = await callApi('fetchAllActivitySlice', accountId, lastTxIds, limit);

    global = getGlobal();

    if (!result || 'error' in result) {
      break;
    }

    if (!result.length) {
      global = updateActivitiesIsHistoryEndReached(global, true);
      break;
    }

    const filteredResult = global.settings.areTinyTransfersHidden
      ? result.filter((tx) => tx.kind === 'transaction' && !getIsTinyTransaction(tx))
      : result;

    fetchedActivities = fetchedActivities.concat(result);
    shouldFetchMore = filteredResult.length < limit && fetchedActivities.length < limit;

    lastTxIds = selectLastTxIds(global, accountId);
  }

  global = updateActivitiesIsLoading(global, false);

  const newById = buildCollectionByKey(fetchedActivities, 'id');
  const currentActivities = selectCurrentAccountState(global)?.activities;
  const byId = { ...(currentActivities?.byId || {}), ...newById };
  let idsBySlug = { ...currentActivities?.idsBySlug };

  fetchedActivities = fetchedActivities.sort((a, b) => compareActivities(a, b));

  idsBySlug = fetchedActivities.reduce((acc, activity) => {
    if (activity.kind === 'swap') {
      const { id, from, to } = activity;
      acc[from] = (acc[from] || []).concat([id]);
      acc[to] = (acc[to] || []).concat([id]);
    } else {
      const { id, slug } = activity;
      acc[slug] = (acc[slug] || []).concat([id]);
    }
    return acc;
  }, idsBySlug);

  idsBySlug = mapValues(idsBySlug, (txIds) => unique(txIds));
  idsBySlug[TON_TOKEN_SLUG]?.sort((a, b) => compareActivities(byId[a], byId[b]));

  global = updateCurrentAccountState(global, {
    activities: {
      ...currentActivities,
      byId,
      idsBySlug,
    },
  });

  setGlobal(global);

  if (shouldLoadWithBudget) {
    onTickEnd(() => {
      actions.fetchAllTransactions({ limit });
    });
  }
});

addActionHandler('resetIsHistoryEndReached', (global, actions, payload) => {
  global = updateActivitiesIsHistoryEndReached(global, false, payload?.slug);
  setGlobal(global);
});

addActionHandler('setIsBackupRequired', (global, actions, { isMnemonicChecked }) => {
  const { isBackupRequired } = selectCurrentAccountState(global) ?? {};

  setGlobal(updateCurrentAccountState(global, {
    isBackupRequired: isMnemonicChecked ? undefined : isBackupRequired,
  }));
});

addActionHandler('submitSignature', async (global, actions, payload) => {
  const { password } = payload;
  const { promiseId } = global.currentSignature!;

  if (!(await callApi('verifyPassword', password))) {
    setGlobal(updateCurrentSignature(getGlobal(), { error: 'Wrong password, please try again.' }));

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
  const { areTokensWithNoPriceHidden, areTokensWithNoBalanceHidden } = global.settings;
  const { balances } = selectAccountState(global, accountId) || {};
  const accountSettings = selectAccountSettings(global, accountId) ?? {};
  const { orderedSlugs = [], exceptionSlugs = [], deletedSlugs } = accountSettings;

  if (balances?.bySlug[token.slug]) {
    return;
  }

  const existingToken = global.tokenInfo?.bySlug?.[token.slug];
  const apiToken: ApiToken = existingToken ?? {
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

  const exceptionSlugsCopy = exceptionSlugs.slice();
  const deletedSlugsCopy = deletedSlugs?.filter((slug) => slug !== token.slug);

  if ((areTokensWithNoBalanceHidden && token.amount === 0) || (areTokensWithNoPriceHidden && token.price === 0)) {
    exceptionSlugsCopy.push(token.slug);
  }

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
          ...orderedSlugs ?? [],
          apiToken.slug,
        ],
        exceptionSlugs: exceptionSlugsCopy,
        deletedSlugs: deletedSlugsCopy,
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
});

addActionHandler('importToken', async (global, actions, { address, isSwap }) => {
  global = updateSettings(global, {
    importToken: {
      isLoading: true,
      token: undefined,
    },
  });
  setGlobal(global);

  const slug = (await callApi('buildTokenSlug', address))!;
  global = getGlobal();

  let token: ApiToken | ApiBaseToken | undefined = global.tokenInfo.bySlug?.[slug!];

  if (!token) {
    token = await callApi('fetchToken', global.currentAccountId!, address);
    await pause(IMPORT_TOKEN_PAUSE);

    if (!token) {
      global = getGlobal();
      global = updateSettings(global, {
        importToken: {
          isLoading: false,
          token: undefined,
        },
      });
      setGlobal(global);
      return;
    }
  }

  const userToken: UserToken | UserSwapToken = {
    ...pick(token, [
      'symbol',
      'slug',
      'name',
      'image',
      'decimals',
      'keywords',
    ]),
    amount: 0,
    price: 0,
    change24h: 0,
    change7d: 0,
    change30d: 0,
    ...(isSwap && {
      blockchain: 'ton',
      contract: token.minterAddress,
    }),
  };

  global = getGlobal();
  global = updateSettings(global, {
    importToken: {
      isLoading: false,
      token: userToken,
    },
  });
  setGlobal(global);
});

addActionHandler('resetImportToken', (global) => {
  global = updateSettings(global, {
    importToken: {
      isLoading: false,
      token: undefined,
    },
  });
  setGlobal(global);
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

addActionHandler('setActiveContentTab', (global, actions, { tab }) => {
  global = updateCurrentAccountState(global, {
    activeContentTab: tab,
  });
  setGlobal(global);
});

addActionHandler('addSwapToken', (global, actions, { token }) => {
  const isAlreadyExist = token.slug in global.swapTokenInfo.bySlug;

  if (isAlreadyExist) {
    return;
  }

  const apiSwapAsset: ApiSwapAsset = {
    name: token.name,
    symbol: token.symbol,
    blockchain: token.blockchain,
    slug: token.slug,
    decimals: token.decimals,
    image: token.image,
    contract: token.contract,
    keywords: token.keywords,
    isPopular: false,
  };

  setGlobal({
    ...global,
    swapTokenInfo: {
      ...global.swapTokenInfo,
      bySlug: {
        ...global.swapTokenInfo.bySlug,
        [apiSwapAsset.slug]: apiSwapAsset,
      },
    },
  });
});
