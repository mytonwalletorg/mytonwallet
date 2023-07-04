import React, { memo, useCallback } from '../../lib/teact/teact';

import type { AnimationLevel, Theme } from '../../global/types';

import { ANIMATION_LEVEL_MAX, ANIMATION_LEVEL_MIN } from '../../config';
import { getActions } from '../../global';
import buildClassName from '../../util/buildClassName';
import switchAnimationLevel from '../../util/switchAnimationLevel';
import switchTheme from '../../util/switchTheme';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import Switcher from '../ui/Switcher';

import styles from './Settings.module.scss';

import darkThemeImg from '../../assets/theme/dark.png';
import lightThemeImg from '../../assets/theme/light.png';
import systemThemeImg from '../../assets/theme/system.png';

interface OwnProps {
  theme: Theme;
  handleBackClick: () => void;
  animationLevel: AnimationLevel;
  canPlaySounds?: boolean;
  isInsideModal?: boolean;
}

const SWITCH_THEME_DURATION_MS = 300;

function SettingsAppearance({
  theme,
  handleBackClick,
  animationLevel,
  canPlaySounds,
  isInsideModal,
}: OwnProps) {
  const {
    setTheme,
    setAnimationLevel,
    toggleCanPlaySounds,
  } = getActions();
  const lang = useLang();

  const THEME_OPTIONS = [{
    value: 'light',
    name: lang('Light'),
    icon: lightThemeImg,
  }, {
    value: 'system',
    name: lang('System'),
    icon: systemThemeImg,
  }, {
    value: 'dark',
    name: lang('Dark'),
    icon: darkThemeImg,
  }];

  const handleThemeChange = useCallback((newTheme: string) => {
    document.documentElement.classList.add('no-transitions');
    setTheme({ theme: newTheme as Theme });
    switchTheme(newTheme as Theme);
    setTimeout(() => {
      document.documentElement.classList.remove('no-transitions');
    }, SWITCH_THEME_DURATION_MS);
  }, [setTheme]);

  const handleAnimationLevelToggle = useCallback(() => {
    const level = animationLevel === ANIMATION_LEVEL_MIN ? ANIMATION_LEVEL_MAX : ANIMATION_LEVEL_MIN;
    setAnimationLevel({ level });
    switchAnimationLevel(level);
  }, [animationLevel, setAnimationLevel]);

  const handleCanPlaySoundToggle = useCallback(() => {
    toggleCanPlaySounds({ isEnabled: !canPlaySounds });
  }, [canPlaySounds, toggleCanPlaySounds]);

  function renderThemes() {
    return THEME_OPTIONS.map(({ name, value, icon }) => {
      return (
        <div
          key={value}
          className={buildClassName(styles.theme, value === theme && styles.theme_active)}
          onClick={() => handleThemeChange(value)}
        >
          <div className={buildClassName(styles.themeIcon, value === theme && styles.themeIcon_active)}>
            <img src={icon} alt={name} className={styles.themeImg} />
          </div>
          <span>{name}</span>
        </div>
      );
    });
  }

  return (
    <div className={styles.slide}>
      {isInsideModal ? (
        <ModalHeader title={lang('Appearance')} onBackButtonClick={handleBackClick} />
      ) : (
        <div className={styles.header}>
          <Button isSimple isText onClick={handleBackClick} className={styles.headerBack}>
            <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
            <span>{lang('Back')}</span>
          </Button>
          <span className={styles.headerTitle}>{lang('Appearance')}</span>
        </div>
      )}
      <div className={buildClassName(styles.content, 'custom-scroll')}>
        <p className={styles.blockTitle}>{lang('Theme')}</p>
        <div className={styles.settingsBlock}>
          <div className={styles.themeWrapper}>
            {renderThemes()}
          </div>
        </div>
        <p className={styles.blockTitle}>{lang('Other')}</p>
        <div className={styles.settingsBlock}>
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleAnimationLevelToggle}>
            {lang('Enable Animations')}

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Enable Animations')}
              checked={animationLevel !== ANIMATION_LEVEL_MIN}
            />
          </div>
          <div className={buildClassName(styles.item, styles.item_small)} onClick={handleCanPlaySoundToggle}>
            {lang('Play Sounds')}

            <Switcher
              className={styles.menuSwitcher}
              label={lang('Play Sounds')}
              checked={canPlaySounds}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsAppearance);
