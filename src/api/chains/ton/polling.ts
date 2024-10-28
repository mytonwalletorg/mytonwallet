import type {
  ApiBackendStakingState,
  ApiBalanceBySlug,
  ApiNftUpdate,
  ApiStakingCommonData,
  ApiStakingState,
  ApiTransactionActivity,
  ApiTxTimestamps,
  ApiVestingInfo,
  ApiWalletInfo,
  OnApiUpdate,
} from '../../types';
import type { TokenBalanceParsed } from './tokens';

import { LEDGER_WALLET_VERSIONS, POPULAR_WALLET_VERSIONS, TONCOIN } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { areDeepEqual } from '../../../util/areDeepEqual';
import { compareActivities } from '../../../util/compareActivities';
import { buildCollectionByKey } from '../../../util/iteratees';
import { logDebugError } from '../../../util/logs';
import { pauseOrFocus } from '../../../util/pauseOrFocus';
import {
  fetchStoredAccount, fetchStoredAccounts,
  fetchStoredTonWallet, getActiveAccountId,
  updateStoredTonWallet,
} from '../../common/accounts';
import { getStakingCommonCache } from '../../common/cache';
import { isAlive, isUpdaterAlive } from '../../common/helpers';
import { processNftUpdates, updateAccountNfts } from '../../common/nft';
import { addTokens, getTokensCache } from '../../common/tokens';
import { txCallbacks } from '../../common/txCallbacks';
import { hexToBytes } from '../../common/utils';
import { FIRST_TRANSACTIONS_LIMIT, SEC } from '../../constants';
import { AbortOperationError } from '../../errors';
import { getAccountNfts, getNftUpdates } from './nfts';
import { getBackendStakingState, getStakingState } from './staking';
import { swapReplaceTransactionsByRanges } from './swap';
import { getAccountTokenBalances } from './tokens';
import { fetchTokenTransactionSlice, fixTokenActivitiesAddressForm, waitUntilTransactionAppears } from './transactions';
import { fetchVestings } from './vesting';
import { getWalletInfo, getWalletVersionInfos, isAddressInitialized } from './wallet';

type AccountBalanceCache = {
  balance?: bigint;
  tokenBalances?: ApiBalanceBySlug;
};

const BALANCE_BASED_INTERVAL = 1.1 * SEC;
const BALANCE_BASED_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;
const DOUBLE_CHECK_TOKENS_PAUSE = 30 * SEC;
const NFT_FULL_INTERVAL = 60 * SEC;

const STAKING_INTERVAL = 5 * SEC;
const STAKING_INTERVAL_WHEN_NOT_FOCUSED = 10 * SEC;

const VERSIONS_INTERVAL = 5 * 60 * SEC;
const VERSIONS_INTERVAL_WHEN_NOT_FOCUSED = 15 * 60 * SEC;
const VESTING_INTERVAL = 10 * SEC;
const VESTING_INTERVAL_WHEN_NOT_FOCUSED = 60 * SEC;

const BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL = 30 * SEC;
const BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL_WHEN_NOT_FOCUSED = 60 * SEC;

const lastBalanceCache: Record<string, AccountBalanceCache> = {};

export function setupPolling(accountId: string, onUpdate: OnApiUpdate, newestTxTimestamps: ApiTxTimestamps) {
  void setupBalanceBasedPolling(accountId, onUpdate, newestTxTimestamps);
  void setupStakingPolling(accountId, onUpdate);
  void setupWalletVersionsPolling(accountId, onUpdate);
  void setupVestingPolling(accountId, onUpdate);
}

async function setupBalanceBasedPolling(
  accountId: string,
  onUpdate: OnApiUpdate,
  newestTxTimestamps: ApiTxTimestamps = {},
) {
  delete lastBalanceCache[accountId];

  const { network } = parseAccountId(accountId);
  // eslint-disable-next-line prefer-const
  let { address, isInitialized } = await fetchStoredTonWallet(accountId);

  let nftFromSec = Math.round(Date.now() / 1000);
  let nftUpdates: ApiNftUpdate[];
  let lastNftFullUpdate = 0;
  let doubleCheckTokensTime: number | undefined;
  let tokenBalances: TokenBalanceParsed[] | undefined;

  async function updateBalance(cache: AccountBalanceCache) {
    const walletInfo = await getWalletInfo(network, address);
    const { balance, lastTxId } = walletInfo ?? {};
    const isToncoinBalanceChanged = balance !== undefined && balance !== cache?.balance;
    const balancesToUpdate: ApiBalanceBySlug = {};

    if (isToncoinBalanceChanged) {
      balancesToUpdate[TONCOIN.slug] = balance;

      lastBalanceCache[accountId] = {
        ...lastBalanceCache[accountId],
        balance,
      };
    }

    return {
      lastTxId, isToncoinBalanceChanged, balancesToUpdate,
    };
  }

  async function updateNfts(isToncoinBalanceChanged: boolean) {
    if (Date.now() - lastNftFullUpdate < NFT_FULL_INTERVAL) {
      // Partial update
      if (isToncoinBalanceChanged) {
        const nftResult = await getNftUpdates(accountId, nftFromSec).catch(logAndRescue);

        throwErrorIfUpdaterNotAlive(onUpdate, accountId);

        if (nftResult) {
          [nftFromSec, nftUpdates] = nftResult;
          void processNftUpdates(accountId, nftUpdates, onUpdate);
        }
      }
    } else {
      // Full update
      const nfts = await getAccountNfts(accountId).catch(logAndRescue);
      lastNftFullUpdate = Date.now();

      throwErrorIfUpdaterNotAlive(onUpdate, accountId);

      if (nfts) {
        nftFromSec = Math.round(Date.now() / 1000);
        void updateAccountNfts(accountId, nfts, onUpdate);
      }
    }
  }

  async function updateTokenBalances(
    isToncoinBalanceChanged: boolean,
    cache: AccountBalanceCache,
    balancesToUpdate: ApiBalanceBySlug,
  ) {
    const changedTokenSlugs: string[] = [];

    if (isToncoinBalanceChanged || (doubleCheckTokensTime && doubleCheckTokensTime < Date.now())) {
      doubleCheckTokensTime = isToncoinBalanceChanged ? Date.now() + DOUBLE_CHECK_TOKENS_PAUSE : undefined;
      tokenBalances = await getAccountTokenBalances(accountId).catch(logAndRescue);
      const slugsWithBalances = new Set(tokenBalances?.map(({ slug }) => slug));

      const tokensCache = getTokensCache();
      const mintlessZeroBalances = Object.fromEntries(
        Object.values(tokensCache)
          .filter((token) => token.customPayloadApiUrl && !slugsWithBalances.has(token.slug))
          .map(({ slug }) => [slug, undefined]),
      );
      throwErrorIfUpdaterNotAlive(onUpdate, accountId);

      if (tokenBalances) {
        const tokens = tokenBalances.filter(Boolean).map(({ token }) => token);
        await addTokens(tokens, onUpdate);

        const cachedTokenBalances = cache?.tokenBalances || {};
        tokenBalances.forEach(({ slug, balance: tokenBalance }) => {
          const cachedBalance = cachedTokenBalances[slug];
          if (cachedBalance === tokenBalance) return;

          changedTokenSlugs.push(slug);
          balancesToUpdate[slug] = tokenBalance;
        });
        Object.assign(balancesToUpdate, mintlessZeroBalances);

        lastBalanceCache[accountId] = {
          ...lastBalanceCache[accountId],
          tokenBalances: Object.fromEntries(tokenBalances.map(
            ({ slug, balance: tokenBalance }) => [slug, tokenBalance || 0n],
          )),
        };
      }

      if (Object.keys(balancesToUpdate).length > 0) {
        onUpdate({
          type: 'updateBalances',
          accountId,
          balancesToUpdate,
        });
      }
    }

    onUpdate({ type: 'updatingStatus', kind: 'balance', isUpdating: false });

    return changedTokenSlugs;
  }

  async function updateActivities(isToncoinBalanceChanged: boolean, changedTokenSlugs: string[], lastTxId?: string) {
    if (isToncoinBalanceChanged || changedTokenSlugs.length) {
      if (lastTxId) {
        await waitUntilTransactionAppears(network, address, lastTxId);
      }

      const newTxTimestamps = await processNewActivities(
        accountId, newestTxTimestamps, changedTokenSlugs, onUpdate, tokenBalances,
      );
      newestTxTimestamps = { ...newestTxTimestamps, ...newTxTimestamps };
    }

    onUpdate({ type: 'updatingStatus', kind: 'activities', isUpdating: false });
  }

  while (isAlive(onUpdate, accountId)) {
    try {
      onUpdate({ type: 'updatingStatus', kind: 'activities', isUpdating: true });
      onUpdate({ type: 'updatingStatus', kind: 'balance', isUpdating: true });

      const cache = lastBalanceCache[accountId];

      const {
        lastTxId,
        isToncoinBalanceChanged,
        balancesToUpdate,
      } = await updateBalance(cache);

      throwErrorIfUpdaterNotAlive(onUpdate, accountId);

      const changedTokenSlugs = await updateTokenBalances(isToncoinBalanceChanged, cache, balancesToUpdate);

      await Promise.all([
        updateActivities(isToncoinBalanceChanged, changedTokenSlugs, lastTxId),
        updateNfts(isToncoinBalanceChanged),
      ]);

      if (isToncoinBalanceChanged && !isInitialized && await isAddressInitialized(network, address)) {
        isInitialized = true;
        await updateStoredTonWallet(accountId, { isInitialized });
      }
    } catch (err) {
      if (err instanceof AbortOperationError) {
        return;
      }
      logDebugError('setupBalanceBasedPolling', err);
    }

    await pauseOrFocus(BALANCE_BASED_INTERVAL, BALANCE_BASED_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

function throwErrorIfUpdaterNotAlive(onUpdate: OnApiUpdate, accountId: string) {
  if (!isAlive(onUpdate, accountId)) {
    throw new AbortOperationError();
  }
}

async function setupStakingPolling(accountId: string, onUpdate: OnApiUpdate) {
  const { network } = parseAccountId(accountId);

  if (network !== 'mainnet') {
    return;
  }

  let lastState: {
    stakingCommonData: ApiStakingCommonData;
    backendStakingState: ApiBackendStakingState;
    stakingState: ApiStakingState;
  } | undefined;

  while (isAlive(onUpdate, accountId)) {
    try {
      const stakingCommonData = getStakingCommonCache();
      const backendStakingState = await getBackendStakingState(accountId);
      const stakingState = await getStakingState(accountId, backendStakingState);

      if (!isAlive(onUpdate, accountId)) return;

      const state = {
        stakingCommonData,
        backendStakingState,
        stakingState,
      };

      if (!areDeepEqual(state, lastState)) {
        lastState = state;
        onUpdate({
          type: 'updateStaking',
          accountId,
          ...state,
        });
      }
    } catch (err) {
      logDebugError('setupStakingPolling', err);
    }

    await pauseOrFocus(STAKING_INTERVAL, STAKING_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

async function processNewActivities(
  accountId: string,
  newestTxTimestamps: ApiTxTimestamps,
  tokenSlugs: string[],
  onUpdate: OnApiUpdate,
  tokenBalances?: TokenBalanceParsed[],
): Promise<ApiTxTimestamps> {
  const { network } = parseAccountId(accountId);

  const chunks: ApiTransactionActivity[][] = [];
  const result: ApiTxTimestamps = {};

  // Process TON transactions first
  {
    const slug = TONCOIN.slug;
    let newestTxTimestamp = newestTxTimestamps[slug];

    const transactions = await fetchTokenTransactionSlice(
      accountId, slug, undefined, newestTxTimestamp, FIRST_TRANSACTIONS_LIMIT,
    );

    if (transactions.length) {
      newestTxTimestamp = transactions[0]!.timestamp;
      chunks.push(transactions);
    }

    result[slug] = newestTxTimestamp;

    // Find affected token wallets
    const tokenBalanceByAddress = buildCollectionByKey(tokenBalances ?? [], 'jettonWallet');
    transactions.forEach(({ isIncoming, toAddress, fromAddress }) => {
      const address = isIncoming ? fromAddress : toAddress;
      const tokenBalance: TokenBalanceParsed | undefined = tokenBalanceByAddress[address];

      if (tokenBalance && !tokenSlugs.includes(tokenBalance.slug)) {
        tokenSlugs = tokenSlugs.concat([tokenBalance.slug]);
      }
    });
  }

  // Process token transactions
  await Promise.all(tokenSlugs.map(async (slug) => {
    let newestTxTimestamp = newestTxTimestamps[slug];

    const transactions = await fetchTokenTransactionSlice(
      accountId, slug, undefined, newestTxTimestamp, FIRST_TRANSACTIONS_LIMIT,
    );

    if (transactions.length) {
      newestTxTimestamp = transactions[0]!.timestamp;
      chunks.push(transactions);
    }

    result[slug] = newestTxTimestamp;
  }));

  const allTransactions = chunks.flat().sort(compareActivities);

  const isFirstRun = !Object.values(newestTxTimestamps).some(Boolean);
  const activities = await swapReplaceTransactionsByRanges(accountId, allTransactions, chunks, isFirstRun);

  allTransactions.slice().reverse().forEach((transaction) => {
    txCallbacks.runCallbacks(transaction);
  });

  await fixTokenActivitiesAddressForm(network, activities);

  activities.sort(compareActivities);

  onUpdate({
    type: 'newActivities',
    chain: 'ton',
    activities,
    accountId,
  });

  return result;
}

function logAndRescue(err: Error) {
  logDebugError('Polling error', err);

  return undefined;
}

async function setupWalletVersionsPolling(accountId: string, onUpdate: OnApiUpdate) {
  const account = await fetchStoredAccount(accountId);

  if (account.type === 'bip39') {
    return;
  }

  const isLedger = account.type === 'ledger';
  const { publicKey, version } = account.ton;
  const publicKeyBytes = hexToBytes(publicKey);
  const { network } = parseAccountId(accountId);

  const versions = (isLedger ? LEDGER_WALLET_VERSIONS : POPULAR_WALLET_VERSIONS)
    .filter((value) => value !== version);
  let lastResult: ApiWalletInfo[] | undefined;

  while (isAlive(onUpdate, accountId)) {
    try {
      const versionInfos = (await getWalletVersionInfos(
        network, publicKeyBytes, versions,
      )).filter((versionInfo) => !!versionInfo.lastTxId || versionInfo.version === 'W5');

      const filteredVersions = versionInfos.map(({ wallet, ...rest }) => rest);

      if (!isAlive(onUpdate, accountId)) return;

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

    await pauseOrFocus(VERSIONS_INTERVAL, VERSIONS_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

async function setupVestingPolling(accountId: string, onUpdate: OnApiUpdate) {
  let lastVestingInfo: ApiVestingInfo[] | undefined;

  while (isAlive(onUpdate, accountId)) {
    try {
      const vestingInfo = await fetchVestings(accountId);

      if (!isAlive(onUpdate, accountId)) return;
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

    await pauseOrFocus(VESTING_INTERVAL, VESTING_INTERVAL_WHEN_NOT_FOCUSED);
  }
}

export async function setupInactiveAccountsBalancePolling(onUpdate: OnApiUpdate) {
  interface BalancePollingAccount {
    id: string;
    chain: any;
    network: string;
    address: string;
  }
  let addressToAccountsMap: { [address: string]: BalancePollingAccount[] } = {};
  let activeAccountId: string | undefined;

  const localOnUpdate = onUpdate;

  async function updateAddressToAccountsMap() {
    const accountsById = await fetchStoredAccounts();
    addressToAccountsMap = {};

    Object.entries(accountsById)
      .filter(([id]) => id !== activeAccountId)
      .forEach(([accountId, account]) => {
        const { network } = parseAccountId(accountId);
        const { address } = account.ton;

        const balancePollingAccount: BalancePollingAccount = {
          id: accountId,
          chain: 'ton',
          network,
          address,
        };

        if (!addressToAccountsMap[address]) {
          addressToAccountsMap[address] = [];
        }
        addressToAccountsMap[address].push(balancePollingAccount);
      });
  }

  async function updateBalance(account: BalancePollingAccount, cache: AccountBalanceCache) {
    const walletInfo = await account.chain.getWalletInfo(account.network, account.address);
    const { balance, lastTxId } = walletInfo ?? {};
    const isToncoinBalanceChanged = balance !== undefined && balance !== cache?.balance;
    const balancesToUpdate: ApiBalanceBySlug = {};

    if (isToncoinBalanceChanged) {
      balancesToUpdate[TONCOIN.slug] = balance;

      lastBalanceCache[account.id] = {
        ...lastBalanceCache[account.id],
        balance,
      };
    }

    return {
      lastTxId, isToncoinBalanceChanged, balancesToUpdate,
    };
  }

  async function updateTokenBalances(
    isToncoinBalanceChanged: boolean,
    cache: AccountBalanceCache,
    balancesToUpdate: ApiBalanceBySlug,
    account: BalancePollingAccount,
  ) {
    const changedTokenSlugs: string[] = [];

    if (isToncoinBalanceChanged) {
      const tokenBalances: TokenBalanceParsed[] | undefined = await account.chain
        .getAccountTokenBalances(account.id).catch(logAndRescue);

      if (!activeAccountId) {
        throw new AbortOperationError();
      }
      throwErrorIfUpdaterNotAlive(localOnUpdate, activeAccountId);

      if (tokenBalances) {
        const tokens = tokenBalances.filter(Boolean).map(({ token }) => token);
        await addTokens(tokens, onUpdate);

        tokenBalances.forEach(({ slug, balance: tokenBalance }) => {
          const cachedBalance = cache?.tokenBalances && cache.tokenBalances[slug];
          if (cachedBalance === tokenBalance) return;

          changedTokenSlugs.push(slug);
          balancesToUpdate[slug] = tokenBalance;
        });

        lastBalanceCache[account.id] = {
          ...lastBalanceCache[account.id],
          tokenBalances: Object.fromEntries(tokenBalances.map(
            ({ slug, balance: tokenBalance }) => [slug, tokenBalance],
          )),
        };
      }

      if (Object.keys(balancesToUpdate).length > 0) {
        // Notify all accounts with the same address
        addressToAccountsMap[account.address].forEach((acc) => {
          onUpdate({
            type: 'updateBalances',
            accountId: acc.id,
            balancesToUpdate,
          });
        });
      }
    }

    return changedTokenSlugs;
  }

  while (isUpdaterAlive(localOnUpdate)) {
    try {
      activeAccountId = getActiveAccountId();
      await updateAddressToAccountsMap();
      for (const address of Object.keys(addressToAccountsMap)) {
        const account = addressToAccountsMap[address][0];
        const cache = lastBalanceCache[account.id];

        const {
          isToncoinBalanceChanged,
          balancesToUpdate,
        } = await updateBalance(account, cache);

        if (isUpdaterAlive(localOnUpdate)) {
          await updateTokenBalances(isToncoinBalanceChanged, cache, balancesToUpdate, account);
        }
      }
    } catch (err) {
      if (err instanceof AbortOperationError) {
        break;
      }
      logDebugError('setupBalancesPolling', err);
    }

    await pauseOrFocus(BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL, BALANCE_NOT_ACTIVE_ACCOUNTS_INTERVAL_WHEN_NOT_FOCUSED);
  }
}
