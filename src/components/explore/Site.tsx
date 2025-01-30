import React, { memo } from '../../lib/teact/teact';

import type { ApiSite } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { openUrl } from '../../util/openUrl';
import { getHostnameFromUrl } from '../../util/url';

import Image from '../ui/Image';

import styles from './Explore.module.scss';

interface OwnProps {
  site: ApiSite;
  isTrending?: boolean;
  className?: string;
}

function Site({
  site: {
    url, icon, name, description, isExternal, extendedIcon, withBorder, badgeText,
  },
  isTrending,
  className,
}: OwnProps) {
  function handleClick() {
    void vibrate();
    void openUrl(url, isExternal, name, getHostnameFromUrl(url));
  }

  return (
    <div
      className={buildClassName(
        styles.item,
        (extendedIcon && isTrending) && styles.extended,
        isTrending && styles.trending,
        withBorder && styles.withBorder,
        className,
      )}
      tabIndex={0}
      role="button"
      onClick={handleClick}
    >
      <Image
        url={extendedIcon && isTrending ? extendedIcon : icon}
        className={buildClassName(styles.imageWrapper, !isTrending && styles.imageWrapperScaleable)}
        imageClassName={styles.image}
      />
      <div className={styles.infoWrapper}>
        <b className={styles.title}>{name}</b>
        <div className={styles.description}>{description}</div>
      </div>
      {badgeText && <div className={styles.badge}>{badgeText}</div>}
    </div>
  );
}

export default memo(Site);
