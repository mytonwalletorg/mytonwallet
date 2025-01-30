import React, { memo, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import { ContentTab } from '../../../../global/types';

import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { createSignal } from '../../../../util/signals';

import useEffectOnce from '../../../../hooks/useEffectOnce';
import useHistoryBack from '../../../../hooks/useHistoryBack';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';

import styles from './BottomBar.module.scss';

interface StateProps {
  areSettingsOpen?: boolean;
  areAssetsActive?: boolean;
  isExploreOpen?: boolean;
}

const [getHideCounter, setHideCounter] = createSignal(0);

export function hideBottomBar() {
  const currentCounter = getHideCounter();
  setHideCounter(currentCounter + 1);
}

export function showBottomBar() {
  const currentCounter = getHideCounter();
  setHideCounter(Math.max(0, currentCounter - 1));
}

function getIsBottomBarHidden() {
  return getHideCounter() > 0;
}

function BottomBar({ areSettingsOpen, areAssetsActive, isExploreOpen }: StateProps) {
  const {
    openSettings, closeSettings, setActiveContentTab, closeSiteCategory, selectToken,
  } = getActions();
  const lang = useLang();
  const [isHidden, setIsHidden] = useState(getIsBottomBarHidden());
  const isWalletTabActive = !isExploreOpen && !areSettingsOpen;

  useEffectOnce(() => {
    return getHideCounter.subscribe(() => {
      setIsHidden(getIsBottomBarHidden());
    });
  });

  const openExplore = useLastCallback(() => {
    setActiveContentTab({ tab: ContentTab.Explore }, { forceOnHeavyAnimation: true });
  });

  const closeExplore = useLastCallback(() => {
    setActiveContentTab({ tab: ContentTab.Assets }, { forceOnHeavyAnimation: true });
  });

  const handleWalletClick = useLastCallback(() => {
    closeExplore();
    closeSettings();

    if (!areAssetsActive && isWalletTabActive) {
      selectToken({ slug: undefined });
      setActiveContentTab({ tab: ContentTab.Assets }, { forceOnHeavyAnimation: true });
    }
  });

  const handleExploreClick = useLastCallback(() => {
    if (isExploreOpen) {
      closeSiteCategory();
    }

    openExplore();
    closeSettings();
  });

  const handleSettingsClick = useLastCallback(() => {
    openSettings(undefined, { forceOnHeavyAnimation: true });
    closeExplore();
  });

  useHistoryBack({
    isActive: areSettingsOpen || isExploreOpen,
    onBack: handleWalletClick,
  });

  return (
    <div className={buildClassName(styles.root, isHidden && styles.hidden)}>
      <Button
        isSimple
        className={buildClassName(styles.button, isWalletTabActive && styles.active)}
        onClick={handleWalletClick}
      >
        <i className={buildClassName(styles.icon, 'icon-wallet')} />
        <span className={styles.label}>{lang('Wallet')}</span>
      </Button>
      <Button
        isSimple
        className={buildClassName(styles.button, isExploreOpen && styles.active)}
        onClick={handleExploreClick}
      >
        <i className={buildClassName(styles.icon, 'icon-explore')} />
        <span className={styles.label}>{lang('Explore')}</span>
      </Button>
      <Button
        isSimple
        className={buildClassName(styles.button, areSettingsOpen && styles.active)}
        onClick={handleSettingsClick}
      >
        <i className={buildClassName(styles.icon, 'icon-settings')} />
        <span className={styles.label}>{lang('Settings')}</span>
      </Button>
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { areSettingsOpen } = global;
  const { activeContentTab } = selectCurrentAccountState(global) ?? {};

  return {
    areSettingsOpen,
    areAssetsActive: activeContentTab === ContentTab.Assets,
    isExploreOpen: !areSettingsOpen && activeContentTab === ContentTab.Explore,
  };
})(BottomBar));
