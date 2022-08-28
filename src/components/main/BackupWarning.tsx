import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import buildClassName from '../../util/buildClassName';
import useShowTransition from '../../hooks/useShowTransition';
import useBrowserUiColor from '../../hooks/useBrowserUiColor';

import styles from './BackupWarning.module.scss';

type OwnProps = {
  onOpenBackupWallet: () => void;
};

type StateProps = {
  isRequired: boolean;
};

const UI_BG_RED_LIGHT = '#F36B6B';
const UI_BG_RED_DARK = '#F36B6B';

function BackupWarning({ isRequired, onOpenBackupWallet }: OwnProps & StateProps) {
  const { shouldRender, transitionClassNames } = useShowTransition(isRequired, undefined, true);

  useBrowserUiColor(isRequired, UI_BG_RED_LIGHT, UI_BG_RED_DARK);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();

    onOpenBackupWallet();
  };

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div className={buildClassName(styles.wrapper, transitionClassNames)}>
      Wallet is not backed up!
      <a href="#" className={styles.button} onClick={handleClick}>
        Back up now
      </a>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global) => {
  return {
    isRequired: Boolean(global.isBackupRequired),
  };
})(BackupWarning));
