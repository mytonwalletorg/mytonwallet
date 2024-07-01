import React, { memo } from '../../lib/teact/teact';

import { vibrate } from '../../util/capacitor';
import { openUrl } from '../../util/openUrl';
import { getHostnameFromUrl } from '../../util/url';

import Image from '../ui/Image';

import styles from '../main/sections/Content/Explore.module.scss';

interface OwnProps {
  url: string;
  icon: string;
  title: string;
  description: string;
  isExternal: boolean;
}

function Site({
  url, icon, title, description, isExternal,
}: OwnProps) {
  function handleClick() {
    vibrate();
    openUrl(url, isExternal, title, getHostnameFromUrl(url));
  }

  return (
    <div
      className={styles.item}
      tabIndex={0}
      role="button"
      onClick={handleClick}
    >
      <Image url={icon} className={styles.imageWrapper} imageClassName={styles.image} />
      <div className={styles.infoWrapper}>
        <b className={styles.title}>{title}</b>
      </div>
      <div className={styles.description}>{description}</div>
    </div>
  );
}

export default memo(Site);
