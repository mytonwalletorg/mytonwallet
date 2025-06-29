import type {
  ApiActivity,
  ApiSwapAsset,
  ApiToken,
  ApiTokenWithPrice,
} from '../../../api/types';

import { getIsIdSuitableForFetchingTimestamp } from '../../../util/activities';
import { compareActivities } from '../../../util/compareActivities';
import {
  buildCollectionByKey, extractKey, findLast, unique,
} from '../../../util/iteratees';
import { getIsTransactionWithPoisoning } from '../../../util/poisoningHash';
import { onTickEnd, pause } from '../../../util/schedulers';
import { buildUserToken } from '../../../util/tokens';
import { callApi } from '../../../api';
import { getIsTinyOrScamTransaction } from '../../helpers';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  changeBalance,
  updateAccountState,
  updateActivitiesIsHistoryEndReached,
  updateActivitiesIsLoading,
  updateCurrentAccountSettings,
  updateCurrentAccountState,
  updateCurrentSignature,
  updateSettings,
} from '../../reducers';
import { updateTokenInfo } from '../../reducers/tokens';
import {
  selectAccountState,
  selectAccountTxTokenSlugs,
  selectCurrentAccountSettings,
  selectCurrentAccountState,
  selectLastMainTxTimestamp,
  selectToken,
} from '../../selectors';

const IMPORT_TOKEN_PAUSE = 250;

addActionHandler('fetchTokenTransactions', async (global, actions, { limit, slug, shouldLoadWithBudget }) => {
  global = updateActivitiesIsLoading(global, true);
  setGlobal(global);

  const accountId = global.currentAccountId!;

  let { idsBySlug = {}, byId = {} } = selectAccountState(global, accountId)?.activities || {};
  let shouldFetchMore = true;
  let fetchedActivities: ApiActivity[] = [];
  let tokenIds = idsBySlug[slug] || [];
  const toTxId = findLast(tokenIds, (id) => getIsIdSuitableForFetchingTimestamp(id) && Boolean(byId[id]));
  let toTimestamp = toTxId ? byId[toTxId].timestamp : undefined;
  const { chain } = selectToken(global, slug);

  while (shouldFetchMore) {
    const result = await callApi('fetchActivitySlice', accountId, chain, slug, toTimestamp, limit);

    global = getGlobal();

    if (!result || 'error' in result) {
      break;
    }

    if (!result.length) {
      global = updateActivitiesIsHistoryEndReached(global, true, slug);
      break;
    }

    const { areTinyTransfersHidden } = global.settings;

    const filteredResult = result.filter((tx) => {
      const shouldHide = tx.kind === 'transaction'
        && (
          getIsTransactionWithPoisoning(tx)
          || (areTinyTransfersHidden && getIsTinyOrScamTransaction(tx))
        );

      return !shouldHide;
    });

    fetchedActivities = fetchedActivities.concat(result);
    shouldFetchMore = filteredResult.length < limit && fetchedActivities.length < limit;

    tokenIds = unique(tokenIds.concat(filteredResult.map((tx) => tx.id)));
    toTimestamp = result[result.length - 1].timestamp;
  }

  fetchedActivities.sort(compareActivities);

  global = updateActivitiesIsLoading(global, false);

  const newById = buildCollectionByKey(fetchedActivities, 'id');
  const newOrderedIds = Object.keys(newById);
  const currentActivities = selectAccountState(global, accountId)?.activities;
  byId = { ...(currentActivities?.byId || {}), ...newById };

  idsBySlug = currentActivities?.idsBySlug || {};
  tokenIds = unique((idsBySlug[slug] || []).concat(newOrderedIds));

  tokenIds.sort((a, b) => compareActivities(byId[a], byId[b]));

  global = updateAccountState(global, accountId, {
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

  const tronTokenSlugs = selectAccountTxTokenSlugs(global, accountId, 'tron') ?? [];
  let toTimestamp = selectLastMainTxTimestamp(global, accountId)!;
  let shouldFetchMore = true;
  let fetchedActivities: ApiActivity[] = [];

  while (shouldFetchMore) {
    const result = await callApi(
      'fetchAllActivitySlice',
      accountId,
      limit,
      toTimestamp,
      tronTokenSlugs,
    );

    global = getGlobal();

    if (!result || 'error' in result) {
      break;
    }

    if (!result.length) {
      global = updateActivitiesIsHistoryEndReached(global, true);
      break;
    }

    const { areTinyTransfersHidden } = global.settings;

    const filteredResult = result.filter((tx) => {
      const shouldHide = tx.kind === 'transaction'
        && (
          getIsTransactionWithPoisoning(tx)
          || (areTinyTransfersHidden && getIsTinyOrScamTransaction(tx))
        );

      return !shouldHide;
    });

    fetchedActivities = fetchedActivities.concat(result);
    shouldFetchMore = filteredResult.length < limit && fetchedActivities.length < limit;
    toTimestamp = result[result.length - 1].timestamp;
  }

  global = updateActivitiesIsLoading(global, false);

  const newById = buildCollectionByKey(fetchedActivities, 'id');
  const currentActivities = selectAccountState(global, accountId)?.activities;
  const byId = { ...(currentActivities?.byId || {}), ...newById };

  fetchedActivities.sort(compareActivities);

  const idsMain = unique((currentActivities?.idsMain ?? []).concat(extractKey(fetchedActivities, 'id')));

  global = updateAccountState(global, accountId, {
    activities: {
      ...currentActivities,
      byId,
      idsMain,
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

  await callApi('confirmDappRequest', promiseId, password);

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
  if (!global.tokenInfo?.bySlug?.[token.slug]) {
    global = updateTokenInfo(global, {
      [token.slug]: {
        name: token.name,
        symbol: token.symbol,
        slug: token.slug,
        decimals: token.decimals,
        chain: token.chain,
        image: token.image,
        keywords: token.keywords,
        price: token.price ?? 0,
        priceUsd: token.priceUsd ?? 0,
        percentChange24h: token.change24h ?? 0,
      },
    });
  }

  const { balances } = selectCurrentAccountState(global) ?? {};

  if (!balances?.bySlug[token.slug]) {
    global = updateCurrentAccountState(global, {
      balances: {
        ...balances,
        bySlug: {
          ...balances?.bySlug,
          [token.slug]: 0n,
        },
      },
    });
  }

  const settings = selectCurrentAccountSettings(global);
  global = updateCurrentAccountSettings(global, {
    importedSlugs: [...settings?.importedSlugs ?? [], token.slug],
  });

  const accountSettings = selectCurrentAccountSettings(global) ?? {};
  global = updateCurrentAccountSettings(global, {
    ...accountSettings,
    orderedSlugs: [...accountSettings.orderedSlugs ?? [], token.slug],
    alwaysShownSlugs: unique([...accountSettings.alwaysShownSlugs ?? [], token.slug]),
    alwaysHiddenSlugs: accountSettings.alwaysHiddenSlugs?.filter((slug) => slug !== token.slug),
    deletedSlugs: accountSettings.deletedSlugs?.filter((slug) => slug !== token.slug),
  });

  return global;
});

addActionHandler('importToken', async (global, actions, { address }) => {
  const { currentAccountId } = global;
  global = updateSettings(global, {
    importToken: {
      isLoading: true,
      token: undefined,
    },
  });
  setGlobal(global);

  const slug = (await callApi('buildTokenSlug', 'ton', address))!;
  global = getGlobal();

  let token: ApiTokenWithPrice | ApiToken | undefined = global.tokenInfo.bySlug?.[slug];

  if (!token) {
    token = await callApi('fetchToken', global.currentAccountId!, address);
    await pause(IMPORT_TOKEN_PAUSE);

    global = getGlobal();
    if (!token) {
      global = updateSettings(global, {
        importToken: {
          isLoading: false,
          token: undefined,
        },
      });
      setGlobal(global);
      return;
    } else {
      const apiToken: ApiTokenWithPrice = {
        ...token,
        price: 0,
        priceUsd: 0,
        percentChange24h: 0,
      };
      global = updateTokenInfo(global, { [apiToken.slug]: apiToken });
      setGlobal(global);
    }
  }

  const balances = selectAccountState(global, currentAccountId!)?.balances?.bySlug ?? {};
  const shouldUpdateBalance = !(token.slug in balances);

  const userToken = buildUserToken(token);

  global = getGlobal();
  global = updateSettings(global, {
    importToken: {
      isLoading: false,
      token: userToken,
    },
  });
  if (shouldUpdateBalance) {
    global = changeBalance(global, global.currentAccountId!, token.slug, 0n);
  }
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

addActionHandler('verifyHardwareAddress', async (global, actions) => {
  const accountId = global.currentAccountId!;

  const ledgerApi = await import('../../../util/ledger');

  if (!(await ledgerApi.reconnectLedger())) {
    actions.showError({ error: '$ledger_not_ready' });
    return;
  }

  try {
    actions.showDialog({ title: 'Ledger', message: '$ledger_verify_address_on_device' });
    await ledgerApi.verifyAddress(accountId);
  } catch (err) {
    actions.showError({ error: err as string });
  }
});

addActionHandler('setActiveContentTab', (global, actions, { tab }) => {
  return updateCurrentAccountState(global, {
    activeContentTab: tab,
  });
});

addActionHandler('addSwapToken', (global, actions, { token }) => {
  const isAlreadyExist = token.slug in global.swapTokenInfo.bySlug;

  if (isAlreadyExist) {
    return;
  }

  const apiSwapAsset: ApiSwapAsset = {
    name: token.name,
    symbol: token.symbol,
    chain: token.chain,
    slug: token.slug,
    decimals: token.decimals,
    image: token.image,
    tokenAddress: token.tokenAddress,
    keywords: token.keywords,
    isPopular: false,
    price: 0,
    priceUsd: 0,
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

addActionHandler('apiUpdateWalletVersions', (global, actions, params) => {
  const { accountId, versions, currentVersion } = params;
  global = {
    ...global,
    walletVersions: {
      ...global.walletVersions,
      currentVersion,
      byId: {
        ...global.walletVersions?.byId,
        [accountId]: versions,
      },
    },
  };
  setGlobal(global);
});
