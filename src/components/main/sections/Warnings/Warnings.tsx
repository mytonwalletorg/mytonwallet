import React, { memo } from '../../../../lib/teact/teact';
import { withGlobal } from '../../../../global';

import { IS_EXTENSION } from '../../../../config';
import { selectCurrentAccountState } from '../../../../global/selectors';
import { IS_ANDROID, IS_ELECTRON, IS_IOS } from '../../../../util/windowEnvironment';

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

const IS_UNSAFE_WEB = !IS_ELECTRON && !IS_EXTENSION && !IS_IOS && !IS_ANDROID;

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
      {IS_UNSAFE_WEB && <SecurityWarning />}
    </>
  );
}

export default memo(
  withGlobal(
    (global): StateProps => {
      return {
        isBackupRequired: Boolean(selectCurrentAccountState(global)?.isBackupRequired),
        isTestnet: global.settings.isTestnet,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(Warnings),
);
