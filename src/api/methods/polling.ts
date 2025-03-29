import type {
  ApiAccountAny,
  ApiAccountConfig,
  ApiAccountWithMnemonic,
  ApiCountryCode,
  ApiSwapAsset,
  ApiTokenPrice,
  OnApiUpdate,
} from '../types';

import { IS_AIR_APP, TONCOIN } from '../../config';
import { areDeepEqual } from '../../util/areDeepEqual';
import { buildCollectionByKey, omit } from '../../util/iteratees';
import { logDebugError } from '../../util/logs';
import { pauseOrFocus } from '../../util/pauseOrFocus';
import chains from '../chains';
import { tryUpdateKnownAddresses } from '../common/addresses';
import { callBackendGet, callBackendPost } from '../common/backend';
import { getPricesCache } from '../common/cache';
import { isAlive, isUpdaterAlive } from '../common/helpers';
import { getBaseCurrency } from '../common/prices';
import { addTokens, loadTokensCache } from '../common/tokens';
import { MINUTE } from '../constants';
import { resolveDataPreloadPromise } from './preload';
import { tryUpdateStakingCommonData } from './staking';
import { swapGetAssets } from './swap';

const SEC = 1000;
const BACKEND_INTERVAL = 30 * SEC;
const LONG_BACKEND_INTERVAL = 60 * SEC;
const INCORRECT_TIME_DIFF = 30 * SEC;

const ACCOUNT_CONFIG_INTERVAL = 60 * SEC;
const ACCOUNT_CONFIG_INTERVAL_INTERVAL_WHEN_NOT_FOCUSED = 10 * MINUTE;

const { ton, tron } = chains;

let onUpdate: OnApiUpdate;

export async function initPolling(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;

  await tryUpdatePrices();

  void Promise.allSettled([
    tryUpdateKnownAddresses(),
    tryUpdateTokens(_onUpdate, true),
    tryUpdateSwapTokens(_onUpdate),
    tryUpdateStakingCommonData(),
  ]).then(() => resolveDataPreloadPromise());

  void tryUpdateConfig(_onUpdate);

  void setupBackendPolling();
  void setupLongBackendPolling();
  if (IS_AIR_APP) {
    void ton.setupInactiveAccountsBalancePolling(onUpdate);
    void tron.setupInactiveAccountsBalancePolling(onUpdate);
  }
}

export async function setupBackendPolling() {
  const localOnUpdate = onUpdate;

  while (isUpdaterAlive(localOnUpdate)) {
    await pauseOrFocus(BACKEND_INTERVAL);
    if (!isUpdaterAlive(localOnUpdate)) return;

    try {
      await tryUpdatePrices(localOnUpdate);
      await tryUpdateTokens(localOnUpdate);
    } catch (err) {
      logDebugError('setupBackendPolling', err);
    }
  }
}

export async function setupLongBackendPolling() {
  const localOnUpdate = onUpdate;

  while (isUpdaterAlive(localOnUpdate)) {
    await pauseOrFocus(LONG_BACKEND_INTERVAL);

    await Promise.all([
      tryUpdateKnownAddresses(),
      tryUpdateStakingCommonData(),
      tryUpdateConfig(localOnUpdate),
      tryUpdateSwapTokens(localOnUpdate),
    ]);
  }
}

export async function tryUpdatePrices(localOnUpdate?: OnApiUpdate) {
  if (!localOnUpdate) {
    localOnUpdate = onUpdate;
  }

  try {
    const baseCurrency = await getBaseCurrency();
    const pricesData = await callBackendGet<Record<string, ApiTokenPrice>>('/prices/current', {
      base: baseCurrency,
    });

    if (!isUpdaterAlive(localOnUpdate)) return;

    const prices = getPricesCache();
    prices.bySlug = buildCollectionByKey(Object.values(pricesData), 'slug');
    prices.baseCurrency = baseCurrency;
  } catch (err) {
    logDebugError('tryUpdatePrices', err);
  }
}

export async function tryUpdateTokens(localOnUpdate?: OnApiUpdate, isFirstRun?: boolean) {
  if (!localOnUpdate) {
    localOnUpdate = onUpdate;
  }

  if (isFirstRun) {
    await loadTokensCache();
  }

  try {
    let tokens = await callBackendGet<any[]>('/known-tokens');
    tokens = tokens.map((token) => ({
      ...omit(token, ['minterAddress']),
      tokenAddress: token.minterAddress,
      chain: 'ton',
    }));

    if (!isUpdaterAlive(localOnUpdate)) return;

    await addTokens(tokens, onUpdate, true);
  } catch (err) {
    logDebugError('tryUpdateTokens', err);
  }
}

export async function tryUpdateSwapTokens(localOnUpdate?: OnApiUpdate) {
  if (!localOnUpdate) {
    localOnUpdate = onUpdate;
  }

  try {
    const assets = await swapGetAssets();

    if (!isUpdaterAlive(localOnUpdate)) return;

    const prices = getPricesCache();
    const tokens = assets.reduce((acc: Record<string, ApiSwapAsset>, asset) => {
      acc[asset.slug] = {
        // Fix legacy variable names
        ...omit(asset as any, ['blockchain']) as ApiSwapAsset,
        chain: 'blockchain' in asset ? asset.blockchain as string : asset.chain,
        tokenAddress: 'contract' in asset && asset.contract !== TONCOIN.symbol
          ? asset.contract as string
          : asset.tokenAddress,
        price: prices.bySlug[asset.slug]?.price ?? 0,
      };
      return acc;
    }, {});

    onUpdate({
      type: 'updateSwapTokens',
      tokens,
    });
  } catch (err) {
    logDebugError('tryUpdateSwapTokens', err);
  }
}

export async function tryUpdateConfig(localOnUpdate: OnApiUpdate) {
  try {
    const {
      isLimited,
      isCopyStorageEnabled = false,
      supportAccountsCount = 1,
      now: serverUtc,
      country: countryCode,
      isUpdateRequired: isAppUpdateRequired,
    } = await callBackendGet<{
      isLimited: boolean;
      isCopyStorageEnabled?: boolean;
      supportAccountsCount?: number;
      now: number;
      country: ApiCountryCode;
      isUpdateRequired: boolean;
    }>('/utils/get-config');

    if (!isUpdaterAlive(localOnUpdate)) return;

    onUpdate({
      type: 'updateConfig',
      isLimited,
      isCopyStorageEnabled,
      supportAccountsCount,
      countryCode,
      isAppUpdateRequired,
    });

    const localUtc = (new Date()).getTime();
    if (Math.abs(serverUtc - localUtc) > INCORRECT_TIME_DIFF) {
      onUpdate({
        type: 'incorrectTime',
      });
    }
  } catch (err) {
    logDebugError('tryUpdateRegion', err);
  }
}

export async function setupAccountConfigPolling(accountId: string, account: ApiAccountAny) {
  let lastResult: ApiAccountConfig | undefined;

  const partialAccount = omit(account as ApiAccountWithMnemonic, ['mnemonicEncrypted']);

  while (isAlive(onUpdate, accountId)) {
    try {
      const accountConfig = await callBackendPost<ApiAccountConfig>('/account-config', partialAccount);

      if (!isAlive(onUpdate, accountId)) return;

      if (!areDeepEqual(accountConfig, lastResult)) {
        lastResult = accountConfig;
        onUpdate({
          type: 'updateAccountConfig',
          accountId,
          accountConfig,
        });
      }
    } catch (err) {
      logDebugError('setupBackendAccountPolling', err);
    }

    await pauseOrFocus(ACCOUNT_CONFIG_INTERVAL, ACCOUNT_CONFIG_INTERVAL_INTERVAL_WHEN_NOT_FOCUSED);
  }
}
