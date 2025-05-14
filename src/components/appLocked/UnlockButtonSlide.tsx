import React, { memo } from '../../lib/teact/teact';

import type { Theme } from '../../global/types';

import { APP_NAME } from '../../config';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Logo from './Logo';

import styles from './AppLocked.module.scss';

interface OwnProps {
  isActive: boolean;
  theme: Theme;
  onClick: NoneToVoidFunction;
}

function UnlockButtonSlide({ isActive, theme, onClick }: OwnProps) {
  const lang = useLang();

  return (
    <div className={buildClassName(
      styles.unlockButtonWrapper,
      isActive && styles.unlockButtonWrapperActive,
    )}>
      <Logo theme={theme} />
      <span className={buildClassName(styles.title, 'rounded-font')}>{APP_NAME}</span>
      <Button
        isPrimary
        className={!isActive ? styles.unlockButtonHidden : undefined}
        onClick={onClick}
      >
        {lang('Unlock')}
      </Button>
    </div>
  );
}

export default memo(UnlockButtonSlide);
