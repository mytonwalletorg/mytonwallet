import React, {
  memo, useEffect, useLayoutEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';
import { setExtraStyles } from '../../../../lib/teact/teact-dom';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiActivity, ApiStakingState, ApiSwapAsset, ApiTokenWithPrice,
} from '../../../../api/types';
import type { Account, SavedAddress, Theme } from '../../../../global/types';
import { ContentTab } from '../../../../global/types';

import {
  ANIMATED_STICKER_BIG_SIZE_PX,
  LANDSCAPE_MIN_ASSETS_TAB_VIEW,
  PORTRAIT_MIN_ASSETS_TAB_VIEW,
} from '../../../../config';
import { getIsTinyOrScamTransaction } from '../../../../global/helpers';
import {
  selectAccountStakingStates,
  selectCurrentAccount,
  selectCurrentAccountSettings,
  selectCurrentAccountState,
  selectIsFirstTransactionsLoaded,
  selectIsMultichainAccount,
  selectIsNewWallet,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatHumanDay, getDayStartAt, SECOND } from '../../../../util/dateFormat';
import { buildCollectionByKey } from '../../../../util/iteratees';
import { getIsTransactionWithPoisoning } from '../../../../util/poisoningHash';
import { REM } from '../../../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useAppTheme from '../../../../hooks/useAppTheme';
import { getIsPortrait, useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useInfiniteScroll from '../../../../hooks/useInfiniteScroll';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useThrottledCallback from '../../../../hooks/useThrottledCallback';
import useUpdateIndicator from '../../../../hooks/useUpdateIndicator';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import InfiniteScroll from '../../../ui/InfiniteScroll';
import LoadingDots from '../../../ui/LoadingDots';
import Spinner from '../../../ui/Spinner';
import Transition from '../../../ui/Transition';
import NewWalletGreeting from './NewWalletGreeting';
import Swap, { getSwapHeight } from './Swap';
import Transaction, { getTransactionHeight } from './Transaction';

import styles from './Activities.module.scss';

interface OwnProps {
  isActive?: boolean;
  totalTokensAmount: number;
}

type StateProps = {
  currentAccountId: string;
  slug?: string;
  isNewWallet: boolean;
  isMultichainAccount: boolean;
  addressByChain?: Account['addressByChain'];
  areTinyTransfersHidden?: boolean;
  byId?: Record<string, ApiActivity>;
  idsBySlug?: Record<string, string[]>;
  idsMain?: string[];
  tokensBySlug: Record<string, ApiTokenWithPrice>;
  swapTokensBySlug?: Record<string, ApiSwapAsset>;
  currentActivityId?: string;
  savedAddresses?: SavedAddress[];
  isMainHistoryEndReached?: boolean;
  isHistoryEndReachedBySlug?: Record<string, boolean>;
  alwaysShownSlugs?: string[];
  activitiesUpdateStartedAt?: number;
  theme: Theme;
  isFirstTransactionsLoaded?: boolean;
  isSensitiveDataHidden?: true;
  stakingStates?: ApiStakingState[];
};

interface ActivityOffsetInfo {
  offset: number;
  height: number;
  isFirst: boolean;
  isFirstInDay: boolean;
  isLastInDay: boolean;
}

const FURTHER_SLICE = 30;
const THROTTLE_TIME = SECOND;

const LIST_TOP_PADDING = 0.5 * REM;
const DATE_HEADER_HEIGHT = 2.125 * REM;

function Activities({
  isActive,
  currentAccountId,
  isNewWallet,
  isMultichainAccount,
  addressByChain,
  slug,
  idsBySlug,
  idsMain,
  byId,
  tokensBySlug,
  swapTokensBySlug,
  areTinyTransfersHidden,
  currentActivityId,
  savedAddresses,
  isMainHistoryEndReached,
  isHistoryEndReachedBySlug,
  alwaysShownSlugs,
  activitiesUpdateStartedAt = 0,
  theme,
  isFirstTransactionsLoaded,
  isSensitiveDataHidden,
  stakingStates,
}: Omit<OwnProps, 'totalTokensAmount'> & StateProps) {
  const {
    fetchTokenTransactions, fetchAllTransactions, showActivityInfo,
  } = getActions();

  const lang = useLang();
  const { isLandscape } = useDeviceScreen();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const isUpdating = useUpdateIndicator(activitiesUpdateStartedAt);

  const appTheme = useAppTheme(theme);

  const stakingStateBySlug = useMemo(() => {
    return stakingStates ? buildCollectionByKey(stakingStates, 'tokenSlug') : {};
  }, [stakingStates]);

  const ids = useMemo(() => {
    let idList: string[] | undefined;

    const bySlug = idsBySlug ?? {};

    if (byId) {
      if (slug) {
        idList = bySlug[slug] ?? [];
      } else {
        idList = idsMain;
      }
    }

    if (!idList) {
      return undefined;
    }

    return idList;
  }, [byId, slug, idsBySlug, idsMain]);

  const activityList = useMemo(() => {
    if (!ids) {
      return undefined;
    }

    const allActivities = ids
      .map((id) => byId?.[id])
      .filter((activity) => {
        if (activity?.shouldHide) {
          return false;
        }
        if (activity?.kind === 'swap') {
          return Boolean(!slug || activity.from === slug || activity.to === slug);
        } else {
          return Boolean(
            activity?.slug
            && (!slug || activity.slug === slug)
            && (
              !areTinyTransfersHidden
              || (slug && tokensBySlug[activity.slug]?.quote.priceUsd === 0)
              || !getIsTinyOrScamTransaction(activity, tokensBySlug[activity.slug])
              || alwaysShownSlugs?.includes(activity.slug)
            )
            && !getIsTransactionWithPoisoning(activity),
          );
        }
      }) as ApiActivity[];

    if (!allActivities.length) {
      return [];
    }

    return allActivities;
  }, [areTinyTransfersHidden, byId, alwaysShownSlugs, ids, slug, tokensBySlug]);

  const { activityIds, activitiesById } = useMemo(() => {
    const activityIdList: string[] = [];
    const activityMap: Record<string, ApiActivity> = {};

    activityList?.forEach((activity) => {
      activityIdList.push(activity.id);
      activityMap[activity.id] = activity;
    });

    return { activityIds: activityIdList, activitiesById: activityMap };
  }, [activityList]);

  const isHistoryEndReached = useMemo(() => {
    if (slug) {
      return !!isHistoryEndReachedBySlug?.[slug];
    }

    return !!isMainHistoryEndReached;
  }, [isHistoryEndReachedBySlug, isMainHistoryEndReached, slug]);

  const loadMore = useLastCallback(() => {
    if (slug) {
      fetchTokenTransactions({ slug, limit: FURTHER_SLICE * 2, shouldLoadWithBudget: true });
    } else {
      fetchAllTransactions({ limit: FURTHER_SLICE * 2, shouldLoadWithBudget: true });
    }
  });

  const throttledLoadMore = useThrottledCallback(loadMore, [loadMore], THROTTLE_TIME, true);

  const [viewportIds, getMore, resetScroll] = useInfiniteScroll(
    throttledLoadMore, activityIds, undefined, FURTHER_SLICE, slug, isActive,
  );

  const isActivitiesEmpty = !activityList || !activityList.length;

  const activityOffsetInfoById = useMemo(() => {
    const offsetMap: Record<string, ActivityOffsetInfo> = {};

    let offset = 0;
    let lastActivityDayStart = 0;

    activityIds.forEach((id, index) => {
      const activity = activitiesById[id];
      if (!activity) return;

      let height = activity.kind === 'transaction' ? getTransactionHeight(activity) : getSwapHeight();

      const isFirst = index === 0;
      if (isFirst) {
        height += LIST_TOP_PADDING;
      }

      const activityDayStart = getDayStartAt(activity.timestamp);
      const isNewDay = lastActivityDayStart !== activityDayStart;
      if (isNewDay) {
        lastActivityDayStart = activityDayStart;
        height += DATE_HEADER_HEIGHT;
        if (index > 0) {
          offsetMap[activityIds[index - 1]].isLastInDay = true;
        }
      }

      offsetMap[id] = {
        offset,
        height,
        isFirst,
        isFirstInDay: isNewDay,
        isLastInDay: index === activityIds.length - 1, // Also gets overwritten a few lines above
      };

      offset += height;
    });

    return offsetMap;
  }, [activitiesById, activityIds]);

  const currentContainerHeight = useMemo(
    () => {
      const lastViewportId = viewportIds![viewportIds!.length - 1];
      const activityOffset = activityOffsetInfoById[lastViewportId];

      return activityOffset ? activityOffset.offset + activityOffset.height : 0;
    },
    [activityOffsetInfoById, viewportIds],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setExtraStyles(container, { height: isLandscape ? '' : `${currentContainerHeight}px` });
  }, [isLandscape, currentContainerHeight]);

  useEffect(() => {
    if (!isHistoryEndReached && ids && isActivitiesEmpty) {
      throttledLoadMore();
    }
  }, [ids, isActivitiesEmpty, isHistoryEndReached, throttledLoadMore]);

  useEffect(() => {
    if (!isActive && !isLandscape) {
      resetScroll?.();
    }
  }, [isActive, isLandscape, resetScroll]);

  const handleActivityClick = useLastCallback((id: string) => {
    showActivityInfo({ id });
  });

  if (!currentAccountId) {
    return undefined;
  }

  function renderActivity(activity: ApiActivity, isLast: boolean, isActivityActive: boolean) {
    const isSwap = activity.kind === 'swap';

    if (isSwap) {
      return (
        <Swap
          key={activity.id}
          activity={activity}
          tokensBySlug={swapTokensBySlug}
          isLast={isLast}
          isActive={isActivityActive}
          appTheme={appTheme}
          addressByChain={addressByChain}
          isSensitiveDataHidden={isSensitiveDataHidden}
          onClick={handleActivityClick}
        />
      );
    } else {
      return (
        <Transaction
          key={activity.id}
          transaction={activity}
          tokensBySlug={tokensBySlug}
          isActive={isActivityActive}
          annualYield={stakingStateBySlug[activity.slug]?.annualYield}
          yieldType={stakingStateBySlug[activity.slug]?.yieldType}
          isLast={isLast}
          savedAddresses={savedAddresses}
          withChainIcon={isMultichainAccount}
          appTheme={appTheme}
          isSensitiveDataHidden={isSensitiveDataHidden}
          onClick={handleActivityClick}
        />
      );
    }
  }

  function renderDate(dateValue: number, isFirst?: boolean) {
    const formattedDate = formatHumanDay(lang, dateValue);
    const date = <div className={styles.date}>{formattedDate}</div>;

    if (!isFirst) {
      return date;
    }

    const dateWithLoader = (
      <div className={buildClassName(styles.date, styles.date_withLoadingDots)}>
        {formattedDate}
        <LoadingDots isActive isDoubled className={styles.loadingDots} />
      </div>
    );

    return (
      <Transition
        name="semiFade"
        activeKey={isUpdating ? 1 : 0}
        className={styles.dateContainer}
        slideClassName={styles.dateSlide}
      >
        {isUpdating ? dateWithLoader : date}
      </Transition>
    );
  }

  function renderHistory() {
    return viewportIds!.map((id) => {
      const activityInfo = activityOffsetInfoById[id];
      const activity = activitiesById[id];
      if (!activity) return undefined;

      const isActivityActive = activity.id === currentActivityId;

      return (
        <div
          key={id}
          style={`top: ${activityInfo.offset}px`}
          className={buildClassName('ListItem', styles.listItem)}
        >
          {activityInfo.isFirstInDay && renderDate(activity.timestamp, activityInfo.isFirst)}
          {renderActivity(activity, activityInfo.isLastInDay, isActivityActive)}
        </div>
      );
    });
  }

  if (isActivitiesEmpty && !isFirstTransactionsLoaded) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}>
        <Spinner />
      </div>
    );
  }

  if (isNewWallet) {
    return (
      <div className={buildClassName(isLandscape && styles.greeting)}>
        <NewWalletGreeting
          isActive={isActive}
          isMutlichainAccount={isMultichainAccount}
          mode={isLandscape ? 'emptyList' : 'panel'}
        />
      </div>
    );
  }

  if (isHistoryEndReached && isActivitiesEmpty) {
    return (
      <div className={styles.emptyList}>
        <AnimatedIconWithPreview
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.noData}
          previewUrl={ANIMATED_STICKERS_PATHS.noDataPreview}
          size={ANIMATED_STICKER_BIG_SIZE_PX}
          className={styles.sticker}
          noLoop={false}
          nonInteractive
        />
        <p className={styles.emptyListTitle}>{lang('No Activity')}</p>
      </div>
    );
  }

  return (
    <InfiniteScroll
      ref={containerRef}
      className={buildClassName('custom-scroll', styles.listGroup)}
      scrollContainerClosest={!isLandscape && isActive ? '.app-slide-content' : undefined}
      items={viewportIds}
      preloadBackwards={FURTHER_SLICE}
      withAbsolutePositioning
      maxHeight={currentContainerHeight}
      onLoadMore={getMore}
    >
      {renderHistory()}
    </InfiniteScroll>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const accountId = global.currentAccountId;
      const account = selectCurrentAccount(global);
      const accountState = selectCurrentAccountState(global);
      const accountSettings = selectCurrentAccountSettings(global);
      const isFirstTransactionsLoaded = selectIsFirstTransactionsLoaded(global, global.currentAccountId!);
      const isNewWallet = selectIsNewWallet(global, isFirstTransactionsLoaded);
      const slug = accountState?.currentTokenSlug;
      const stakingStates = accountId ? selectAccountStakingStates(global, accountId) : undefined;
      const {
        idsBySlug, byId, isMainHistoryEndReached, isHistoryEndReachedBySlug, idsMain,
      } = accountState?.activities ?? {};

      return {
        isMultichainAccount: selectIsMultichainAccount(global, global.currentAccountId!),
        currentAccountId: global.currentAccountId!,
        slug,
        byId,
        isNewWallet,
        idsBySlug,
        idsMain,
        tokensBySlug: global.tokenInfo.bySlug,
        swapTokensBySlug: global.swapTokenInfo?.bySlug,
        areTinyTransfersHidden: global.settings.areTinyTransfersHidden,
        savedAddresses: accountState?.savedAddresses,
        isMainHistoryEndReached,
        isHistoryEndReachedBySlug,
        currentActivityId: accountState?.currentActivityId,
        alwaysShownSlugs: accountSettings?.alwaysShownSlugs,
        activitiesUpdateStartedAt: global.activitiesUpdateStartedAt,
        theme: global.settings.theme,
        isFirstTransactionsLoaded,
        addressByChain: account?.addressByChain,
        stakingStates,
        isSensitiveDataHidden: global.settings.isSensitiveDataHidden,
      };
    },
    (global, { totalTokensAmount }, stickToFirst) => {
      const accountState = selectCurrentAccountState(global);
      const shouldShowSeparateAssetsPanel = totalTokensAmount <= (
        getIsPortrait() ? PORTRAIT_MIN_ASSETS_TAB_VIEW : LANDSCAPE_MIN_ASSETS_TAB_VIEW
      );

      return stickToFirst((
        accountState?.activeContentTab === ContentTab.Activity
        || (accountState?.activeContentTab === ContentTab.Assets && shouldShowSeparateAssetsPanel)
      ) && global.currentAccountId);
    },
  )(Activities),
);
