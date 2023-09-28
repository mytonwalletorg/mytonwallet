import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiActivity, ApiToken } from '../../../../api/types';

import { TON_TOKEN_SLUG } from '../../../../config';
import {
  getIsSwapId, getIsTinyTransaction, getIsTxIdLocal,
} from '../../../../global/helpers';
import { selectCurrentAccountState, selectIsNewWallet } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { compareActivities } from '../../../../util/compareActivities';
import { formatHumanDay, getDayStartAt } from '../../../../util/dateFormat';
import { findLast, unique } from '../../../../util/iteratees';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useInfiniteLoader from '../../../../hooks/useInfiniteLoader';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Loading from '../../../ui/Loading';
import NewWalletGreeting from './NewWalletGreeting';
import Transaction from './Transaction';

import styles from './Activities.module.scss';

interface OwnProps {
  isActive?: boolean;
}

type StateProps = {
  currentAccountId: string;
  slug?: string;
  isLoading?: boolean;
  isNewWallet: boolean;
  areTinyTransfersHidden?: boolean;
  byId?: Record<string, ApiActivity>;
  idsBySlug?: Record<string, string[]>;
  tokensBySlug?: Record<string, ApiToken>;
  apyValue: number;
  savedAddresses?: Record<string, string>;
  isHistoryEndReached?: boolean;
};

interface ActivityDateGroup {
  datetime: number;
  activities: ApiActivity[];
}

const FURTHER_SLICE = 50;
const LOAD_MORE_REQUEST_TIMEOUT = 3_000;

function Activities({
  isActive,
  currentAccountId,
  isLoading,
  isNewWallet,
  slug,
  idsBySlug,
  byId,
  tokensBySlug,
  areTinyTransfersHidden,
  apyValue,
  savedAddresses,
  isHistoryEndReached,
}: OwnProps & StateProps) {
  const {
    fetchTokenTransactions, fetchAllTransactions, showActivityInfo, resetIsHistoryEndReached,
  } = getActions();

  const lang = useLang();
  const { isLandscape } = useDeviceScreen();
  const [isFetching, setIsFetching] = useState(!isNewWallet);
  const loadMoreTimeout = useRef<NodeJS.Timeout>();

  const ids = useMemo(() => {
    let idList: string[] | undefined;

    const bySlug = idsBySlug ?? {};

    if (byId) {
      if (slug) {
        idList = bySlug[slug] ?? [];
      } else {
        const lastTonTxId = findLast(bySlug[TON_TOKEN_SLUG] ?? [], (id) => !getIsTxIdLocal(id) && !getIsSwapId(id));
        idList = unique(Object.values(bySlug).flat());
        if (lastTonTxId) {
          idList = idList.filter((txId) => byId[txId].timestamp >= byId[lastTonTxId].timestamp);
        }

        idList.sort((a, b) => compareActivities(byId[a], byId[b], false));
      }
    }

    if (!idList) {
      return [];
    }

    return idList;
  }, [byId, slug, idsBySlug]);

  const activities = useMemo(() => {
    if (!ids.length) {
      return [];
    }

    const allActivities = ids
      .map((id) => byId?.[id])
      .filter((activity) => {
        return Boolean(
          activity?.slug
          && (!slug || activity.slug === slug)
          && (!areTinyTransfersHidden || !getIsTinyTransaction(activity, tokensBySlug![activity.slug])),
        );
      }) as ApiActivity[];

    if (!allActivities.length) {
      return [];
    }

    let currentDateGroup: ActivityDateGroup = {
      datetime: getDayStartAt(allActivities[0].timestamp),
      activities: [],
    };
    const groupedActivities: ActivityDateGroup[] = [currentDateGroup];

    allActivities.forEach((activity, index) => {
      currentDateGroup.activities.push(activity);
      const nextActivity = allActivities[index + 1];

      if (nextActivity) {
        const nextActivityDayStartsAt = getDayStartAt(nextActivity.timestamp);
        if (currentDateGroup.datetime !== nextActivityDayStartsAt) {
          currentDateGroup = {
            datetime: nextActivityDayStartsAt,
            activities: [],
          };

          groupedActivities.push(currentDateGroup);
        }
      }
    });

    return groupedActivities;
  }, [ids, byId, slug, areTinyTransfersHidden, tokensBySlug]);

  const loadMore = useLastCallback(() => {
    if (slug) {
      fetchTokenTransactions({ slug, limit: FURTHER_SLICE });
    } else {
      fetchAllTransactions({ limit: FURTHER_SLICE });
    }
  });

  const isLoadingDisabled = isHistoryEndReached || isLoading;
  const { handleIntersection } = useInfiniteLoader({ isDisabled: isLoadingDisabled, isLoading, loadMore });

  const handleFetchingState = useLastCallback(() => {
    clearTimeout(loadMoreTimeout.current);
    loadMoreTimeout.current = setTimeout(() => {
      setIsFetching(false);
    }, LOAD_MORE_REQUEST_TIMEOUT);
  });

  useEffect(() => {
    if (isActive) {
      setIsFetching(Boolean(ids.length));
      resetIsHistoryEndReached();
      handleFetchingState();
    }
  }, [handleFetchingState, isActive, isNewWallet, loadMore, slug, ids]);

  useEffect(() => {
    if (!activities.length) {
      loadMore();
      handleFetchingState();
    }
  }, [handleFetchingState, loadMore, activities, ids]);

  const handleActivityClick = useLastCallback((id: string) => {
    showActivityInfo({ id });
  });

  if (!currentAccountId) {
    return undefined;
  }

  function renderActivityGroups(activityGroups: ActivityDateGroup[]) {
    return activityGroups.map((group, groupIdx) => (
      <div className={styles.group}>
        <div className={styles.date}>{formatHumanDay(lang, group.datetime)}</div>
        {group.activities.map((activity) => {
          return (
            <Transaction
              key={activity?.id}
              transaction={activity}
              tokensBySlug={tokensBySlug}
              apyValue={apyValue}
              savedAddresses={savedAddresses}
              onClick={handleActivityClick}
            />
          );
        })}
        {
          groupIdx + 1 === activityGroups.length && (
            <div ref={handleIntersection} className={styles.loaderThreshold} />
          )
        }
      </div>
    ));
  }
  if (!activities.length && isFetching) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}>
        <Loading />
      </div>
    );
  }

  if (!activities.length || (isLandscape && isNewWallet)) {
    return (
      <div className={buildClassName(isLandscape && styles.greeting)}>
        <NewWalletGreeting isActive={isActive} mode={isLandscape ? 'emptyList' : 'panel'} />
      </div>
    );
  }

  return <div>{renderActivityGroups(activities)}</div>;
}

export default memo(
  withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
    const { currentAccountId } = global;
    detachWhenChanged(currentAccountId);

    const accountState = selectCurrentAccountState(global);
    const isNewWallet = selectIsNewWallet(global);
    const slug = accountState?.currentTokenSlug;
    const {
      idsBySlug, byId, isLoading, isHistoryEndReached,
    } = accountState?.activities || {};
    return {
      currentAccountId: currentAccountId!,
      slug,
      isLoading,
      byId,
      isNewWallet,
      idsBySlug,
      tokensBySlug: global.tokenInfo?.bySlug,
      areTinyTransfersHidden: global.settings.areTinyTransfersHidden,
      apyValue: accountState?.poolState?.lastApy || 0,
      savedAddresses: accountState?.savedAddresses,
      isHistoryEndReached,
    };
  })(Activities),
);
