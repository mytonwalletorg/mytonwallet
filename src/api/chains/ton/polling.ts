import type {
  ApiAccountAny,
  ApiActivity,
  ApiActivityTimestamps,
  ApiBalanceBySlug,
  ApiNftUpdate,
  ApiStakingState,
  ApiTonWallet,
  ApiUpdatingStatus,
  ApiVestingInfo,
  ApiWalletInfo,
  OnApiUpdate,
} from '../../types';

import {
  IS_CORE_WALLET,
  IS_STAKING_DISABLED,
  LEDGER_WALLET_VERSIONS,
  POPULAR_WALLET_VERSIONS,
  TONCOIN,
} from '../../../config';
import { parseAccountId } from '../../../util/account';
import { getActivityTokenSlugs } from '../../../util/activities';
import { areDeepEqual } from '../../../util/areDeepEqual';
import Deferred from '../../../util/Deferred';
import { compact, pick } from '../../../util/iteratees';
import { logDebugError } from '../../../util/logs';
import { createTaskQueue } from '../../../util/schedulers';
import { fetchStoredAccount, fetchStoredTonWallet, updateStoredTonWallet } from '../../common/accounts';
import { getBackendConfigCache, getStakingCommonCache } from '../../common/cache';
import { processNftUpdates, updateAccountNfts } from '../../common/nft';
import { activeWalletTiming, inactiveWalletTiming, pollingLoop, withDoubleCheck } from '../../common/polling';
import { swapReplaceCexActivities } from '../../common/swap';
import { txCallbacks } from '../../common/txCallbacks';
import { hexToBytes } from '../../common/utils';
import { WalletPolling } from '../../common/walletPolling';
import { FIRST_TRANSACTIONS_LIMIT, MINUTE, SEC } from '../../constants';
import { fetchActivitySlice } from './activities';
import { getWalletFromAddress } from './auth';
import { fetchDomains } from './domains';
import { getAccountNfts, getNftUpdates } from './nfts';
import { getBackendStakingState, getStakingStates } from './staking';
import { loadTokenBalances } from './tokens';
import { fetchVestings } from './vesting';
import { getWalletInfo, getWalletVersionInfos, isAddressInitialized } from './wallet';

type OnUpdatingStatusChange = (kind: ApiUpdatingStatus['kind'], isUpdating: boolean) => void;

const DOUBLE_CHECK_TOKENS_PAUSE = 30 * SEC;
const DOUBLE_CHECK_ACTIVITIES_PAUSE = 10 * SEC; // TODO (actions) Can it be reduced?
const TRIPLE_CHECK_ACTIVITIES_PAUSE = 20 * SEC;

const NFT_FULL_INTERVAL = MINUTE;
const NFT_FULL_INTERVAL_WHEN_NOT_FOCUSED = 5 * MINUTE;
const DOUBLE_CHECK_NFT_PAUSE = 5 * SEC;

const STAKING_INTERVAL = 5 * SEC;
const STAKING_INTERVAL_WHEN_NOT_FOCUSED = 20 * SEC;

const VERSIONS_INTERVAL = 5 * MINUTE;
const VERSIONS_INTERVAL_WHEN_NOT_FOCUSED = 15 * MINUTE;
const VESTING_INTERVAL = 10 * SEC;
const VESTING_INTERVAL_WHEN_NOT_FOCUSED = MINUTE;

const TON_DNS_INTERVAL = 15 * SEC;
const TON_DNS_INTERVAL_WHEN_NOT_FOCUSED = 2 * MINUTE;

const MAX_ACTIVITY_LOAD_CONCURRENCY = 10;

const inactiveUpdateConcurrencyLimiter = createTaskQueue();

export function setupActivePolling(
  accountId: string,
  account: ApiAccountAny,
  onUpdate: OnApiUpdate,
  onUpdatingStatusChange: OnUpdatingStatusChange,
  newestActivityTimestamps: ApiActivityTimestamps,
): NoneToVoidFunction {
  if (!('ton' in account) || !account.ton) {
    return () => {};
  }

  const balanceAndDomainPolling = setupBalanceAndDomainPolling(
    accountId,
    onUpdate,
    onUpdatingStatusChange.bind(undefined, 'balance'),
  );
  const activityPolling = setupActivityPolling(
    accountId,
    newestActivityTimestamps,
    balanceAndDomainPolling.getBalances,
    onUpdate,
    onUpdatingStatusChange.bind(undefined, 'activities'),
  );
  const nftPolling = setupNftPolling(accountId, onUpdate);
  const stopWalletVersionPolling = setupWalletVersionsPolling(accountId, onUpdate);
  const stopTonDnsPolling = setupTonDnsPolling(accountId, onUpdate);
  const stopStakingPolling = setupStakingPolling(accountId, balanceAndDomainPolling.getBalances, onUpdate);
  const stopVestingPolling = setupVestingPolling(accountId, onUpdate);

  async function update(isConfident: boolean) {
    const updateOther = () => Promise.all([
      activityPolling.update(),
      nftPolling.update(),
      checkWalletInitialization(accountId),
    ]);

    if (isConfident) {
      await Promise.all([balanceAndDomainPolling.update(), updateOther()]);
    } else {
      // Legacy (timer) polling mode
      const hasBalanceChanged = await balanceAndDomainPolling.update(true);
      if (hasBalanceChanged) {
        await updateOther();
      }
    }
  }

  const walletPolling = new WalletPolling({
    ...activeWalletTiming,
    chain: 'ton',
    network: parseAccountId(accountId).network,
    address: account.ton.address,
    onUpdate: update,
  });

  return () => {
    walletPolling.destroy();
    balanceAndDomainPolling.stop();
    activityPolling.stop();
    nftPolling.stop();
    stopWalletVersionPolling();
    stopTonDnsPolling();
    stopStakingPolling();
    stopVestingPolling();
  };
}

function setupBalanceAndDomainPolling(
  accountId: string,
  onUpdate: OnApiUpdate,
  onUpdatingStatusChange?: (isUpdating: boolean) => void,
) {
  const { network } = parseAccountId(accountId);
  let balances: ApiBalanceBySlug | undefined;
  let balancesDeferred = new Deferred();
  let lastDomain: string | false | undefined; // Undefined means unknown, false means no domain

  /**
   * `onlyIfTonBalanceChanged` makes the function check the TON balance first, and proceed only if it has changed.
   * Returns `true` if the balances have changed since the last update.
   */
  async function update(onlyIfTonBalanceChanged = false) {
    onUpdatingStatusChange?.(true);

    try {
      const wallet = await fetchStoredTonWallet(accountId);
      let tonBalance: bigint;
      let tokenBalances: ApiBalanceBySlug;

      if (onlyIfTonBalanceChanged) {
        tonBalance = await getTonBalanceAndCheckDomain(wallet.address);
        if (tonBalance === balances?.[TONCOIN.slug]) {
          return false;
        }
        tokenBalances = await updateTokenBalances.run(wallet.address);
      } else {
        [tonBalance, tokenBalances] = await Promise.all([
          getTonBalanceAndCheckDomain(wallet.address),
          updateTokenBalances.run(wallet.address),
        ]);
      }

      const hasChanged = handleNewBalances({
        [TONCOIN.slug]: tonBalance,
        ...tokenBalances,
      });

      balancesDeferred.resolve();
      return hasChanged;
    } catch (err) {
      logDebugError('setupBalanceAndDomainPolling update', err);

      // It's important to reject the deferred instead of keeping it unsettled, because otherwise the main polling cycle
      // will stuck and never retry. Creating a new deferred gives the `getBalances` callers another chance on retry.
      balancesDeferred.reject(err);
      balancesDeferred = new Deferred();
    } finally {
      onUpdatingStatusChange?.(false);
    }

    return false;
  }

  // The token balances may not be updated instantly, so checking again in several seconds
  const updateTokenBalances = withDoubleCheck(
    [DOUBLE_CHECK_TOKENS_PAUSE],
    async (attemptNumber, address: string) => {
      // In the first attempt the other nuances are handled by `update`
      if (attemptNumber === 0) {
        return loadTokenBalances(network, address, onUpdate);
      }

      try {
        const tokenBalances = await loadTokenBalances(network, address, onUpdate);

        handleNewBalances({
          ...pick(balances ?? {}, [TONCOIN.slug]),
          ...tokenBalances,
        });

        return tokenBalances;
      } catch (err) {
        logDebugError('setupBalanceAndDomainPolling updateTokenBalances', err);
        return {}; // This is just for type compliance. The returned value of 2nd+ attempts is never used.
      }
    },
  );

  async function getTonBalanceAndCheckDomain(address: string) {
    // Getting the balance and the domain go together, only because they arrive from the same endpoint
    const { balance, domain = false } = await getWalletInfo(network, address);

    if (domain !== lastDomain) {
      onUpdate({
        type: 'updateAccount',
        accountId,
        chain: 'ton',
        domain,
      });
      lastDomain = domain;
    }

    return balance;
  }

  function handleNewBalances(newBalances: ApiBalanceBySlug) {
    const hasChanged = !areDeepEqual(balances, newBalances);
    balances = newBalances;

    if (hasChanged) {
      onUpdate({
        type: 'updateBalances',
        accountId,
        chain: 'ton',
        balances,
      });
    }

    return hasChanged;
  }

  return {
    update,
    async getBalances() {
      await balancesDeferred.promise;
      return balances!;
    },
    stop: updateTokenBalances.cancel,
  };
}

function setupActivityPolling(
  accountId: string,
  newestActivityTimestamps: ApiActivityTimestamps,
  getBalances: () => Promise<ApiBalanceBySlug>,
  onUpdate: OnApiUpdate,
  onUpdatingStatusChange: (isUpdating: boolean) => void,
) {
  const newestTimestamps = compact(Object.values(newestActivityTimestamps));
  let newestActivityTimestamp = newestTimestamps.length ? Math.max(...newestTimestamps) : undefined;

  // The activity update may be delayed after the socket signal, so we wait a few seconds before the 2nd attempt.
  // We suspect that the 2nd attempt after a short delay doesn't always bring the new activities, so we check 3 times.
  const update = withDoubleCheck(
    [DOUBLE_CHECK_ACTIVITIES_PAUSE, TRIPLE_CHECK_ACTIVITIES_PAUSE],
    async () => {
      onUpdatingStatusChange(true);

      try {
        if (newestActivityTimestamp) {
          newestActivityTimestamp = await loadNewActivities(accountId, newestActivityTimestamp, onUpdate);
        } else {
          const balances = await getBalances();
          newestActivityTimestamp = await loadInitialActivities(accountId, Object.keys(balances), onUpdate);
        }
      } catch (err) {
        logDebugError('setupActivityPolling update', err);
      } finally {
        onUpdatingStatusChange(false);
      }
    },
  );

  return {
    update: update.run,
    stop: update.cancel,
  };
}

function setupNftPolling(accountId: string, onUpdate: OnApiUpdate) {
  let nftFromSec = Math.round(Date.now() / 1000);

  // The NFT updates may not become available immediately after the socket message.
  // So we check again in a few seconds.
  const updatePartial = withDoubleCheck(
    [DOUBLE_CHECK_NFT_PAUSE],
    async () => {
      try {
        const nftResult = await getNftUpdates(accountId, nftFromSec).catch(logAndRescue);

        if (nftResult) {
          let nftUpdates: ApiNftUpdate[];
          [nftFromSec, nftUpdates] = nftResult;
          void processNftUpdates(accountId, nftUpdates, onUpdate);
        }
      } catch (err) {
        logDebugError('setupNftPolling updatePartial', err);
      }
    },
  );

  const stopFullPolling = pollingLoop({
    pause: NFT_FULL_INTERVAL,
    pauseWhenNotFocused: NFT_FULL_INTERVAL_WHEN_NOT_FOCUSED,
    async poll() {
      updatePartial.cancel();

      try {
        const nfts = await getAccountNfts(accountId).catch(logAndRescue);

        if (nfts) {
          nftFromSec = Math.round(Date.now() / 1000);
          void updateAccountNfts(accountId, nfts, onUpdate);
        }
      } catch (err) {
        logDebugError('setupNftPolling updateFull', err);
      }
    },
  });

  return {
    update: updatePartial.run,
    stop() {
      updatePartial.cancel();
      stopFullPolling();
    },
  };
}

function setupStakingPolling(accountId: string, getBalances: () => Promise<ApiBalanceBySlug>, onUpdate: OnApiUpdate) {
  if (IS_STAKING_DISABLED || parseAccountId(accountId).network !== 'mainnet') {
    return () => {};
  }

  let lastStates: ApiStakingState[] | undefined;

  return pollingLoop({
    pause: STAKING_INTERVAL,
    pauseWhenNotFocused: STAKING_INTERVAL_WHEN_NOT_FOCUSED,
    async poll() {
      try {
        const [common, balances, backendState] = await Promise.all([
          getStakingCommonCache(),
          getBalances(),
          getBackendStakingState(accountId),
        ]);
        const states = await getStakingStates(accountId, common, backendState, balances);

        const { shouldUseNominators, totalProfit } = backendState;

        if (!areDeepEqual(states, lastStates)) {
          lastStates = states;
          onUpdate({
            type: 'updateStaking',
            accountId,
            states,
            totalProfit,
            shouldUseNominators,
          });
        }
      } catch (err) {
        logDebugError('setupStakingPolling', err);
      }
    },
  });
}

async function loadNewActivities(accountId: string, newestActivityTimestamp: number, onUpdate: OnApiUpdate) {
  let activities = await fetchActivitySlice(
    accountId, undefined, undefined, newestActivityTimestamp, FIRST_TRANSACTIONS_LIMIT,
  );

  if (activities.length) {
    newestActivityTimestamp = activities[0].timestamp;
  }

  activities = await swapReplaceCexActivities(accountId, activities, undefined, true);

  activities.slice().reverse().forEach((transaction) => {
    txCallbacks.runCallbacks(transaction);
  });

  onUpdate({
    type: 'newActivities',
    chain: 'ton',
    activities,
    accountId,
  });

  return newestActivityTimestamp;
}

async function loadInitialActivities(accountId: string, tokenSlugs: string[], onUpdate: OnApiUpdate) {
  const concurrencyLimiter = createTaskQueue(MAX_ACTIVITY_LOAD_CONCURRENCY);

  const bySlug: Record<string, ApiActivity[]> = {};
  let mainActivities: ApiActivity[] = [];

  let newestActivityTimestamp: number | undefined;

  const loadTokenActivity = concurrencyLimiter.wrap(async (slug: string) => {
    try {
      const tokenSlug = slug !== TONCOIN.slug ? slug : undefined;
      let activities = await fetchActivitySlice(accountId, tokenSlug, undefined, FIRST_TRANSACTIONS_LIMIT);

      activities = await swapReplaceCexActivities(accountId, activities, slug, true);

      if (slug === TONCOIN.slug && activities.length) {
        // Activities for each Jetton wallet are loaded only the first time.
        // New token activities will be loaded along with TON.
        newestActivityTimestamp = activities[0].timestamp;

        // There is no way to load TON activities without loading activities of other tokens
        mainActivities = activities;
        activities = activities.filter((activity) => getActivityTokenSlugs(activity).includes(TONCOIN.slug));
      }

      bySlug[slug] = activities;
    } catch (err) {
      // If a token history fails to load, the UI will re-request its history when the user opens its activity feed
      logDebugError('loadTokenActivity', slug, err);
    }
  });

  await Promise.allSettled(tokenSlugs.map(loadTokenActivity));

  onUpdate({
    type: 'initialActivities',
    chain: 'ton',
    accountId,
    mainActivities,
    bySlug,
  });

  return newestActivityTimestamp;
}

function logAndRescue(err: Error) {
  logDebugError('Polling error', err);

  return undefined;
}

function setupWalletVersionsPolling(accountId: string, onUpdate: OnApiUpdate) {
  const { network } = parseAccountId(accountId);
  let lastResult: ApiWalletInfo[] | undefined;

  return pollingLoop({
    pause: VERSIONS_INTERVAL,
    pauseWhenNotFocused: VERSIONS_INTERVAL_WHEN_NOT_FOCUSED,
    async poll() {
      try {
        const { type: accountType, ton: tonWallet } = await fetchStoredAccount(accountId);
        if (accountType === 'bip39' || !tonWallet) return 'stop';

        const { publicKey, version, isInitialized } = tonWallet;

        if (!publicKey) {
          if (!isInitialized) {
            // Keep polling because `publicKey` may arrive later (for example, when the view wallet becomes initialized)
            return undefined;
          }

          // This happens when this address is not a wallet address (for example, a contract address)
          onUpdate({
            type: 'updateWalletVersions',
            accountId,
            currentVersion: version,
            versions: [],
          });
          return 'stop';
        }

        const publicKeyBytes = hexToBytes(publicKey);
        const versions = (accountType === 'ledger' ? LEDGER_WALLET_VERSIONS : POPULAR_WALLET_VERSIONS)
          .filter((value) => value !== version);
        const versionInfos = (await getWalletVersionInfos(
          network, publicKeyBytes, versions,
        ));

        const filteredVersions = versionInfos.map(({ wallet, ...rest }) => rest);

        if (!areDeepEqual(versionInfos, lastResult)) {
          lastResult = versionInfos;
          onUpdate({
            type: 'updateWalletVersions',
            accountId,
            currentVersion: version,
            versions: filteredVersions,
          });
        }
      } catch (err) {
        logDebugError('setupWalletVersionsPolling', err);
      }

      return undefined;
    },
  });
}

function setupTonDnsPolling(accountId: string, onUpdate: OnApiUpdate) {
  let lastResult: Awaited<ReturnType<typeof fetchDomains>> | undefined;

  return pollingLoop({
    pause: TON_DNS_INTERVAL,
    pauseWhenNotFocused: TON_DNS_INTERVAL_WHEN_NOT_FOCUSED,
    async poll() {
      try {
        const result = await fetchDomains(accountId);

        if (!areDeepEqual(result, lastResult)) {
          lastResult = result;

          onUpdate({
            type: 'updateAccountDomainData',
            accountId,
            ...pick(result, [
              'expirationByAddress',
              'linkedAddressByAddress',
              'nfts',
            ]),
          });
        }
      } catch (err) {
        logDebugError('setupTonDnsPolling', err);
      }
    },
  });
}

function setupVestingPolling(accountId: string, onUpdate: OnApiUpdate) {
  if (IS_CORE_WALLET) {
    return () => {};
  }

  let lastVestingInfo: ApiVestingInfo[] | undefined;

  return pollingLoop({
    pause: VESTING_INTERVAL,
    pauseWhenNotFocused: VESTING_INTERVAL_WHEN_NOT_FOCUSED,
    async prepare() {
      const { isVestingEnabled } = await getBackendConfigCache();
      return isVestingEnabled;
    },
    async poll(isEnabled) {
      if (!isEnabled) {
        return 'stop';
      }

      try {
        const vestingInfo = await fetchVestings(accountId);

        if (!areDeepEqual(lastVestingInfo, vestingInfo)) {
          lastVestingInfo = vestingInfo;
          onUpdate({
            type: 'updateVesting',
            accountId,
            vestingInfo,
          });
        }
      } catch (err) {
        logDebugError('setupVestingPolling', err);
      }

      return undefined;
    },
  });
}

export function setupInactivePolling(
  accountId: string,
  account: ApiAccountAny,
  onUpdate: OnApiUpdate,
): NoneToVoidFunction {
  if (!('ton' in account) || !account.ton) {
    return () => {};
  }

  const balancePolling = setupBalanceAndDomainPolling(accountId, onUpdate);

  const walletPolling = new WalletPolling({
    ...inactiveWalletTiming,
    chain: 'ton',
    network: parseAccountId(accountId).network,
    address: account.ton.address,
    onUpdate: inactiveUpdateConcurrencyLimiter.wrap(async (isConfident) => {
      await balancePolling.update(!isConfident);
    }),
  });

  return () => {
    walletPolling.destroy();
    balancePolling.stop();
  };
}

async function checkWalletInitialization(accountId: string) {
  try {
    const wallet = await fetchStoredTonWallet(accountId);

    if (wallet.isInitialized) {
      return;
    }

    const { network } = parseAccountId(accountId);
    const doesNeedPublicKey = !wallet.publicKey;
    let walletUpdate: Partial<ApiTonWallet> | undefined;

    if (doesNeedPublicKey) {
      // This branch isn't used always, because it makes more network requests than the other
      const updatedWallet = await getWalletFromAddress(network, wallet.address);
      if (!('error' in updatedWallet) && updatedWallet.wallet.isInitialized) {
        // It's important to load and save `version` along with `publicKey` because the app couldn't get the proper
        // wallet version without knowing the `publicKey`.
        walletUpdate = pick(updatedWallet.wallet, ['isInitialized', 'publicKey', 'version']);
      }
    } else {
      const isInitialized = await isAddressInitialized(network, wallet.address);
      if (isInitialized) {
        walletUpdate = { isInitialized };
      }
    }

    if (walletUpdate) {
      await updateStoredTonWallet(accountId, walletUpdate);
    }
  } catch (err) {
    logDebugError('checkWalletInitialization', err);
  }
}
