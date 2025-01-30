import React, { memo, useMemo, useRef } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { type ApiDapp } from '../../api/types';
import { SettingsState } from '../../global/types';

import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';

import useHorizontalScroll from '../../hooks/useHorizontalScroll';
import useLang from '../../hooks/useLang';

import DappFeedItem from './DappFeedItem';

import styles from './DappFeed.module.scss';
import exploreStyles from './Explore.module.scss';

interface StateProps {
  dapps: ApiDapp[];
  dappLastOpenedDatesByOrigin?: Record<string, number>;
}

type DappWithLastOpenedDate = ApiDapp & { lastOpenedAt?: number };

const MAX_DAPPS_FOR_PILL_MODE = 3;
const HIDDEN_FROM_FEED_DAPP_ORIGINS = new Set(['https://checkin.mytonwallet.org']);

function DappFeed({ dapps: dappsFromState, dappLastOpenedDatesByOrigin = {} }: StateProps) {
  const { openSettingsWithState } = getActions();

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const dapps: DappWithLastOpenedDate[] = useMemo(() => {
    return dappsFromState
      .slice()
      .filter((dapp) => !HIDDEN_FROM_FEED_DAPP_ORIGINS.has(dapp.origin))
      .map((dapp) => ({ ...dapp, lastOpenedAt: dappLastOpenedDatesByOrigin[dapp.origin] }))
      .sort(compareDapps);
  }, [dappLastOpenedDatesByOrigin, dappsFromState]);

  const mode = dapps.length > MAX_DAPPS_FOR_PILL_MODE ? 'tile' : 'pill';
  const isPillMode = mode === 'pill';
  const iconWrapperClassName = isPillMode ? styles.iconPill : styles.iconTile;
  const fullClassName = buildClassName(
    styles.feed,
    isPillMode ? styles.pills : styles.tiles,
    !dapps.length && styles.feedEmpty,
    'dapps-feed',
  );

  function openSettings() {
    openSettingsWithState({ state: SettingsState.Dapps });
  }

  useHorizontalScroll({
    containerRef,
    isDisabled: IS_TOUCH_ENV || dapps.length === 0,
    shouldPreventDefault: true,
    contentSelector: '.dapps-feed',
  });

  if (!dapps.length) {
    return undefined;
  }

  return (
    <div className={styles.root} ref={containerRef}>
      <h2 className={exploreStyles.sectionHeader}>{lang('Connected')}</h2>

      <div className={fullClassName}>
        {dapps?.map((dapp) => renderDapp(dapp, mode))}

        {!!dapps.length && (
          <div
            className={styles.settingsButton}
            role="button"
            tabIndex={0}
            title={isPillMode ? lang('Settings') : undefined}
            aria-label={isPillMode ? lang('Settings') : undefined}
            onClick={openSettings}
          >
            <div className={buildClassName(styles.settingsIconContainer, iconWrapperClassName)}>
              <i className="icon-params" aria-hidden />
            </div>
            {!isPillMode && <span className={styles.settingsLabel}>{lang('Settings')}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { dapps = MEMO_EMPTY_ARRAY } = selectCurrentAccountState(global) || {};
  const { dappLastOpenedDatesByOrigin } = selectCurrentAccountState(global) || {};

  return { dapps, dappLastOpenedDatesByOrigin };
})(DappFeed));

function compareDapps(a: DappWithLastOpenedDate, b: DappWithLastOpenedDate) {
  const aLastOpened = a.lastOpenedAt || 0;
  const bLastOpened = b.lastOpenedAt || 0;

  if (aLastOpened !== bLastOpened) {
    return bLastOpened - aLastOpened;
  }

  return b.connectedAt - a.connectedAt;
}

function renderDapp(dapp: DappWithLastOpenedDate, mode: 'pill' | 'tile') {
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
