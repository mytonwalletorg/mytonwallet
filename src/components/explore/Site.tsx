import React, { memo } from '../../lib/teact/teact';

import type { ApiSite } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { openUrl } from '../../util/openUrl';
import { getHostnameFromUrl } from '../../util/url';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';

import Image from '../ui/Image';

import styles from '../main/sections/Content/Explore.module.scss';

interface OwnProps {
  site: ApiSite;
  index: number;
}

const ROW_LENGTH_PORTRAIT = 2;
const ROW_LENGTH_LANDSCAPE = 3;

function Site({
  site: {
    url, icon, name, description, isExternal, extendedIcon, badgeText, withBorder,
  },
  index,
}: OwnProps) {
  const { isLandscape } = useDeviceScreen();
  const canBeExtended = index % (isLandscape ? ROW_LENGTH_LANDSCAPE : ROW_LENGTH_PORTRAIT) === 0;

  function handleClick() {
    vibrate();
    openUrl(url, isExternal, name, getHostnameFromUrl(url));
  }

  return (
    <div
      className={buildClassName(
        styles.item,
        (extendedIcon && canBeExtended) && styles.extended,
        withBorder && styles.withBorder,
      )}
      tabIndex={0}
      role="button"
      onClick={handleClick}
    >
      {badgeText && <div className={styles.badge}>{badgeText}</div>}
      <Image
        url={extendedIcon && canBeExtended ? extendedIcon : icon}
        className={styles.imageWrapper}
        imageClassName={styles.image}
      />
      <div className={styles.infoWrapper}>
        <b className={styles.title}>{name}</b>
      </div>
      <div className={styles.description}>{description}</div>
    </div>
  );
}

export default memo(Site);
