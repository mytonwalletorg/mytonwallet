import type { ApiActivity, ApiChain } from '../../api/types';
import type { AccountState, GlobalState } from '../types';

import {
  getActivityTokenSlugs,
  getIsActivityPending,
  getIsActivitySuitableForFetchingTimestamp,
  getIsTxIdLocal,
  mergeActivityIdsToMaxTime,
} from '../../util/activities';
import { compareActivities } from '../../util/compareActivities';
import { buildCollectionByKey, extractKey, mapValues, unique } from '../../util/iteratees';
import { selectAccountState } from '../selectors';
import { updateAccountState } from './misc';

/*
  Used for the initial activities insertion into `global`.
  Token activity IDs will just be replaced.
 */
export function putInitialActivities(
  global: GlobalState,
  accountId: string,
  mainActivities: ApiActivity[],
  bySlug: Record<string, ApiActivity[]>,
) {
  const allActivities = [...mainActivities, ...Object.values(bySlug).flat()];

  const { activities } = selectAccountState(global, accountId) || {};
  let { byId, idsBySlug, idsMain, newestActivitiesBySlug } = activities || {};

  byId = { ...byId, ...buildCollectionByKey(allActivities, 'id') };

  // Activities from different blockchains arrive separately, which causes the order to be disrupted
  idsMain = mergeActivityIdsToMaxTime(extractKey(mainActivities, 'id'), idsMain ?? [], byId);

  const newIdsBySlug = mapValues(bySlug, (_activities) => extractKey(_activities, 'id'));
  idsBySlug = mergeIdsBySlug(idsBySlug, newIdsBySlug, byId);

  newestActivitiesBySlug = getNewestActivitiesBySlug(
    { byId, idsBySlug, newestActivitiesBySlug },
    Object.keys(newIdsBySlug),
  );

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      idsMain,
      byId,
      idsBySlug,
      newestActivitiesBySlug,
    },
  });
}

export function addNewActivities(
  global: GlobalState,
  accountId: string,
  newActivities: readonly ApiActivity[],
  // Necessary when adding pending activities
  chain?: ApiChain,
) {
  if (newActivities.length === 0) {
    return global;
  }

  const { activities } = selectAccountState(global, accountId) || {};
  let { byId, idsBySlug, idsMain, newestActivitiesBySlug, localActivityIds, pendingActivityIds } = activities || {};

  byId = { ...byId, ...buildCollectionByKey(newActivities, 'id') };

  // Activities from different blockchains arrive separately, which causes the order to be disrupted
  idsMain = mergeSortedActivityIds(idsMain ?? [], extractKey(newActivities, 'id'), byId);

  const newIdsBySlug = buildActivityIdsBySlug(newActivities);
  idsBySlug = mergeIdsBySlug(idsBySlug, newIdsBySlug, byId);

  newestActivitiesBySlug = getNewestActivitiesBySlug(
    { byId, idsBySlug, newestActivitiesBySlug },
    Object.keys(newIdsBySlug),
  );

  localActivityIds = unique([
    ...(localActivityIds ?? []),
    ...extractKey(newActivities, 'id').filter(getIsTxIdLocal)],
  );

  if (chain) {
    pendingActivityIds = {
      ...pendingActivityIds,
      [chain]: unique([
        ...(pendingActivityIds?.[chain] ?? []),
        ...extractKey(
          newActivities.filter((activity) => getIsActivityPending(activity) && !getIsTxIdLocal(activity.id)),
          'id',
        ),
      ]),
    };
  }

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      idsMain,
      byId,
      idsBySlug,
      newestActivitiesBySlug,
      localActivityIds,
      pendingActivityIds,
    },
  });
}

function buildActivityIdsBySlug(activities: readonly ApiActivity[]) {
  return activities.reduce<Record<string, string[]>>((acc, activity) => {
    for (const slug of getActivityTokenSlugs(activity)) {
      acc[slug] ??= [];
      acc[slug].push(activity.id);
    }

    return acc;
  }, {});
}

export function removeActivities(
  global: GlobalState,
  accountId: string,
  _ids: Iterable<string>,
) {
  const { activities } = selectAccountState(global, accountId) || {};
  if (!activities) {
    return global;
  }

  const ids = new Set(_ids); // Don't use `_ids` again, because the iterable may be disposable
  if (ids.size === 0) {
    return global;
  }

  let { byId, idsBySlug, idsMain, newestActivitiesBySlug, localActivityIds, pendingActivityIds } = activities;
  const affectedTokenSlugs = getActivityListTokenSlugs(ids, byId);

  idsBySlug = { ...idsBySlug };
  for (const tokenSlug of affectedTokenSlugs) {
    if (tokenSlug in idsBySlug) {
      idsBySlug[tokenSlug] = idsBySlug[tokenSlug].filter((id) => !ids.has(id));

      if (!idsBySlug[tokenSlug].length) {
        delete idsBySlug[tokenSlug];
      }
    }
  }

  newestActivitiesBySlug = getNewestActivitiesBySlug({ byId, idsBySlug, newestActivitiesBySlug }, affectedTokenSlugs);

  idsMain = idsMain?.filter((id) => !ids.has(id));

  byId = { ...byId };
  for (const id of ids) {
    delete byId[id];
  }

  localActivityIds = localActivityIds?.filter((id) => !ids.has(id));

  pendingActivityIds = pendingActivityIds
    && mapValues(pendingActivityIds, (pendingIds) => pendingIds.filter((id) => !ids.has(id)));

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      byId,
      idsBySlug,
      idsMain,
      newestActivitiesBySlug,
      localActivityIds,
      pendingActivityIds,
    },
  });
}

export function setIsInitialActivitiesLoadedTrue(global: GlobalState, accountId: string, chain: ApiChain) {
  const { activities } = selectAccountState(global, accountId) ?? {};

  if (activities?.isFirstTransactionsLoaded?.[chain]) {
    return global;
  }

  return updateAccountState(global, accountId, {
    activities: {
      byId: {},
      ...activities,
      isFirstTransactionsLoaded: {
        ...activities?.isFirstTransactionsLoaded,
        [chain]: true,
      },
    },
  });
}

export function updateActivity(global: GlobalState, accountId: string, activity: ApiActivity) {
  const { id } = activity;

  const { activities } = selectAccountState(global, accountId) || {};
  const { byId } = activities ?? {};

  if (!byId || !(id in byId)) {
    return global;
  }

  return updateAccountState(global, accountId, {
    activities: {
      ...activities,
      byId: {
        ...byId,
        [id]: activity,
      },
    },
  });
}

/** Replaces all pending activities in the given account and chain */
export function replacePendingActivities(
  global: GlobalState,
  accountId: string,
  chain: ApiChain,
  pendingActivities: readonly ApiActivity[],
) {
  const { pendingActivityIds } = selectAccountState(global, accountId)?.activities || {};
  global = removeActivities(global, accountId, pendingActivityIds?.[chain] ?? []);
  global = addNewActivities(global, accountId, pendingActivities, chain);
  return global;
}

function mergeSortedActivityIds(ids0: string[], ids1: string[], byId: Record<string, ApiActivity>) {
  if (!ids0.length) return ids1;
  if (!ids1.length) return ids0;
  // Not the best performance, but ok for now
  return unique([...ids0, ...ids1]).sort((id0, id1) => compareActivities(byId[id0], byId[id1]));
}

function getNewestActivitiesBySlug(
  {
    byId, idsBySlug, newestActivitiesBySlug,
  }: Pick<Exclude<AccountState['activities'], undefined>, 'byId' | 'idsBySlug' | 'newestActivitiesBySlug'>,
  tokenSlugs: Iterable<string>,
) {
  newestActivitiesBySlug = { ...newestActivitiesBySlug };

  for (const tokenSlug of tokenSlugs) {
    // The `idsBySlug` arrays must be sorted from the newest to the oldest
    const ids = idsBySlug?.[tokenSlug] ?? [];
    const newestActivityId = ids.find((id) => getIsActivitySuitableForFetchingTimestamp(byId[id]));
    if (newestActivityId) {
      newestActivitiesBySlug[tokenSlug] = byId[newestActivityId];
    } else {
      delete newestActivitiesBySlug[tokenSlug];
    }
  }

  return newestActivitiesBySlug;
}

function getActivityListTokenSlugs(activityIds: Iterable<string>, byId: Record<string, ApiActivity>) {
  const tokenSlugs = new Set<string>();

  for (const id of activityIds) {
    const activity = byId[id];
    if (activity) {
      for (const tokenSlug of getActivityTokenSlugs(activity)) {
        tokenSlugs.add(tokenSlug);
      }
    }
  }

  return tokenSlugs;
}

/** replaceMap: keys - old (removed) activity ids, value - new (added) activity ids */
export function replaceCurrentActivityId(global: GlobalState, accountId: string, replaceMap: Map<string, string>) {
  const { currentActivityId } = selectAccountState(global, accountId) || {};
  const newActivityId = currentActivityId && replaceMap.get(currentActivityId);
  if (newActivityId) {
    global = updateAccountState(global, accountId, { currentActivityId: newActivityId });
  }
  return global;
}

function mergeIdsBySlug(
  oldIdsBySlug: Record<string, string[]> | undefined,
  newIdsBySlug: Record<string, string[]>,
  activityById: Record<string, ApiActivity>,
) {
  return {
    ...oldIdsBySlug,
    ...mapValues(newIdsBySlug, (newIds, slug) => {
      // There may be newer local transactions in `idsBySlug`, so a sorting is needed
      return mergeSortedActivityIds(newIds, oldIdsBySlug?.[slug] ?? [], activityById);
    }),
  };
}
