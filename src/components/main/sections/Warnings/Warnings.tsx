import React, { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import { selectCurrentAccountState } from '../../../../global/selectors';
import useLang from '../../../../hooks/useLang';

import BackupWarning from './BackupWarning';

import styles from './Warnings.module.scss';

type OwnProps = {
  onOpenBackupWallet: () => void;
};

type StateProps = {
  isTestnet?: boolean;
  isBackupRequired: boolean;
};

function Warnings({ isBackupRequired, isTestnet, onOpenBackupWallet }: OwnProps & StateProps) {
  const lang = useLang();

  return (
    <div className={styles.container}>
      {isTestnet && <div className={styles.testnetWarning}>{lang('Testnet Version')}</div>}
      <BackupWarning isRequired={isBackupRequired} onOpenBackupWallet={onOpenBackupWallet} />
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
  detachWhenChanged(global.currentAccountId);

  return {
    isBackupRequired: Boolean(selectCurrentAccountState(global)?.isBackupRequired),
    isTestnet: global.settings.isTestnet,
  };
})(Warnings));
