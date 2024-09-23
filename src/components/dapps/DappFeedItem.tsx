import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';
import { openUrl } from '../../util/openUrl';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import styles from './Dapp.module.scss';

interface OwnProps {
  iconUrl: string;
  name: string;
  url: string;
  mode: 'mini' | 'tile';
  origin: string;
}

const RERENDER_DAPPS_FEED_DELAY_MS = 300;

const POPULAR_TELEGRAM_DAPPS_BY_URL: Record<string, string> = {
  'https://onetime.dog': 'https://t.me/dogshouse_bot/join', // https://cdn.onetime.dog/manifest.json
  'https://hamsterkombatgame.io/': 'https://t.me/hamster_kombaT_bot/start', // https://hamsterkombatgame.io/tonconnect-manifest.json
};

function DappFeedItem({
  iconUrl,
  name,
  url,
  mode,
  origin,
}: OwnProps) {
  const { updateDappLastOpenedAt } = getActions();
  const lang = useLang();

  function renderIcon() {
    const iconClassName = mode === 'mini' ? styles.feedItemLogoMini : styles.feedItemLogoTile;
    if (!iconUrl) {
      return (
        <div className={buildClassName(styles.dappLogo, styles.dappLogo_icon, iconClassName)}>
          <i className={buildClassName(styles.dappIcon, 'icon-laptop')} aria-hidden />
        </div>
      );
    }

    return (
      <img
        src={iconUrl}
        alt={lang('Logo')}
        className={iconClassName}
      />
    );
  }

  const openDapp = useLastCallback(async () => {
    const matchedUrl = POPULAR_TELEGRAM_DAPPS_BY_URL[url];
    if (matchedUrl) {
      await openUrl(matchedUrl, true);
    } else {
      await openUrl(url);
    }
    setTimeout(() => void updateDappLastOpenedAt({ origin }), RERENDER_DAPPS_FEED_DELAY_MS);
  });

  return (
    <button
      className={buildClassName(styles.feedItem, mode === 'mini' ? styles.feedItemMini : styles.feedItemTile)}
      onClick={openDapp}
      type="button"
    >
      {renderIcon()}
      <span className={mode === 'mini' ? styles.feedItemAppNameMini : styles.feedItemAppNameTile}>{name}</span>
    </button>
  );
}

export default memo(DappFeedItem);
