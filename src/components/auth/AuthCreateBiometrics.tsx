import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { AuthMethod } from '../../global/types';

import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
  method?: AuthMethod;
}

const AuthCreateBiometrics = ({
  isActive,
  method,
}: OwnProps) => {
  const {
    startCreatingBiometrics,
    resetAuth,
    skipCreateBiometrics,
  } = getActions();

  const lang = useLang();
  const isImporting = method !== 'createAccount';

  useHistoryBack({
    isActive,
    onBack: resetAuth,
  });

  return (
    <div className={buildClassName(styles.container, styles.container_scrollable, 'custom-scroll')}>
      <AnimatedIconWithPreview
        play={isActive}
        tgsUrl={ANIMATED_STICKERS_PATHS.happy}
        previewUrl={ANIMATED_STICKERS_PATHS.happyPreview}
        noLoop={false}
        nonInteractive
        className={styles.sticker}
      />
      <div className={styles.title}>{lang('Congratulations!')}</div>
      <p className={styles.info}>
        <b>{lang(isImporting ? 'The wallet is imported' : 'The wallet is ready')}.</b>
      </p>
      <p className={styles.info}>
        {lang('Create a password or use biometric authentication to protect it.')}
      </p>

      <div className={styles.buttons}>
        <Button
          isPrimary
          className={styles.btn}
          onClick={startCreatingBiometrics}
        >
          {lang('Connect Biometrics')}
        </Button>
        <Button
          isText
          className={buildClassName(styles.btn, styles.btn_text)}
          onClick={skipCreateBiometrics}
        >
          {lang('Use Password')}
        </Button>
      </div>
    </div>
  );
};

export default memo(AuthCreateBiometrics);
