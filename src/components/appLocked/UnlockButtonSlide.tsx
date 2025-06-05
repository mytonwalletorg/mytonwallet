import React, { type ElementRef, memo } from '../../lib/teact/teact';

import type { Theme } from '../../global/types';

import { APP_NAME } from '../../config';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Logo from './Logo';

import styles from './AppLocked.module.scss';

interface OwnProps {
  ref: ElementRef<HTMLDivElement>;
  theme: Theme;
  innerContentTopPosition?: number;
  handleChangeSlideForBiometricAuth: NoneToVoidFunction;
}

function UnlockButtonSlide({
  ref,
  theme,
  innerContentTopPosition = 0,
  handleChangeSlideForBiometricAuth,
}: OwnProps) {
  const lang = useLang();

  return (
    <div
      ref={ref}
      className={styles.innerContent}
      style={`--position-top: ${innerContentTopPosition}px;`}
    >
      <Logo theme={theme} />
      <span className={buildClassName(styles.title, 'rounded-font')}>{APP_NAME}</span>
      <Button isPrimary onClick={handleChangeSlideForBiometricAuth}>
        {lang('Unlock')}
      </Button>
    </div>
  );
}

export default memo(UnlockButtonSlide);
