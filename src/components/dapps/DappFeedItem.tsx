import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';
import { openUrl } from '../../util/openUrl';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Image from '../ui/Image';

import styles from './Dapp.module.scss';

interface OwnProps {
  iconUrl: string;
  name: string;
  url: string;
  mode: 'mini' | 'tile';
  origin: string;
  shouldOpenInAppBrowser: boolean;
}

const RERENDER_DAPPS_FEED_DELAY_MS = 1000;

function DappFeedItem({
  iconUrl,
  name,
  url,
  mode,
  origin,
  shouldOpenInAppBrowser,
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
      <div className={iconClassName}>
        <Image
          url={iconUrl}
          className={iconClassName}
          imageClassName={styles.feedItemLogoImg}
          alt={lang('Icon')}
        />
      </div>
    );
  }

  const openDapp = useLastCallback(async () => {
    await openUrl(url, shouldOpenInAppBrowser);
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
