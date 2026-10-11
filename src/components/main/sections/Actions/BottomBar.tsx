import React, {
  memo, useState,
} from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { Theme } from '../../../../global/types';

import { selectCurrentAccountSettings, selectHasExploreSites } from '../../../../global/selectors';
import { ACCENT_COLORS } from '../../../../util/accentColor/constants';
import buildClassName from '../../../../util/buildClassName';
import buildStyle from '../../../../util/buildStyle';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useAppTheme from '../../../../hooks/useAppTheme';
import useDraggablePill from '../../../../hooks/useDraggablePill';
import useEffectOnce from '../../../../hooks/useEffectOnce';
import useFlag from '../../../../hooks/useFlag';
import { getIsBottomBarHidden, subscribeToBottomBarVisibility } from '../../../../hooks/useHideBottomBar';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Pill from '../../../common/Pill';
import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Button from '../../../ui/Button';

import styles from './BottomBar.module.scss';

interface StateProps {
  theme: Theme;
  areSettingsOpen?: boolean;
  isExploreOpen?: boolean;
  hasExplore?: boolean;
  accentColorIndex?: number;
}

type IconKey = 'iconWallet' | 'iconExplore' | 'iconSettings';

interface TabConfig {
  key: 'wallet' | 'explore' | 'settings';
  label: string;
  iconKey: IconKey;
  onClick: NoneToVoidFunction;
}

const ICON_SIZE_PX = 38;
const ANIMATED_STICKER_SPEED = 2;

function BottomBar({
  theme, areSettingsOpen, isExploreOpen, hasExplore, accentColorIndex,
}: StateProps) {
  const { switchToWallet, switchToExplore, switchToSettings } = getActions();

  const lang = useLang();
  const [isHidden, setIsHidden] = useState(getIsBottomBarHidden());
  const appTheme = useAppTheme(theme);
  const stickerPaths = ANIMATED_STICKERS_PATHS[appTheme];
  const accentColor = accentColorIndex !== undefined ? ACCENT_COLORS[appTheme][accentColorIndex] : undefined;

  useEffectOnce(() => {
    return subscribeToBottomBarVisibility(() => {
      setIsHidden(getIsBottomBarHidden());
    });
  });

  const exploreTab: TabConfig = { key: 'explore', label: 'Explore', iconKey: 'iconExplore', onClick: switchToExplore };
  // Explore is hidden while the catalog has no sites
  const tabs: TabConfig[] = [
    { key: 'wallet', label: 'Wallet', iconKey: 'iconWallet', onClick: switchToWallet },
    ...(hasExplore ? [exploreTab] : []),
    { key: 'settings', label: 'Settings', iconKey: 'iconSettings', onClick: switchToSettings },
  ];
  const activeKey = isExploreOpen ? 'explore' : (areSettingsOpen ? 'settings' : 'wallet');
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.key === activeKey));

  const switchToTabByIndex = useLastCallback((index: number) => {
    tabs[index]?.onClick();
  });

  const {
    capsuleRef,
    isDragging,
    squeeze,
    renderedActiveIndex,
    pointerHandlers,
  } = useDraggablePill({
    tabCount: tabs.length,
    activeIndex,
    onCommit: switchToTabByIndex,
  });

  const rootStyle = buildStyle(
    `--tab-count: ${tabs.length}`,
    `--active-index: ${activeIndex}`,
  );

  return (
    <div
      className={buildClassName(styles.root, isHidden && styles.hidden)}
      style={rootStyle}
    >
      <div
        ref={capsuleRef}
        className={buildClassName(styles.capsule, isDragging && styles.dragging)}
        {...pointerHandlers}
      >
        <Pill isDragging={isDragging} squeeze={squeeze} />
        {tabs.map(({ key, label, iconKey, onClick }, index) => {
          const isActive = renderedActiveIndex === index;
          const variant = isActive ? `${iconKey}Solid` as const : iconKey;

          return (
            <TabButton
              key={key}
              isActive={isActive}
              label={lang(label)}
              tgsUrl={stickerPaths[variant]}
              previewUrl={stickerPaths.preview[variant]}
              accentColor={accentColor}
              onClick={onClick}
            />
          );
        })}
      </div>
    </div>
  );
}

export default memo(withGlobal((global): StateProps => {
  const { areSettingsOpen, isExploreOpen } = global;

  return {
    theme: global.settings.theme,
    areSettingsOpen,
    isExploreOpen,
    hasExplore: selectHasExploreSites(global),
    accentColorIndex: selectCurrentAccountSettings(global)?.accentColorIndex,
  };
})(BottomBar));

const TabButton = memo(({
  isActive, label, tgsUrl, previewUrl, accentColor, onClick,
}: {
  isActive?: boolean;
  label: string;
  tgsUrl: string;
  previewUrl: string;
  accentColor?: string;
  onClick: NoneToVoidFunction;
}) => {
  const [isAnimating, startAnimation, stopAnimation] = useFlag();

  const handleClick = useLastCallback(() => {
    startAnimation();
    onClick();
  });

  return (
    <Button
      isSimple
      className={buildClassName(styles.button, isActive && styles.active)}
      onClick={handleClick}
    >
      <AnimatedIconWithPreview
        play={isAnimating}
        size={ICON_SIZE_PX}
        speed={ANIMATED_STICKER_SPEED}
        nonInteractive
        forceOnHeavyAnimation
        className={styles.icon}
        color={accentColor}
        tgsUrl={tgsUrl}
        previewUrl={previewUrl}
        onEnded={stopAnimation}
      />
      <span className={styles.label}>{label}</span>
    </Button>
  );
});
