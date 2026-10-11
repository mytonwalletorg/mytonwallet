import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import ListItem from '../ui/ListItem';
import Modal from '../ui/Modal';

import styles from './Auth.module.scss';

interface StateProps {
  isOpen?: boolean;
}

function AuthImportWalletModal({ isOpen }: StateProps) {
  const {
    startImportingWallet,
    startImportViewAccount,
    closeAuthImportWalletModal,
  } = getActions();

  const lang = useLang();

  const handleSecretWordsClick = useLastCallback(() => {
    closeAuthImportWalletModal();
    startImportingWallet();
  });

  const handleImportViewAccountClick = useLastCallback(() => {
    closeAuthImportWalletModal();
    startImportViewAccount();
  });

  return (
    <Modal
      isOpen={isOpen}
      title={lang('Import Wallet')}
      hasCloseButton
      forceBottomSheet

      contentClassName={styles.importModalContent}
      onClose={closeAuthImportWalletModal}
    >
      <div className={styles.actionsSection}>
        <ListItem
          icon="key"
          label={lang('$secret_words')}
          description={lang('Restore wallet from 12 or 24 words')}
          onClick={handleSecretWordsClick}
        />
      </div>

      <div className={styles.actionsSection}>
        <ListItem
          icon="wallet-view"
          label={lang('View Any Address')}
          description={lang('Watch wallet in read-only mode')}
          onClick={handleImportViewAccountClick}
        />
      </div>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  return {
    isOpen: global.auth.isImportModalOpen,
  };
})(AuthImportWalletModal));
