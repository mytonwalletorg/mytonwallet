import React, { memo } from '../../lib/teact/teact';

import type { Theme } from '../../global/types';

import { IS_CORE_WALLET } from '../../config';

import useAppTheme from '../../hooks/useAppTheme';
import useLang from '../../hooks/useLang';

import Image from '../ui/Image';

import styles from './AppLocked.module.scss';

import coreWalletLogoPath from '../../assets/logoCoreWallet.svg';
import logoDarkPath from '../../assets/logoDark.svg';
import logoLightPath from '../../assets/logoLight.svg';

interface OwnProps {
  theme: Theme;
}
function Logo({ theme }: OwnProps) {
  const lang = useLang();
  const appTheme = useAppTheme(theme);

  const logoPath = IS_CORE_WALLET
    ? coreWalletLogoPath
    : appTheme === 'light' ? logoLightPath : logoDarkPath;

  return (
    <div className={styles.logo}>
      <Image className={styles.logo} imageClassName={styles.logo} url={logoPath} alt={lang('Logo')} />
    </div>
  );
}

export default memo(Logo);
