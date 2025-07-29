import type { ApiActivity, ApiNetwork } from '../types';

import { parseAccountId } from '../../util/account';
import { buildCollectionByKey, findDifference, split } from '../../util/iteratees';
import { logDebug, logDebugError } from '../../util/logs';
import { pause } from '../../util/schedulers';
import { fetchActions, parseActionActivityId } from '../chains/ton/toncenter';
import { SEC } from '../constants';
import { fetchStoredTonWallet } from './accounts';
import { swapReplaceCexActivities } from './swap';

const RELOAD_ACTIVITIES_ATTEMPTS = 4;
const RELOAD_ACTIVITIES_PAUSE = SEC;
const FETCH_ACTIONS_BATCH_SIZE = 100;

/** Enriches the activities with missing metadata and CEX swap activities */
export async function enrichActivities(
  accountId: string,
  activities: ApiActivity[],
  tokenSlug?: string,
  isToNow?: boolean,
) {
  try {
    activities = await reloadIncompleteActivities(accountId, activities);
    activities = await swapReplaceCexActivities(accountId, activities, tokenSlug, isToNow);
  } catch (err) {
    logDebugError('enrichActivities', err);
  }

  return activities;
}

async function reloadIncompleteActivities(accountId: string, activities: ApiActivity[]) {
  try {
    const { network } = parseAccountId(accountId);
    const { address } = await fetchStoredTonWallet(accountId);

    let actionIdsToReload = activities
      .filter((activity) => activity.shouldReload)
      .map((activity) => parseActionActivityId(activity.id).actionId);

    for (let attempt = 0; attempt < RELOAD_ACTIVITIES_ATTEMPTS && actionIdsToReload.length; attempt++) {
      logDebug(`Reload incomplete activities #${attempt + 1}`, actionIdsToReload);
      await pause(RELOAD_ACTIVITIES_PAUSE);

      ({ activities, actionIdsToReload } = await tryReloadIncompleteActivities(
        network,
        address,
        activities,
        actionIdsToReload,
      ));
    }
  } catch (err) {
    logDebugError('reloadIncompleteActivities', err);
  }

  return activities;
}

async function tryReloadIncompleteActivities(
  network: ApiNetwork,
  address: string,
  activities: ApiActivity[],
  actionIdsToReload: string[],
) {
  const actionIdBatches = split(actionIdsToReload, FETCH_ACTIONS_BATCH_SIZE);

  const batchResults = await Promise.all(actionIdBatches.map(async (actionIds) => {
    const reloadedActivities = await fetchActions({
      network,
      filter: { actionId: actionIds },
      walletAddress: address,
      limit: FETCH_ACTIONS_BATCH_SIZE,
    });
    return reloadedActivities.filter((activity) => !activity.shouldReload);
  }));

  const reloadedActivities = batchResults.flat();

  if (reloadedActivities.length) {
    const replaceById = buildCollectionByKey(reloadedActivities, 'id');
    const reloadedActionIds = reloadedActivities.map((activity) => parseActionActivityId(activity.id).actionId);

    activities = activities.map((activity) => replaceById[activity.id] ?? activity);
    actionIdsToReload = findDifference(actionIdsToReload, reloadedActionIds);
  }

  return { activities, actionIdsToReload };
}
