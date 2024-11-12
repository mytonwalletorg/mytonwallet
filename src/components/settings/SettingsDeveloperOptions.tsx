import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiNetwork } from '../../api/types';

import { IS_CAPACITOR } from '../../config';
import buildClassName from '../../util/buildClassName';
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

const NETWORK_OPTIONS = [{
  value: 'mainnet',
  name: 'Mainnet',
}, {
  value: 'testnet',
  name: 'Testnet',
}];

function SettingsDeveloperOptions({
  isOpen, onClose, isTestnet, isCopyStorageEnabled,
}: OwnProps) {
  const {
    startChangingNetwork,
    copyStorageData,
  } = getActions();
  const lang = useLang();
  const currentNetwork = NETWORK_OPTIONS[isTestnet ? 1 : 0].value;

  const handleNetworkChange = useLastCallback((newNetwork: string) => {
    if (currentNetwork === newNetwork) {
      return;
    }

    startChangingNetwork({ network: newNetwork as ApiNetwork });
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

      <div className={buildClassName(styles.settingsBlock, styles.logBlock)} onClick={() => downloadLogs()}>
        <div className={buildClassName(styles.item, styles.item_small)}>
          {lang('Download Logs')}
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

export default memo(SettingsDeveloperOptions);

async function downloadLogs() {
  const workerLogs = await callApi('getLogs') || [];
  const uiLogs = getLogs();
  const logsString = JSON.stringify(
    [...workerLogs, ...uiLogs].sort((a, b) => a.timestamp - b.timestamp),
    undefined,
    2,
  );

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
