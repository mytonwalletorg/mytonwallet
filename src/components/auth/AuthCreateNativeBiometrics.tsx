import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';
import { getIsFaceIdAvailable, getIsTouchIdAvailable } from '../../util/capacitor';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';

import styles from './Auth.module.scss';

import touchIdSvg from '../../assets/settings/settings_biometrics.svg';
import faceIdSvg from '../../assets/settings/settings_face-id.svg';

interface OwnProps {
  isActive?: boolean;
  isLoading?: boolean;
}

const AuthCreateNativeBiometrics = ({ isActive, isLoading }: OwnProps) => {
  const { afterCreateNativeBiometrics, skipCreateNativeBiometrics, resetAuth } = getActions();

  const lang = useLang();

  const isFaceId = getIsFaceIdAvailable();
  const isTouchId = getIsTouchIdAvailable();

  useHistoryBack({
    isActive,
    onBack: resetAuth,
  });

  return (
    <div className={styles.container}>
      <Button isSimple isText onClick={resetAuth} className={styles.headerBack}>
        <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
        <span>{lang('Back')}</span>
      </Button>

      <img
        src={isFaceId ? faceIdSvg : touchIdSvg}
        alt=""
        className={styles.biometricsIcon}
      />

      <div className={styles.biometricsTitle}>
        {isFaceId ? lang('Use Face ID') : (isTouchId ? lang('Use Touch ID') : lang('Use Biometrics'))}
      </div>
      <div className={styles.biometricsSubtitle}>
        {lang('You can connect your biometric data for more convenience')}
      </div>

      <div className={styles.buttons}>
        <Button
          isPrimary
          className={styles.btn}
          isLoading={isLoading}
          onClick={!isLoading ? afterCreateNativeBiometrics : undefined}
        >
          {lang(isFaceId ? 'Connect Face ID' : (isTouchId ? 'Connect Touch ID' : 'Connect Biometrics'))}
        </Button>
        <Button
          isText
          isDisabled={isLoading}
          className={buildClassName(styles.btn, styles.btn_text)}
          onClick={skipCreateNativeBiometrics}
        >
          {lang('Not Now')}
        </Button>
      </div>
    </div>
  );
};

export default memo(AuthCreateNativeBiometrics);
