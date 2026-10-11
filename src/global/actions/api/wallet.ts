import type { ApiAnyDisplayError, ApiToken, ApiTokenWithPrice } from '../../../api/types';

import { unique } from '../../../util/iteratees';
import { pause } from '../../../util/schedulers';
import { buildUserToken } from '../../../util/tokens';
import { callApi } from '../../../api';
import { withEnclaveSessionRelease } from '../../helpers/enclave';
import { errorCodeToMessage } from '../../helpers/errors';
import { isErrorTransferResult } from '../../helpers/transfer';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import {
  changeBalance,
  updateCurrentAccountSettings,
  updateCurrentAccountState,
  updateCurrentSignature,
  updateSettings,
} from '../../reducers';
import { updateTokenInfo } from '../../reducers/tokens';
import {
  selectAccountState,
  selectCurrentAccountId,
  selectCurrentAccountSettings,
  selectCurrentAccountState,
} from '../../selectors';

const IMPORT_TOKEN_PAUSE = 250;

addActionHandler('setIsBackupRequired', (global, actions, { isMnemonicChecked }) => {
  const { isBackupRequired } = selectCurrentAccountState(global) ?? {};

  setGlobal(updateCurrentAccountState(global, {
    isBackupRequired: isMnemonicChecked ? undefined : isBackupRequired,
  }));
});

addActionHandler('submitSignature', withEnclaveSessionRelease(async (global, actions, payload) => {
  const { enclaveToken } = payload;
  const { promiseId } = global.currentSignature!;

  await callApi('confirmDappRequest', promiseId, enclaveToken);

  setGlobal(updateCurrentSignature(getGlobal(), { isSigned: true }));
}));

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
    alwaysShownSlugs: unique([...accountSettings.alwaysShownSlugs ?? [], token.slug]),
    alwaysHiddenSlugs: accountSettings.alwaysHiddenSlugs?.filter((slug) => slug !== token.slug),
    deletedSlugs: accountSettings.deletedSlugs?.filter((slug) => slug !== token.slug),
  });

  if (token.tokenAddress) {
    void callApi('importToken', selectCurrentAccountId(global)!, token.chain, token.tokenAddress);
  }

  return global;
});

addActionHandler('importToken', async (global, actions, { chain, address }) => {
  const accountId = selectCurrentAccountId(global)!;

  global = updateSettings(global, {
    importToken: {
      isLoading: true,
      token: undefined,
      error: undefined,
    },
  });
  setGlobal(global);

  const slug = (await callApi('buildTokenSlug', chain, address))!;
  global = getGlobal();

  let token: ApiTokenWithPrice | ApiToken | { error: ApiAnyDisplayError } | undefined = global.tokenInfo.bySlug?.[slug];

  if (!token) {
    token = await callApi('fetchToken', accountId, chain, address);
    await pause(IMPORT_TOKEN_PAUSE);
    global = getGlobal();

    if (isErrorTransferResult(token)) {
      global = updateSettings(global, {
        importToken: {
          isLoading: false,
          token: undefined,
          error: errorCodeToMessage(token?.error),
        },
      });
      setGlobal(global);
      return;
    } else {
      const apiToken: ApiTokenWithPrice = {
        ...token,
        priceUsd: 0,
        percentChange24h: 0,
      };
      global = updateTokenInfo(global, { [apiToken.slug]: apiToken });
      setGlobal(global);
    }
  }

  const balances = selectAccountState(global, accountId)?.balances?.bySlug ?? {};
  const shouldUpdateBalance = !(token.slug in balances);

  const userToken = buildUserToken(token);

  global = getGlobal();
  global = updateSettings(global, {
    importToken: {
      isLoading: false,
      token: userToken,
      error: undefined,
    },
  });
  if (shouldUpdateBalance) {
    global = changeBalance(global, accountId, token.slug, 0n);
  }
  setGlobal(global);
});

addActionHandler('resetImportToken', (global) => {
  global = updateSettings(global, {
    importToken: {
      isLoading: false,
      token: undefined,
      error: undefined,
    },
  });
  setGlobal(global);
});

addActionHandler('setActiveContentTab', (global, actions, { tab }) => {
  return updateCurrentAccountState(global, {
    activeContentTab: tab,
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
