import React, { memo, useEffect } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiBackendDapp, ApiDapp } from '../../../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX } from '../../../../config';
import buildClassName from '../../../../util/buildClassName';
import { IS_ANDROID_APP, IS_IOS_APP } from '../../../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useLang from '../../../../hooks/useLang';

import DappSite from '../../../explore/DappSite';
import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Loading from '../../../ui/Loading';

import styles from './Explore.module.scss';

interface OwnProps {
  isActive?: boolean;
}

interface StateProps {
  dapps?: ApiDapp[];
  dappCatalog?: ApiBackendDapp[];
  shouldRestrict: boolean;
}

function Explore({
  isActive, dapps, dappCatalog, shouldRestrict,
}: OwnProps & StateProps) {
  const { loadDappCatalog, getDapps } = getActions();

  const lang = useLang();
  const { isLandscape } = useDeviceScreen();

  useEffect(() => {
    if (!isActive) return;

    getDapps();
    loadDappCatalog();
  }, [isActive]);

  if (dappCatalog === undefined) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}>
        <Loading />
      </div>
    );
  }

  if (dappCatalog.length === 0) {
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
    <div className={buildClassName(styles.list, isLandscape && styles.landscapeList)}>
      {dappCatalog.filter((site) => !(shouldRestrict && site.canBeRestricted)).map((site) => (
        <DappSite
          key={site.url}
          url={site.url}
          icon={site.icon}
          title={site.name}
          description={site.description}
          isExternal={site.isExternal}
          dapps={dapps}
        />
      ))}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    dapps: global.settings.dapps,
    dappCatalog: global.dappCatalog,
    shouldRestrict: global.restrictions.isLimitedRegion && (IS_IOS_APP || IS_ANDROID_APP),
  };
})(Explore));
