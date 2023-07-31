import React, { memo } from '../../lib/teact/teact';

import type { ApiNetwork } from '../../api/types';

import { getActions } from '../../global';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import DropDown from '../ui/DropDown';
import Modal from '../ui/Modal';

import styles from './Settings.module.scss';

interface OwnProps {
  isOpen: boolean;
  onClose: () => void;
  isTestnet?: boolean;
}

const NETWORK_OPTIONS = [{
  value: 'mainnet',
  name: 'Mainnet',
}, {
  value: 'testnet',
  name: 'Testnet',
}];

function SettingsDeveloperOptions({ isOpen, onClose, isTestnet }: OwnProps) {
  const {
    startChangingNetwork,
  } = getActions();
  const lang = useLang();

  const handleNetworkChange = useLastCallback((newNetwork: string) => {
    startChangingNetwork({ network: newNetwork as ApiNetwork });
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
        <DropDown
          label={lang('Network')}
          items={NETWORK_OPTIONS}
          selectedValue={NETWORK_OPTIONS[isTestnet ? 1 : 0].value}
          theme="light"
          arrow="chevron"
          className={buildClassName(styles.item, styles.item_small)}
          onChange={handleNetworkChange}
        />
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
