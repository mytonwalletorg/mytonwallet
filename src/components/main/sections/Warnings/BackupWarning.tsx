import React, { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import type { Theme } from '../../../../global/types';

import buildClassName from '../../../../util/buildClassName';
import useShowTransition from '../../../../hooks/useShowTransition';
import useBrowserUiColor from '../../../../hooks/useBrowserUiColor';
import useLang from '../../../../hooks/useLang';

import styles from './Warnings.module.scss';

type OwnProps = {
  isRequired: boolean;
  onOpenBackupWallet: () => void;
};

type StateProps = {
  theme: Theme;
};

const UI_BG_RED_LIGHT = '#F36A6B';
const UI_BG_RED_DARK = '#C44646';

function BackupWarning({ isRequired, theme, onOpenBackupWallet }: OwnProps & StateProps) {
  const { shouldRender, transitionClassNames } = useShowTransition(isRequired, undefined, true);

  const lang = useLang();

  useBrowserUiColor({
    isActive: isRequired,
    currentTheme: theme,
    lightColor: UI_BG_RED_LIGHT,
    darkColor: UI_BG_RED_DARK,
  });

  const handleClick = () => {
    onOpenBackupWallet();
  };

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div className={buildClassName(styles.wrapper, transitionClassNames)} onClick={handleClick}>
      {lang('Wallet is not backed up')}
      <i className={buildClassName(styles.icon, 'icon-chevron-right')} />
      <p className={styles.text}>
        {lang('Back up wallet to have full access to it')}
      </p>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
  detachWhenChanged(global.currentAccountId);

  return {
    theme: global.settings.theme,
  };
})(BackupWarning));
