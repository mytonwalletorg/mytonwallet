import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';
import { SECOND } from '../../util/dateFormat';
import { openUrl } from '../../util/openUrl';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Image from '../ui/Image';

import dappStyles from '../dapps/Dapp.module.scss';
import styles from './DappFeed.module.scss';

interface OwnProps {
  iconUrl: string;
  name: string;
  url: string;
  mode: 'pill' | 'tile';
}

const RERENDER_DAPPS_FEED_DELAY_MS = SECOND;

const POPULAR_DAPP_URL_REPLACEMENTS = [{
  name: 'Fanzee Battles',
  manifestUrl: 'https://battles-tg-app.fanz.ee/tc-manifest.json',
  originalUrl: 'https://t.me/fanzeebattlesbot',
  replacementUrl: 'https://t.me/battlescryptobot?start=myTonWallet',
}, {
  name: 'Hamster Kombat',
  manifestUrl: 'https://hamsterkombatgame.io/tonconnect-manifest.json',
  originalUrl: 'https://hamsterkombatgame.io/',
  replacementUrl: 'https://t.me/hamster_kombat_bot/start',
}, {
  name: 'Dogs',
  manifestUrl: 'https://cdn.onetime.dog/manifest.json',
  originalUrl: 'https://onetime.dog',
  replacementUrl: 'https://t.me/dogshouse_bot/join',
}, {
  name: 'Earn',
  manifestUrl: 'https://cdn.joincommunity.xyz/earn/manifest.json',
  originalUrl: 'https://earncommunity.xyz',
  replacementUrl: 'https://t.me/earn?startapp',
}];

const REPLACEMENTS_BY_URL = POPULAR_DAPP_URL_REPLACEMENTS.reduce(
  (acc: Record<string, string>, { originalUrl, replacementUrl }) => {
    acc[originalUrl] = replacementUrl;

    return acc;
  }, {},
);

function DappFeedItem({
  iconUrl,
  name,
  url,
  mode,
}: OwnProps) {
  const { updateDappLastOpenedAt } = getActions();

  const lang = useLang();

  function renderIcon() {
    const iconClassName = mode === 'pill' ? styles.iconPill : styles.iconTile;

    if (!iconUrl) {
      return (
        <div className={buildClassName(dappStyles.dappLogo, dappStyles.dappLogo_icon, iconClassName)}>
          <i className={buildClassName(dappStyles.dappIcon, 'icon-laptop')} aria-hidden />
        </div>
      );
    }

    return (
      <div className={iconClassName}>
        <Image
          url={iconUrl}
          className={iconClassName}
          imageClassName={styles.icon}
          alt={lang('Icon')}
        />
      </div>
    );
  }

  const openDapp = useLastCallback(async () => {
    await openUrl(REPLACEMENTS_BY_URL[url] || url);

    setTimeout(() => void updateDappLastOpenedAt({ url }), RERENDER_DAPPS_FEED_DELAY_MS);
  });

  return (
    <button
      type="button"
      className={buildClassName(styles.dapp, mode === 'pill' ? styles.dappPill : styles.dappTile)}
      onClick={openDapp}
    >
      {renderIcon()}
      <span className={styles.dappName}>{name}</span>
    </button>
  );
}

export default memo(DappFeedItem);
