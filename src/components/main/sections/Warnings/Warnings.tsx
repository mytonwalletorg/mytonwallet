import React, { memo } from '../../../../lib/teact/teact';

import { IS_ELECTRON, IS_EXTENSION } from '../../../../config';
import { withGlobal } from '../../../../global';
import { selectCurrentAccountState } from '../../../../global/selectors';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useLang from '../../../../hooks/useLang';

import BackupWarning from './BackupWarning';
import SecurityWarning from './SecurityWarning';

import styles from './Warnings.module.scss';

type OwnProps = {
  onOpenBackupWallet: () => void;
};

type StateProps = {
  isTestnet?: boolean;
  isBackupRequired: boolean;
};

const SECURITY_WARNING_TEMPORARILY_DISABLED = true;

function Warnings({ isBackupRequired, isTestnet, onOpenBackupWallet }: OwnProps & StateProps) {
  const { isPortrait } = useDeviceScreen();
  const lang = useLang();

  return (
    <>
      {isTestnet && (
        <div className={isPortrait ? styles.portraitContainer : styles.container}>
          <div className={styles.testnetWarning}>{lang('Testnet Version')}</div>
        </div>
      )}

      <BackupWarning isRequired={isBackupRequired} onOpenBackupWallet={onOpenBackupWallet} />
      {!(IS_ELECTRON || IS_EXTENSION || SECURITY_WARNING_TEMPORARILY_DISABLED) && <SecurityWarning />}
    </>
  );
}

export default memo(withGlobal((global, ownProps, detachWhenChanged): StateProps => {
  detachWhenChanged(global.currentAccountId);

  return {
    isBackupRequired: Boolean(selectCurrentAccountState(global)?.isBackupRequired),
    isTestnet: global.settings.isTestnet,
  };
})(Warnings));
