import type { TeactNode } from '../../../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';
import { setExtraStyles } from '../../../../lib/teact/teact-dom';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiActivity,
  ApiBaseCurrency,
  ApiNft,
  ApiStakingState,
  ApiSwapAsset,
  ApiTokenWithPrice,
} from '../../../../api/types';
import type { Account, SavedAddress, Theme } from '../../../../global/types';
import { ContentTab } from '../../../../global/types';

import {
  ANIMATED_STICKER_BIG_SIZE_PX,
  LANDSCAPE_MIN_ASSETS_TAB_VIEW,
  PORTRAIT_MIN_ASSETS_TAB_VIEW,
} from '../../../../config';
import { forceMeasure } from '../../../../lib/fasterdom/stricterdom';
import { getIsTinyOrScamTransaction } from '../../../../global/helpers';
import {
  selectAccounts,
  selectAccountStakingStatesBySlug,
  selectCurrentAccountSettings,
  selectCurrentAccountState,
  selectIsFirstTransactionsLoaded,
  selectIsMultichainAccount,
  selectIsNewWallet,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatHumanDay, getDayStartAt, SECOND } from '../../../../util/dateFormat';
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
import Activity, { getActivityHeight } from './Activity';
import ActivityListItem from './ActivityListItem';
import NewWalletGreeting from './NewWalletGreeting';

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
  theme: Theme;
  baseCurrency?: ApiBaseCurrency;
  isFirstTransactionsLoaded?: boolean;
  isSensitiveDataHidden?: true;
  stakingStateBySlug?: Record<string, ApiStakingState>;
  nftsByAddress?: Record<string, ApiNft>;
  accounts?: Record<string, Account>;
};

interface ItemPosition {
  /** In rem */
  top: number;
  /** In rem */
  height: number;
}

const FURTHER_SLICE = 30;
const THROTTLE_TIME = SECOND;

const LIST_TOP_PADDING = 0.5; // rem
const DATE_HEADER_HEIGHT = 2.125; // rem
const FIRST_ACTIVITY_HEADER_HEIGHT = LIST_TOP_PADDING + DATE_HEADER_HEIGHT; // rem

// After this threshold, the animations of adding new activities (controlled by `useActivityOrderDiff`) won't be visible
// to the user, so the animation is disabled to improve the performance. An important part that makes the additions
// invisible is the `usePreventScrolledListShift` hook.
const SCROLL_THRESHOLD = FIRST_ACTIVITY_HEADER_HEIGHT * REM;

const DATE_ID_PREFIX = 'date:';

function Activities({
  isActive,
  currentAccountId,
  isNewWallet,
  isMultichainAccount,
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
  theme,
  baseCurrency,
  isFirstTransactionsLoaded,
  isSensitiveDataHidden,
  stakingStateBySlug,
  nftsByAddress,
  accounts,
}: Omit<OwnProps, 'totalTokensAmount'> & StateProps) {
  const {
    fetchTokenTransactions, fetchAllTransactions, showActivityInfo,
  } = getActions();

  const lang = useLang();
  const { isLandscape } = useDeviceScreen();

  const containerRef = useRef<HTMLDivElement>();
  const isUpdating = useUpdateIndicator('activitiesUpdateStartedAt');

  const appTheme = useAppTheme(theme);
  const hasUserScrolledRef = useRef(false);

  const allActivityIds = useMemo(() => {
    let idList: string[] | undefined;

    const bySlug = idsBySlug ?? {};

    if (byId) {
      if (slug) {
        idList = bySlug[slug] ?? [];
      } else {
        idList = idsMain;
      }
    }

    return idList;
  }, [byId, slug, idsBySlug, idsMain]);

  const listItemIds = useMemo(() => {
    const activityIds = filterActivityIds(
      allActivityIds,
      byId,
      slug,
      tokensBySlug,
      areTinyTransfersHidden,
      alwaysShownSlugs,
    );

    return addDatesToActivityIds(activityIds, byId);
  }, [areTinyTransfersHidden, byId, alwaysShownSlugs, allActivityIds, slug, tokensBySlug]);

  const firstListItemId = listItemIds[0] as string | undefined;

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
    throttledLoadMore, listItemIds, undefined, FURTHER_SLICE, slug, isActive,
  );

  const shouldUseAnimations = Boolean(isActive && !hasUserScrolledRef.current);

  const isActivitiesEmpty = !listItemIds.length;

  const itemPositionById = useMemo(() => {
    const itemPositionById: Record<string, ItemPosition> = {};
    let top = 0;

    listItemIds.forEach((itemId, index) => {
      const height = itemId.startsWith(DATE_ID_PREFIX)
        ? DATE_HEADER_HEIGHT + (index === 0 ? LIST_TOP_PADDING : 0)
        : getActivityHeight(byId![itemId]);

      itemPositionById[itemId] = { top, height };
      top += height;
    });

    return itemPositionById;
  }, [byId, listItemIds]);

  const currentContainerHeight = useMemo(
    () => {
      if (!viewportIds?.length) return 0;

      const lastViewportId = viewportIds[viewportIds.length - 1];
      const activityOffset = itemPositionById[lastViewportId];

      return activityOffset ? activityOffset.top + activityOffset.height : 0;
    },
    [itemPositionById, viewportIds],
  );

  usePreventScrolledListShift(
    isActive,
    listItemIds,
    itemPositionById,
    isLandscape,
    containerRef,
    hasUserScrolledRef,
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setExtraStyles(container, { height: isLandscape ? '' : `${currentContainerHeight}rem` });
  }, [isLandscape, currentContainerHeight]);

  useEffect(() => {
    if (!isHistoryEndReached && allActivityIds && isActivitiesEmpty) {
      throttledLoadMore();
    }
  }, [allActivityIds, isActivitiesEmpty, isHistoryEndReached, throttledLoadMore]);

  // Reset scroll and scroll tracking when the tab becomes inactive
  useEffect(() => {
    if (!isActive && !isLandscape) {
      resetScroll?.();
      hasUserScrolledRef.current = false;
    }
  }, [isActive, isLandscape, resetScroll]);

  const handleScroll = useLastCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = (e.target as HTMLDivElement).scrollTop;

    hasUserScrolledRef.current = scrollTop >= SCROLL_THRESHOLD;
  });

  const handleActivityClick = useLastCallback((id: string) => {
    showActivityInfo({ id });
  });

  if (!currentAccountId) {
    return undefined;
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
    if (!viewportIds) return undefined;

    return viewportIds.map((itemId, index) => {
      const topOffset = itemPositionById[itemId]?.top ?? 0;
      let itemContent: TeactNode;

      if (itemId.startsWith(DATE_ID_PREFIX)) {
        itemContent = renderDate(
          Number(itemId.slice(DATE_ID_PREFIX.length)),
          itemId === firstListItemId,
        );
      } else {
        const activity = byId?.[itemId];
        if (!activity) return undefined;

        const isActivityActive = activity.id === currentActivityId;
        const isLastInDay = index === viewportIds.length - 1 || viewportIds[index + 1].startsWith(DATE_ID_PREFIX);

        itemContent = (
          <Activity
            activity={activity}
            isLast={isLastInDay}
            isActive={isActivityActive}
            tokensBySlug={tokensBySlug}
            swapTokensBySlug={swapTokensBySlug}
            appTheme={appTheme}
            isSensitiveDataHidden={isSensitiveDataHidden}
            nftsByAddress={nftsByAddress}
            currentAccountId={currentAccountId}
            stakingStateBySlug={stakingStateBySlug}
            savedAddresses={savedAddresses}
            withChainIcon={isMultichainAccount}
            accounts={accounts}
            baseCurrency={baseCurrency}
            onClick={handleActivityClick}
          />
        );
      }

      return (
        <ActivityListItem key={itemId} topOffset={topOffset} withAnimation={shouldUseAnimations}>
          {itemContent}
        </ActivityListItem>
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
      maxHeight={`${currentContainerHeight}rem`}
      onLoadMore={getMore}
      onScroll={handleScroll}
    >
      {renderHistory()}
    </InfiniteScroll>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const accountId = global.currentAccountId;
      const accountState = selectCurrentAccountState(global);
      const accountSettings = selectCurrentAccountSettings(global);
      const isFirstTransactionsLoaded = selectIsFirstTransactionsLoaded(global, global.currentAccountId!);
      const isNewWallet = selectIsNewWallet(global, isFirstTransactionsLoaded);
      const slug = accountState?.currentTokenSlug;
      const stakingStateBySlug = accountId ? selectAccountStakingStatesBySlug(global, accountId) : undefined;
      const {
        idsBySlug, byId, isMainHistoryEndReached, isHistoryEndReachedBySlug, idsMain,
      } = accountState?.activities ?? {};
      const { byAddress } = accountState?.nfts || {};
      const accounts = selectAccounts(global);

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
        theme: global.settings.theme,
        baseCurrency: global.settings.baseCurrency,
        isFirstTransactionsLoaded,
        stakingStateBySlug,
        isSensitiveDataHidden: global.settings.isSensitiveDataHidden,
        nftsByAddress: byAddress,
        accounts,
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

function filterActivityIds(
  allActivityIds: string[] | undefined,
  byId: Record<string, ApiActivity> | undefined,
  slug: string | undefined,
  tokensBySlug: Record<string, ApiTokenWithPrice>,
  areTinyTransfersHidden?: boolean,
  alwaysShownSlugs?: string[],
) {
  if (!allActivityIds || !byId) {
    return [];
  }

  return allActivityIds.filter((id) => {
    const activity = byId?.[id];
    if (!activity) return false;

    if (activity?.shouldHide) return false;

    if (activity?.kind === 'swap') {
      return !slug || activity.from === slug || activity.to === slug;
    } else {
      return activity?.slug
        && (!slug || activity.slug === slug)
        && (
          !areTinyTransfersHidden
          || (slug && tokensBySlug[activity.slug]?.priceUsd === 0)
          || !getIsTinyOrScamTransaction(activity, tokensBySlug[activity.slug])
          || alwaysShownSlugs?.includes(activity.slug)
        )
        && !getIsTransactionWithPoisoning(activity);
    }
  });
}

function addDatesToActivityIds(activityIds: string[], byId: Record<string, ApiActivity> = {}) {
  let lastActivityDayStart = Infinity;
  const listItemIds: string[] = [];

  // Mix-in the date headers to the list of activity ids
  for (const activityId of activityIds) {
    const activityDayStart = getDayStartAt(byId[activityId].timestamp);

    // The clause is not `activityDayStart !== lastActivityDayStart`, because the days can go backwards, which will
    // cause duplicated date Teact keys. The days can go backwards because the pending activities are on the top
    // regardless of their timestamp.
    const isNewDay = activityDayStart < lastActivityDayStart;

    if (isNewDay) {
      lastActivityDayStart = activityDayStart;
      listItemIds.push(`${DATE_ID_PREFIX}${activityDayStart}`);
    }
    listItemIds.push(activityId);
  }

  return listItemIds;
}

/**
 * In order to make the list look stationary after it has been scrolled, this hook compensates the scroll position when
 * new items are added and user scrolled content.
 */
function usePreventScrolledListShift(
  isActive: boolean | undefined,
  listItemIds: string[],
  itemPositionById: Record<string, ItemPosition>,
  isLandscape: boolean,
  containerRef: React.RefObject<HTMLDivElement | undefined>,
  hasUserScrolledRef: React.RefObject<boolean>,
) {
  const prevActivityIdsRef = useRef<string[] | undefined>(listItemIds);
  useEffect(() => {
    prevActivityIdsRef.current = listItemIds;
  }, [listItemIds]);

  useLayoutEffect(() => {
    const container = isLandscape ? containerRef.current : containerRef.current?.closest('.app-slide-content');
    const prevIds = prevActivityIdsRef.current;
    if (!hasUserScrolledRef.current || !container || !prevIds || !listItemIds.length) return;

    // Check if new items were added at the beginning
    const newItemsCount = listItemIds.length - prevIds.length;
    if (newItemsCount <= 0) return;

    let addedHeight = 0;
    for (let i = 0; i < newItemsCount; i++) {
      // The first item is the date which is always on the top, so 1 is added to `i` to skip the date item
      const info = itemPositionById[listItemIds[i + 1]];
      addedHeight += info?.height || 0;
    }

    forceMeasure(() => {
      container.scrollBy({
        top: addedHeight * REM,
        behavior: 'instant',
      });
    });
  }, [listItemIds, itemPositionById, containerRef, hasUserScrolledRef, isActive, isLandscape]);
}
