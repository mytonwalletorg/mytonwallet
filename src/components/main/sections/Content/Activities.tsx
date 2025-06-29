import React, {
  memo, useEffect, useLayoutEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';
import { setExtraStyles } from '../../../../lib/teact/teact-dom';
import { getActions, withGlobal } from '../../../../global';

import type {
  ApiActivity, ApiBaseCurrency, ApiNft, ApiStakingState, ApiSwapAsset, ApiTokenWithPrice,
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

interface ActivityOffsetInfo {
  offset: number;
  height: number;
  isFirst: boolean;
  isFirstInDay: boolean;
  isLastInDay: boolean;
}

const FURTHER_SLICE = 30;
const THROTTLE_TIME = SECOND;

const LIST_TOP_PADDING = 0.5; // rem
const DATE_HEADER_HEIGHT = 2.125; // rem

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
              || (slug && tokensBySlug[activity.slug]?.priceUsd === 0)
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

      let height = getActivityHeight(activity);

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

    setExtraStyles(container, { height: isLandscape ? '' : `${currentContainerHeight}rem` });
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
          style={`top: ${activityInfo.offset}rem`}
          className={buildClassName('ListItem', styles.listItem)}
        >
          {activityInfo.isFirstInDay && renderDate(activity.timestamp, activityInfo.isFirst)}
          <Activity
            activity={activity}
            isLast={activityInfo.isLastInDay}
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
      maxHeight={`${currentContainerHeight}rem`}
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
