import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiNetwork } from '../../api/types';
import type { Account } from '../../global/types';

import {
  APP_ENV,
  APP_VERSION,
  IS_CAPACITOR,
  IS_EXTENSION,
} from '../../config';
import buildClassName from '../../util/buildClassName';
import { copyTextToClipboard } from '../../util/clipboard';
import { getBuildPlatform, getFlagsValue } from '../../util/getBuildPlatform';
import { getPlatform } from '../../util/getPlatform';
import { getLogs } from '../../util/logs';
import { IS_IOS } from '../../util/windowEnvironment';
import { callApi } from '../../api';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import Modal from '../ui/Modal';

import styles from './Settings.module.scss';

interface OwnProps {
  isOpen: boolean;
  onClose: () => void;
  isTestnet?: boolean;
  isCopyStorageEnabled?: boolean;
}

interface StateProps {
  currentAccountId?: string;
  accountsById?: Record<string, Account>;
}

const NETWORK_OPTIONS = [{
  value: 'mainnet',
  name: 'Mainnet',
}, {
  value: 'testnet',
  name: 'Testnet',
}];

function SettingsDeveloperOptions({
  isOpen,
  onClose,
  isTestnet,
  isCopyStorageEnabled,
  currentAccountId,
  accountsById,
}: OwnProps & StateProps) {
  const {
    startChangingNetwork,
    copyStorageData,
    showNotification,
  } = getActions();
  const lang = useLang();
  const currentNetwork = NETWORK_OPTIONS[isTestnet ? 1 : 0].value;

  const handleNetworkChange = useLastCallback((newNetwork: string) => {
    startChangingNetwork({ network: newNetwork as ApiNetwork });
    onClose();
  });

  const handleExtensionClick = useLastCallback((logsString: string) => {
    showNotification({ message: lang('Logs were copied!') as string, icon: 'icon-copy' });
    void copyTextToClipboard(logsString);
    onClose();
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      noBackdropClose
      isCompact
    >
      <div className={styles.developerTitle}>
        {lang('Developer Options')}
      </div>

      <div className={styles.settingsBlock}>
        <Dropdown
          label={lang('Network')}
          items={NETWORK_OPTIONS}
          selectedValue={currentNetwork}
          theme="light"
          arrow="chevron"
          className={buildClassName(styles.item, styles.item_small)}
          onChange={handleNetworkChange}
        />
      </div>

      {isCopyStorageEnabled && (
        <>
          <p className={styles.blockTitle}>{lang('Dangerous')}</p>
          <div className={styles.settingsBlock}>
            <div className={buildClassName(styles.item, styles.item_small)} onClick={() => copyStorageData()}>
              {lang('Copy Storage Data')}

              <i className={buildClassName(styles.iconChevronRight, 'icon-copy')} aria-hidden />
            </div>
          </div>
        </>
      )}

      <div
        className={buildClassName(styles.settingsBlock, styles.logBlock)}
        onClick={() => downloadLogs({
          currentAccountId,
          accountsById,
          onExtensionClick: handleExtensionClick,
        })}
      >
        <div className={buildClassName(styles.item, styles.item_small)}>
          {
            IS_EXTENSION
              ? (
                <>
                  {lang('Copy Logs')}

                  <i className={buildClassName(styles.iconChevronRight, 'icon-copy')} aria-hidden />
                </>
              ) : lang('Download Logs')
          }
        </div>
      </div>

      <Button
        className={styles.developerCloseButton}
        onClick={onClose}
      >
        {lang('Close')}
      </Button>
    </Modal>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const currentAccountId = global.currentAccountId;

  const accountsById = global.accounts?.byId;

  return {
    currentAccountId,
    accountsById,
  };
})(SettingsDeveloperOptions));

async function downloadLogs(
  {
    currentAccountId,
    accountsById,
    onExtensionClick,
  }: StateProps & { onExtensionClick: (logsString: string) => void },
) {
  const accountsInfo = accountsById && Object.keys(accountsById).reduce((acc, accountId) => {
    const { addressByChain, isHardware } = accountsById[accountId];
    acc[accountId] = {
      addressByChain,
      isHardware,
    };
    return acc;
  }, {} as any);

  const workerLogs = await callApi('getLogs') || [];
  const uiLogs = getLogs();
  const logsString = JSON.stringify(
    [...workerLogs, ...uiLogs].sort((a, b) => a.timestamp - b.timestamp).concat({
      environment: APP_ENV,
      version: APP_VERSION,
      platform: getPlatform(),
      navigatorPlatform: navigator.platform,
      userAgent: navigator.userAgent,
      build: getBuildPlatform(),
      flags: getFlagsValue(),
      currentAccountId,
      accountsInfo,
    } as any),
    undefined,
    2,
  );

  if (IS_EXTENSION) {
    onExtensionClick(logsString);
    return;
  }

  const blob = new Blob([logsString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const filename = `mytonwallet_logs_${Date.now()}.json`;

  if (IS_CAPACITOR) {
    const logFile = await Filesystem.writeFile({
      path: filename,
      data: logsString,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    await Share.share({
      url: logFile.uri,
    });
  } else if (navigator.share) {
    const file = new File([blob], filename, { type: blob.type });

    navigator.share({
      files: [file],
    });
  } else if (IS_IOS) {
    window.open(url, '_blank', 'noreferrer');
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
  }

  URL.revokeObjectURL(url);
}
