import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiSite } from '../../../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX } from '../../../../config';
import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { vibrate } from '../../../../util/capacitor';
import { openUrl } from '../../../../util/openUrl';
import stopEvent from '../../../../util/stopEvent';
import { getHostnameFromUrl, isValidUrl } from '../../../../util/url';
import { IS_ANDROID, IS_ANDROID_APP, IS_IOS_APP } from '../../../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Site from '../../../explore/Site';
import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Loading from '../../../ui/Loading';
import Menu from '../../../ui/Menu';
import MenuItem from '../../../ui/MenuItem';

import styles from './Explore.module.scss';

interface OwnProps {
  isActive?: boolean;
}

interface StateProps {
  sites?: ApiSite[];
  shouldRestrict: boolean;
  browserHistory?: string[];
}

const SUGGESTIONS_OPEN_DELAY = 300;
const GOOGLE_SEARCH_URL = 'https://www.google.com/search?q=';

function Explore({
  isActive, sites, shouldRestrict, browserHistory,
}: OwnProps & StateProps) {
  const {
    loadExploreSites,
    getDapps,
    addSiteToBrowserHistory,
    removeSiteFromBrowserHistory,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line no-null/no-null
  const suggestionsTimeoutRef = useRef<number>(null);
  const lang = useLang();
  const { isLandscape } = useDeviceScreen();
  const [searchValue, setSearchValue] = useState<string>('');
  const [isSuggestionsVisible, showSuggestions, hideSuggestions] = useFlag(false);
  const filteredBrowserHistory = useMemo(() => {
    const result = browserHistory?.filter((url) => url.toLowerCase().includes(searchValue.toLowerCase()));

    return result?.length ? result : undefined;
  }, [browserHistory, searchValue]);
  const renderingBrowserHistory = useCurrentOrPrev(filteredBrowserHistory, true);

  const openSite = (originalUrl: string, isExternal?: boolean, title?: string) => {
    let url = originalUrl;
    if (!url.startsWith('http:') && !url.startsWith('https:')) {
      url = `https://${url}`;
    }
    if (!isValidUrl(url)) {
      url = `${GOOGLE_SEARCH_URL}${encodeURIComponent(originalUrl)}`;
    } else {
      addSiteToBrowserHistory({ url });
    }

    openUrl(url, isExternal, title, getHostnameFromUrl(url));
  };

  const handleSiteClick = useLastCallback((
    e: React.SyntheticEvent<HTMLDivElement | HTMLAnchorElement>,
    url: string,
  ) => {
    vibrate();
    hideSuggestions();
    const site = sites?.find(({ url: currentUrl }) => currentUrl === url);
    openSite(url, site?.isExternal, site?.name);
  });

  const handleSiteClear = (e: React.MouseEvent, url: string) => {
    stopEvent(e);

    removeSiteFromBrowserHistory({ url });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
  };

  const handleFocus = () => {
    if (!filteredBrowserHistory?.length) return;

    // Simultaneous opening of the virtual keyboard and display of Saved Addresses causes animation degradation
    if (IS_ANDROID) {
      suggestionsTimeoutRef.current = window.setTimeout(showSuggestions, SUGGESTIONS_OPEN_DELAY);
    } else {
      showSuggestions();
    }
  };

  const handleBlur = () => {
    if (!isSuggestionsVisible) return;

    hideSuggestions();
    if (suggestionsTimeoutRef.current) {
      window.clearTimeout(suggestionsTimeoutRef.current);
    }
  };

  const handleMenuClose = useLastCallback(() => {
    inputRef.current?.blur();
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    stopEvent(e);

    handleMenuClose();
    openSite(searchValue);
    setSearchValue('');
  };

  useEffect(() => {
    if (!isActive) return;

    getDapps();
    loadExploreSites();
  }, [isActive]);

  function renderSearch() {
    return (
      <form action="#" onSubmit={handleSubmit} className={styles.searchWrapper} autoComplete="off">
        <i className={buildClassName(styles.searchIcon, 'icon-search')} aria-hidden />
        <input
          ref={inputRef}
          name="explore-search"
          className={styles.searchInput}
          placeholder={lang('Search or enter address...')}
          value={searchValue}
          autoCapitalize="off"
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </form>
    );
  }

  function renderSearchSuggestions() {
    return (
      <Menu
        type="suggestion"
        noBackdrop
        isOpen={Boolean(isSuggestionsVisible && filteredBrowserHistory?.length)}
        className={styles.suggestions}
        bubbleClassName={styles.suggestionsMenu}
        onClose={handleMenuClose}
      >
        {renderingBrowserHistory?.map((url) => (
          <MenuItem key={url} className={styles.suggestion} onClick={handleSiteClick} clickArg={url}>
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
      </Menu>
    );
  }

  if (sites === undefined) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}>
        <Loading />
      </div>
    );
  }

  if (sites.length === 0) {
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
    <div className={styles.wrapper}>
      {renderSearch()}
      {renderSearchSuggestions()}
      <div className={buildClassName(styles.list, isLandscape && styles.landscapeList)}>
        {sites.filter((site) => !(shouldRestrict && site.canBeRestricted)).map((site) => (
          <Site
            key={site.url}
            url={site.url}
            icon={site.icon}
            title={site.name}
            description={site.description}
            isExternal={site.isExternal}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { browserHistory } = selectCurrentAccountState(global) || {};
  return {
    sites: global.exploreSites,
    shouldRestrict: global.restrictions.isLimitedRegion && (IS_IOS_APP || IS_ANDROID_APP),
    browserHistory,
  };
})(Explore));
