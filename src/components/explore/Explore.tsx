import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiSite, ApiSiteCategory } from '../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX } from '../../config';
import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { openUrl } from '../../util/openUrl';
import resolveSlideTransitionName from '../../util/resolveSlideTransitionName';
import stopEvent from '../../util/stopEvent';
import { captureControlledSwipe } from '../../util/swipeController';
import { getHostnameFromUrl, isValidUrl } from '../../util/url';
import {
  IS_ANDROID, IS_ANDROID_APP, IS_IOS_APP, IS_TOUCH_ENV,
} from '../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useFlag from '../../hooks/useFlag';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import usePrevious2 from '../../hooks/usePrevious2';
import useScrolledState from '../../hooks/useScrolledState';
import { useStateRef } from '../../hooks/useStateRef';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import Spinner from '../ui/Spinner';
import Transition from '../ui/Transition';
import Category from './Category';
import DappFeed from './DappFeed';
import Site from './Site';
import SiteList from './SiteList';

import styles from './Explore.module.scss';

interface OwnProps {
  isActive?: boolean;
}

interface StateProps {
  categories?: ApiSiteCategory[];
  sites?: ApiSite[];
  shouldRestrict: boolean;
  browserHistory?: string[];
  currentSiteCategoryId?: number;
}

interface SearchSuggestions {
  history?: string[];
  sites?: ApiSite[];
  isEmpty: boolean;
}

const SUGGESTIONS_OPEN_DELAY = 300;
const GOOGLE_SEARCH_URL = 'https://www.google.com/search?q=';
const enum SLIDES {
  main,
  category,
}

function Explore({
  isActive, categories, sites: originalSites, shouldRestrict, browserHistory, currentSiteCategoryId,
}: OwnProps & StateProps) {
  const {
    loadExploreSites,
    getDapps,
    addSiteToBrowserHistory,
    removeSiteFromBrowserHistory,
    openSiteCategory,
    closeSiteCategory,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsTimeoutRef = useRef<number | undefined>(undefined);
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const trendingContainerRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const { isLandscape, isPortrait } = useDeviceScreen();
  const [searchValue, setSearchValue] = useState<string>('');
  const [isSearchFocused, markSearchFocused, unmarkSearchFocused] = useFlag(false);
  const [isSuggestionsVisible, showSuggestions, hideSuggestions] = useFlag(false);
  const prevSiteCategoryIdRef = useStateRef(usePrevious2(currentSiteCategoryId));

  const {
    handleScroll: handleContentScroll,
    isScrolled,
  } = useScrolledState();

  useEffect(
    () => (currentSiteCategoryId ? captureEscKeyListener(closeSiteCategory) : undefined),
    [closeSiteCategory, currentSiteCategoryId],
  );

  const filteredSites = useMemo(() => {
    return shouldRestrict
      ? originalSites?.filter((site) => !site.canBeRestricted)
      : originalSites;
  }, [originalSites, shouldRestrict]);

  const searchSuggestions = useMemo<SearchSuggestions>(() => {
    const search = searchValue.toLowerCase();
    const historyResult = browserHistory?.filter((url) => url.toLowerCase().includes(search));
    const sitesResult = search.length && filteredSites
      ? filteredSites.filter(({ url, name, description }) => {
        return url.toLowerCase().includes(search)
          || name.toLowerCase().includes(search)
          || description.toLowerCase().includes(search);
      })
      : undefined;

    return {
      history: historyResult,
      sites: sitesResult,
      isEmpty: (historyResult?.length || 0) + (sitesResult?.length || 0) === 0,
    };
  }, [browserHistory, searchValue, filteredSites]);

  const { trendingSites, allSites } = useMemo(() => {
    return (filteredSites || []).reduce((acc, site) => {
      if (site.isFeatured) {
        acc.trendingSites.push(site);
      }

      if (!acc.allSites[site.categoryId!]) {
        acc.allSites[site.categoryId!] = [];
      }
      acc.allSites[site.categoryId!].push(site);

      return acc;
    }, { trendingSites: [] as ApiSite[], allSites: {} as Record<number, ApiSite[]> });
  }, [filteredSites]);

  useEffect(() => {
    if (!IS_TOUCH_ENV || !filteredSites?.length || !currentSiteCategoryId) {
      return undefined;
    }

    return captureControlledSwipe(transitionRef.current!, {
      onSwipeRightStart: closeSiteCategory,
      onCancel: () => {
        openSiteCategory({ id: prevSiteCategoryIdRef.current! });
      },
    });
  }, [currentSiteCategoryId, filteredSites?.length, prevSiteCategoryIdRef]);

  useHorizontalScroll({
    containerRef: trendingContainerRef,
    isDisabled: IS_TOUCH_ENV || trendingSites.length === 0,
    shouldPreventDefault: true,
    contentSelector: `.${styles.trendingList}`,
  });

  const filteredCategories = useMemo(() => {
    return categories?.filter((category) => allSites[category.id]?.length > 0);
  }, [categories, allSites]);

  useEffect(() => {
    if (!isActive) return;

    getDapps();
    loadExploreSites({ isLandscape });
  }, [isActive, isLandscape]);

  const safeShowSuggestions = useLastCallback(() => {
    if (searchSuggestions.isEmpty) return;

    // Simultaneous opening of the virtual keyboard and display of Saved Addresses causes animation degradation
    if (IS_ANDROID) {
      suggestionsTimeoutRef.current = window.setTimeout(showSuggestions, SUGGESTIONS_OPEN_DELAY);
    } else {
      showSuggestions();
    }
  });

  const safeHideSuggestions = useLastCallback(() => {
    if (isSuggestionsVisible) {
      hideSuggestions();
    }
    window.clearTimeout(suggestionsTimeoutRef.current);
  });

  useEffectWithPrevDeps(([prevIsSearchFocused]) => {
    if ((prevIsSearchFocused && !isSearchFocused) || searchSuggestions.isEmpty) {
      safeHideSuggestions();
    }
    if (isSearchFocused && !searchSuggestions.isEmpty) {
      safeShowSuggestions();
    }
  }, [isSearchFocused, searchSuggestions.isEmpty]);

  function openSite(originalUrl: string, isExternal?: boolean, title?: string) {
    let url = originalUrl;
    if (!url.startsWith('http:') && !url.startsWith('https:')) {
      url = `https://${url}`;
    }
    if (!isValidUrl(url)) {
      url = `${GOOGLE_SEARCH_URL}${encodeURIComponent(originalUrl)}`;
    } else {
      addSiteToBrowserHistory({ url });
    }

    void openUrl(url, isExternal, title, getHostnameFromUrl(url));
  }

  const handleSiteClick = useLastCallback((
    e: React.SyntheticEvent<HTMLDivElement | HTMLAnchorElement>,
    url: string,
  ) => {
    vibrate();
    hideSuggestions();
    const site = originalSites?.find(({ url: currentUrl }) => currentUrl === url);
    openSite(url, site?.isExternal, site?.name);
  });

  function handleSiteClear(e: React.MouseEvent, url: string) {
    stopEvent(e);

    removeSiteFromBrowserHistory({ url });
  }

  function handleSearchValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSearchValue(e.target.value);
  }

  const handleMenuClose = useLastCallback(() => {
    inputRef.current?.blur();
  });

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    stopEvent(e);

    handleMenuClose();
    openSite(searchValue);
    setSearchValue('');
  }

  function renderSearch() {
    return (
      <form action="#" onSubmit={handleSearchSubmit} className={styles.searchContainer} autoComplete="off">
        <i className={buildClassName(styles.searchIcon, 'icon-search')} aria-hidden />
        <input
          name="explore-search"
          className={styles.searchInput}
          placeholder={lang('Search or enter address')}
          value={searchValue}
          autoCapitalize="none"
          type="url"
          autoCorrect="off"
          onChange={handleSearchValueChange}
          onFocus={markSearchFocused}
          onBlur={unmarkSearchFocused}
        />
      </form>
    );
  }

  function renderSearchSuggestions() {
    return (
      <Menu
        type="suggestion"
        noBackdrop
        isOpen={Boolean(isSuggestionsVisible && !searchSuggestions.isEmpty)}
        className={styles.suggestions}
        bubbleClassName={styles.suggestionsMenu}
        onClose={handleMenuClose}
      >
        {searchSuggestions?.history?.map((url) => (
          <MenuItem key={`history-${url}`} className={styles.suggestion} onClick={handleSiteClick} clickArg={url}>
            <i
              className={buildClassName(styles.suggestionIcon, searchValue.length ? 'icon-search' : 'icon-globe')}
              aria-hidden
            />
            <span className={styles.suggestionAddress}>{getHostnameFromUrl(url)}</span>

            <button
              className={styles.clearSuggestion}
              type="button"
              aria-label={lang('Clear')}
              title={lang('Clear')}
              onMouseDown={(e) => handleSiteClear(e, url)}
              onClick={stopEvent}
            >
              <i className="icon-close" aria-hidden />
            </button>
          </MenuItem>
        ))}
        {searchSuggestions?.sites?.map((site) => (
          <Site key={`site-${site.url}-${site.name}`} className={styles.suggestion} site={site} />
        ))}
      </Menu>
    );
  }

  function renderTrending() {
    return (
      <div ref={trendingContainerRef} className={styles.trendingSection}>
        <h2 className={styles.sectionHeader}>{lang('Trending')}</h2>
        <div className={styles.trendingList}>
          {trendingSites.map((site) => (
            <Site key={`${site.url}-${site.name}`} site={site} isTrending />
          ))}
        </div>
      </div>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isContentActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case SLIDES.main:
        return (
          <div
            className={buildClassName(styles.slide, 'custom-scroll')}
            onScroll={isPortrait ? handleContentScroll : undefined}
          >
            <div className={buildClassName(styles.searchWrapper, 'with-notch-on-scroll', isScrolled && 'is-scrolled')}>
              {renderSearch()}
              {renderSearchSuggestions()}
            </div>

            <DappFeed />

            {Boolean(trendingSites.length) && renderTrending()}

            {Boolean(filteredCategories?.length) && (
              <>
                <h2 className={styles.sectionHeader}>{lang('All Dapps')}</h2>
                <div className={buildClassName(styles.list, isLandscape && styles.landscapeList)}>
                  {filteredCategories.map((category) => (
                    <Category key={category.id} category={category} sites={allSites[category.id]} />
                  ))}
                </div>
              </>
            )}
          </div>
        );

      case SLIDES.category: {
        const currentSiteCategory = allSites[currentSiteCategoryId!];
        if (!currentSiteCategory) return undefined;

        return (
          <SiteList
            key={currentSiteCategoryId}
            isActive={isContentActive}
            categoryId={currentSiteCategoryId!}
            sites={currentSiteCategory}
          />
        );
      }
    }
  }

  if (filteredSites === undefined) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}>
        <Spinner />
      </div>
    );
  }

  if (filteredSites.length === 0) {
    return (
      <div className={styles.emptyList}>
        <AnimatedIconWithPreview
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.happy}
          previewUrl={ANIMATED_STICKERS_PATHS.happyPreview}
          size={ANIMATED_STICKER_BIG_SIZE_PX}
          className={styles.sticker}
          noLoop={false}
          nonInteractive
        />
        <p className={styles.emptyListTitle}>{lang('No partners yet')}</p>
      </div>
    );
  }

  return (
    <Transition
      ref={transitionRef}
      name={resolveSlideTransitionName()}
      activeKey={currentSiteCategoryId ? SLIDES.category : SLIDES.main}
      className={styles.rootSlide}
    >
      {renderContent}
    </Transition>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { browserHistory, currentSiteCategoryId } = selectCurrentAccountState(global) || {};
  const { categories, sites } = global.exploreData || {};

  return {
    sites,
    categories,
    shouldRestrict: global.restrictions.isLimitedRegion && (IS_IOS_APP || IS_ANDROID_APP),
    browserHistory,
    currentSiteCategoryId,
  };
})(Explore));
