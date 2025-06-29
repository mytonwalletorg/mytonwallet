import React, { memo } from '../../lib/teact/teact';

import type { SearchSuggestions } from './helpers/utils';

import buildClassName from '../../util/buildClassName';
import { stopEvent } from '../../util/domEvents';
import { getHostnameFromUrl } from '../../util/url';

import useLang from '../../hooks/useLang';

import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import Site from './Site';

import styles from './Explore.module.scss';

interface OwnProps {
  isSuggestionsVisible: boolean;
  searchSuggestions: SearchSuggestions;
  searchValue: string;
  onSiteClick: (e: React.SyntheticEvent<HTMLDivElement | HTMLAnchorElement>, url: string) => void;
  onSiteClear: (e: React.MouseEvent, url: string) => void;
  onClose: NoneToVoidFunction;
}

function ExploreSearchSuggestions({
  isSuggestionsVisible,
  searchSuggestions,
  searchValue,
  onSiteClick,
  onSiteClear,
  onClose,
}: OwnProps) {
  const lang = useLang();

  return (
    <Menu
      type="suggestion"
      noBackdrop
      isOpen={Boolean(isSuggestionsVisible && !searchSuggestions.isEmpty)}
      className={styles.suggestions}
      bubbleClassName={styles.suggestionsMenu}
      onClose={onClose}
    >
      {searchSuggestions?.history?.map((url) => (
        <MenuItem key={`history-${url}`} className={styles.suggestion} onClick={onSiteClick} clickArg={url}>
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
            onMouseDown={(e) => onSiteClear(e, url)}
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

export default memo(ExploreSearchSuggestions);
