import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiNft, ApiStakingState } from '../../../../api/types';
import type { DropdownItem } from '../../../ui/Dropdown';
import { ContentTab, SettingsState } from '../../../../global/types';

import {
  IS_CAPACITOR,
  LANDSCAPE_MIN_ASSETS_TAB_VIEW,
  NOTCOIN_VOUCHERS_ADDRESS,
  PORTRAIT_MIN_ASSETS_TAB_VIEW,
} from '../../../../config';
import { requestMutation } from '../../../../lib/fasterdom/fasterdom';
import { getIsActiveStakingState } from '../../../../global/helpers/staking';
import {
  selectAccountStakingStates,
  selectCurrentAccountState,
  selectCurrentAccountTokens,
  selectEnabledTokensCountMemoizedFor,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getStatusBarHeight } from '../../../../util/capacitor';
import { captureEvents, SwipeDirection } from '../../../../util/captureEvents';
import { IS_TOUCH_ENV, STICKY_CARD_INTERSECTION_THRESHOLD } from '../../../../util/windowEnvironment';
import windowSize from '../../../../util/windowSize';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useEffectOnce from '../../../../hooks/useEffectOnce';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useSyncEffect from '../../../../hooks/useSyncEffect';

import CategoryHeader from '../../../explore/CategoryHeader';
import Explore from '../../../explore/Explore';
import TabList from '../../../ui/TabList';
import Transition from '../../../ui/Transition';
import HideNftModal from '../../modals/HideNftModal';
import Activity from './Activities';
import Assets from './Assets';
import NftCollectionHeader from './NftCollectionHeader';
import Nfts from './Nfts';
import NftSelectionHeader from './NftSelectionHeader';

import styles from './Content.module.scss';

interface OwnProps {
  onStakedTokenClick: NoneToVoidFunction;
}

interface StateProps {
  tokensCount: number;
  nfts?: Record<string, ApiNft>;
  currentCollectionAddress?: string;
  selectedAddresses?: string[];
  activeContentTab?: ContentTab;
  blacklistedNftAddresses?: string[];
  whitelistedNftAddresses?: string[];
  states?: ApiStakingState[];
  hasVesting: boolean;
  selectedNftsToHide?: {
    addresses: string[];
    isCollection: boolean;
  };
  currentSiteCategoryId?: number;
}

let activeNftKey = 0;

function Content({
  activeContentTab,
  tokensCount,
  nfts,
  currentCollectionAddress,
  selectedAddresses,
  onStakedTokenClick,
  blacklistedNftAddresses,
  whitelistedNftAddresses,
  selectedNftsToHide,
  states,
  hasVesting,
  currentSiteCategoryId,
}: OwnProps & StateProps) {
  const {
    selectToken,
    showTokenActivity,
    setActiveContentTab,
    openNftCollection,
    closeNftCollection,
    openSettingsWithState,
  } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  // eslint-disable-next-line no-null/no-null
  const tabsRef = useRef<HTMLDivElement>(null);
  const hasNftSelection = Boolean(selectedAddresses?.length);

  const numberOfStaking = useMemo(() => {
    return states?.filter(getIsActiveStakingState).length ?? 0;
  }, [states]);

  useSyncEffect(() => {
    if (currentCollectionAddress) {
      activeNftKey += 1;
    } else {
      activeNftKey = 0;
    }
  }, [currentCollectionAddress]);

  const handleNftCollectionClick = useLastCallback((address: string) => {
    openNftCollection({ address }, { forceOnHeavyAnimation: true });
  });

  const handleNftsMenuButtonClick = useLastCallback((value: string) => {
    if (value === 'hidden_nfts') {
      openSettingsWithState({ state: SettingsState.HiddenNfts });
    } else {
      handleNftCollectionClick(value);
    }
  });

  const nftCollections = useMemo(() => {
    const blacklistedNftAddressesSet = new Set(blacklistedNftAddresses);
    const whitelistedNftAddressesSet = new Set(whitelistedNftAddresses);
    const collections = Object.values(nfts ?? {})
      .filter((nft) => (
        !nft.isHidden || whitelistedNftAddressesSet.has(nft.address)
      ) && !blacklistedNftAddressesSet.has(nft.address))
      .reduce((acc, nft) => {
        if (nft.collectionAddress) {
          acc[nft.collectionAddress] = nft.collectionName || lang('Unnamed collection');
        }

        return acc;
      }, {} as Record<string, string>);
    const collentionAddresses = Object.keys(collections);
    collentionAddresses.sort((left, right) => collections[left].localeCompare(collections[right]));

    return collentionAddresses.map<DropdownItem>((key) => {
      return {
        id: key,
        name: collections[key],
        value: key,
      };
    });
  }, [lang, nfts, blacklistedNftAddresses, whitelistedNftAddresses]);

  const shouldRenderHiddenNftsSection = useMemo(() => {
    const blacklistedAddressesSet = new Set(blacklistedNftAddresses);
    return Object.values(nfts ?? {}).some(
      (nft) => blacklistedAddressesSet.has(nft.address) || nft.isHidden,
    );
  }, [blacklistedNftAddresses, nfts]);

  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);

  const totalTokensAmount = tokensCount + (hasVesting ? 1 : 0) + numberOfStaking;
  const shouldShowSeparateAssetsPanel = totalTokensAmount <= (
    isPortrait ? PORTRAIT_MIN_ASSETS_TAB_VIEW : LANDSCAPE_MIN_ASSETS_TAB_VIEW
  );

  const tabs = useMemo(
    () => [
      ...(
        !shouldShowSeparateAssetsPanel
          ? [{ id: ContentTab.Assets, title: lang('Assets'), className: styles.tab }]
          : []
      ),
      { id: ContentTab.Activity, title: lang('Activity'), className: styles.tab },
      ...(!isPortrait ? [{ id: ContentTab.Explore, title: lang('Explore'), className: styles.tab }] : []),
      {
        id: ContentTab.Nft,
        title: lang('NFT'),
        className: styles.tab,
        menuItems: shouldRenderHiddenNftsSection
          ? [
            ...nftCollections,
            {
              name: lang('Hidden NFTs'),
              value: 'hidden_nfts',
              withSeparator: true,
            } as DropdownItem,
          ]
          : nftCollections,
        onMenuItemClick: handleNftsMenuButtonClick,
      },
      ...(nftCollections.some(({ value }) => value === NOTCOIN_VOUCHERS_ADDRESS) ? [{
        id: ContentTab.NotcoinVouchers,
        title: 'NOT Vouchers',
        className: styles.tab,
      }] : []),
    ],
    [lang, nftCollections, shouldShowSeparateAssetsPanel, shouldRenderHiddenNftsSection, isPortrait],
  );

  const activeTabIndex = useMemo(
    () => {
      const tabIndex = tabs.findIndex((tab) => tab.id === activeContentTab);

      if (tabIndex === -1) {
        return ContentTab.Assets;
      }

      return tabIndex;
    },
    [tabs, activeContentTab],
  );

  useEffectOnce(() => {
    if (activeContentTab === undefined) {
      setActiveContentTab({ tab: ContentTab.Assets });
    }
  });

  const handleSwitchTab = useLastCallback((tab: ContentTab) => {
    if (tab === ContentTab.NotcoinVouchers) {
      selectToken({ slug: undefined }, { forceOnHeavyAnimation: true });
      setActiveContentTab({ tab: ContentTab.Nft });
      handleNftCollectionClick(NOTCOIN_VOUCHERS_ADDRESS);

      return;
    }

    selectToken({ slug: undefined }, { forceOnHeavyAnimation: true });
    setActiveContentTab({ tab });
  });

  useHistoryBack({
    isActive: activeTabIndex !== 0,
    onBack: () => handleSwitchTab(ContentTab.Assets),
  });

  useEffect(() => {
    const stickyElm = tabsRef.current;
    if (!isPortrait || !stickyElm) return undefined;

    const safeAreaTop = IS_CAPACITOR ? getStatusBarHeight() : windowSize.get().safeAreaTop;
    const rootMarginTop = STICKY_CARD_INTERSECTION_THRESHOLD - safeAreaTop - 1;

    const observer = new IntersectionObserver(([e]) => {
      requestMutation(() => {
        e.target.classList.toggle(styles.tabsContainerStuck, e.intersectionRatio < 1);
      });
    }, {
      rootMargin: `${rootMarginTop}px 0px 0px 0px`,
      threshold: [1],
    });
    observer.observe(stickyElm);

    return () => {
      observer.unobserve(stickyElm);
    };
  }, [isPortrait, tabsRef]);

  useEffect(() => {
    if (!IS_TOUCH_ENV) {
      return undefined;
    }

    return captureEvents(transitionRef.current!, {
      includedClosestSelector: '.swipe-container',
      excludedClosestSelector: '.dapps-feed',
      onSwipe: (e, direction) => {
        if (direction === SwipeDirection.Left) {
          const tab = tabs[Math.min(tabs.length - 1, activeTabIndex + 1)];
          handleSwitchTab(tab.id);
          return true;
        } else if (direction === SwipeDirection.Right) {
          if (currentCollectionAddress) {
            closeNftCollection();
          } else {
            const tab = tabs[Math.max(0, activeTabIndex - 1)];
            handleSwitchTab(tab.id);
          }
          return true;
        }

        return false;
      },
      selectorToPreventScroll: '.custom-scroll',
    });
  }, [tabs, handleSwitchTab, activeTabIndex, currentCollectionAddress]);

  const handleClickAsset = useLastCallback((slug: string) => {
    showTokenActivity({ slug });
  });

  const containerClassName = buildClassName(
    styles.container,
    IS_TOUCH_ENV && 'swipe-container',
    isPortrait ? styles.portraitContainer : styles.landscapeContainer,
  );

  function renderTabsPanel() {
    if (hasNftSelection) {
      return <NftSelectionHeader />;
    }

    if (!isPortrait && currentSiteCategoryId) {
      return <CategoryHeader id={currentSiteCategoryId} />;
    }

    return currentCollectionAddress ? <NftCollectionHeader key="collection" /> : (
      <TabList
        tabs={tabs}
        activeTab={activeTabIndex}
        onSwitchTab={handleSwitchTab}
        className={buildClassName(styles.tabs, 'content-tabslist')}
      />
    );
  }

  function renderCurrentTab(isActive: boolean) {
    // When assets are shown separately, there is effectively no tab with index 0,
    // so we fall back to next tab to not break parent's component logic.
    if (activeTabIndex === 0 && shouldShowSeparateAssetsPanel) {
      return <Activity isActive={isActive} totalTokensAmount={totalTokensAmount} />;
    }

    switch (tabs[activeTabIndex].id) {
      case ContentTab.Assets:
        return <Assets isActive={isActive} onTokenClick={handleClickAsset} onStakedTokenClick={onStakedTokenClick} />;
      case ContentTab.Activity:
        return <Activity isActive={isActive} totalTokensAmount={totalTokensAmount} />;
      case ContentTab.Nft:
        return (
          <Transition
            activeKey={activeNftKey}
            name={isPortrait ? 'slide' : 'slideFade'}
            className="nfts-container"
          >
            <Nfts key={currentCollectionAddress || 'all'} isActive={isActive} />
          </Transition>
        );
      case ContentTab.Explore:
        return <Explore isActive={isActive} />;
      default:
        return undefined;
    }
  }

  function renderContent() {
    const activeKey = hasNftSelection || (!isPortrait && currentSiteCategoryId)
      ? 2
      : (currentCollectionAddress ? 1 : 0);

    return (
      <>
        <div ref={tabsRef} className={styles.tabsContainer}>
          <Transition activeKey={activeKey} name="slideFade" className={styles.tabsContent}>
            {renderTabsPanel()}
          </Transition>
        </div>
        <Transition
          ref={transitionRef}
          name={isPortrait ? 'slide' : 'slideFade'}
          activeKey={activeTabIndex}
          renderCount={tabs.length}
          className={buildClassName(styles.slides, 'content-transition')}
          slideClassName={buildClassName(styles.slide, 'custom-scroll')}
        >
          {renderCurrentTab}
        </Transition>
      </>
    );
  }

  return (
    <div className={containerClassName}>
      {shouldShowSeparateAssetsPanel && (
        <div className={styles.assetsPanel}>
          <Assets
            isActive
            isSeparatePanel
            onStakedTokenClick={onStakedTokenClick}
            onTokenClick={handleClickAsset}
          />
        </div>
      )}
      <div className={buildClassName(isPortrait ? styles.contentPanel : styles.landscapeContentPanel)}>
        {renderContent()}
      </div>
      <HideNftModal
        isOpen={Boolean(selectedNftsToHide?.addresses.length)}
        selectedNftsToHide={selectedNftsToHide}
      />

    </div>
  );
}

export default memo(
  withGlobal<OwnProps>(
    (global): StateProps => {
      const accountId = global.currentAccountId;
      const {
        activeContentTab,
        blacklistedNftAddresses,
        whitelistedNftAddresses,
        selectedNftsToHide,
        vesting,
        nfts: {
          byAddress: nfts,
          currentCollectionAddress,
          selectedAddresses,
        } = {},
        currentSiteCategoryId,
      } = selectCurrentAccountState(global) ?? {};

      const tokens = selectCurrentAccountTokens(global);
      const tokensCount = selectEnabledTokensCountMemoizedFor(global.currentAccountId!)(tokens);
      const hasVesting = Boolean(vesting?.info?.length);
      const states = accountId ? selectAccountStakingStates(global, accountId) : undefined;

      return {
        nfts,
        currentCollectionAddress,
        selectedAddresses,
        tokensCount,
        activeContentTab,
        blacklistedNftAddresses,
        whitelistedNftAddresses,
        selectedNftsToHide,
        states,
        hasVesting,
        currentSiteCategoryId,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Content),
);
