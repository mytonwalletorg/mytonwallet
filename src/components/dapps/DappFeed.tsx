import React, { memo, useMemo, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { type ApiDapp } from '../../api/types';
import { SettingsState } from '../../global/types';

import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';

import DappFeedItem from './DappFeedItem';

import styles from './Dapp.module.scss';

interface StateProps {
  dapps: ApiDapp[];
  dappLastOpenedDatesByOrigin?: Record<string, number>;
}

type DappWithLastOpenedDate = ApiDapp & { lastOpenedAt?: number };

function compareDapps(a: DappWithLastOpenedDate, b: DappWithLastOpenedDate) {
  const aLastOpened = a.lastOpenedAt || 0;
  const bLastOpened = b.lastOpenedAt || 0;

  if (aLastOpened !== bLastOpened) {
    return bLastOpened - aLastOpened;
  }

  return b.connectedAt - a.connectedAt;
}

const MAX_DAPPS_FOR_MINI_MODE = 3;

const HIDDEN_FROM_FEED_DAPP_ORIGINS = new Set(['https://checkin.mytonwallet.org']);

function DappFeed({ dapps: dappsFromState, dappLastOpenedDatesByOrigin = {} }: StateProps) {
  const { openSettingsWithState } = getActions();

  const dapps: DappWithLastOpenedDate[] = useMemo(() => {
    return dappsFromState.slice().filter((dapp) => !HIDDEN_FROM_FEED_DAPP_ORIGINS.has(dapp.origin)).map(
      (dapp) => ({ ...dapp, lastOpenedAt: dappLastOpenedDatesByOrigin[dapp.origin] }),
    ).sort(compareDapps);
  }, [dappLastOpenedDatesByOrigin, dappsFromState]);

  const mode = dapps.length > MAX_DAPPS_FOR_MINI_MODE ? 'tile' : 'mini';

  const lang = useLang();

  function openSettings() {
    openSettingsWithState({ state: SettingsState.Dapps });
  }

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  useHorizontalScroll({
    containerRef,
    isDisabled: dapps.length === 0,
    shouldPreventDefault: true,
    contentSelector: '.dapps-feed',
  });

  const isMiniMode = mode === 'mini';
  const iconWrapperClassName = isMiniMode ? styles.feedSettingsIconWrapperMini : styles.feedSettingsIconWrapperTile;

  function renderDapp(dapp: DappWithLastOpenedDate) {
    const {
      iconUrl, name, url, origin,
    } = dapp;

    return (
      <DappFeedItem
        key={origin}
        iconUrl={iconUrl}
        name={name}
        url={url}
        mode={mode}
        origin={origin}
      />
    );
  }

  return (
    <div
      className={
        buildClassName(
          styles.feed, isMiniMode ? styles.feedMini : styles.feedTiles, !dapps.length && styles.feedEmpty, 'dapps-feed',
        )
      }
    >
      {dapps?.map(renderDapp)}
      {!!dapps.length && (
        <div
          className={styles.feedSettingsIconContainer}
          onClick={openSettings}
          title={isMiniMode ? lang('Settings') : undefined}
        >
          <div className={buildClassName(styles.feedSettingsIconWrapper, iconWrapperClassName)}>
            <i className="icon-params" aria-hidden />
          </div>
          {!isMiniMode && <span className={styles.feedSettingsLabel}>{lang('Settings')}</span>}
        </div>
      )}
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { dapps = MEMO_EMPTY_ARRAY } = selectCurrentAccountState(global) || {};
  const { dappLastOpenedDatesByOrigin } = selectCurrentAccountState(global) || {};
  return { dapps, dappLastOpenedDatesByOrigin };
})(DappFeed));
