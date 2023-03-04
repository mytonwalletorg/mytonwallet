import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import useLang from '../../../hooks/useLang';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';

import styles from './DisconnectDappModal.module.scss';
import { ApiDapp } from '../../../api/types';

interface OwnProps {
  isOpen?: boolean;
  dapp?: ApiDapp;
  onClose: NoneToVoidFunction;
}

function DisconnectDappModal({ isOpen, dapp, onClose }: OwnProps) {
  const {
    deleteAllDapps,
    deleteDapp,
  } = getActions();

  const lang = useLang();

  const handleDeleteAllDapps = useCallback(() => {
    void deleteAllDapps();
    onClose();
  }, [deleteAllDapps, onClose]);

  const handleDeleteDapp = useCallback(() => {
    if (!dapp) {
      return;
    }

    void deleteDapp({ origin: dapp.origin });
    onClose();
  }, [deleteDapp, dapp, onClose]);

  function renderDisconnectModal() {
    const title = dapp ? lang('Disconnect Dapp') : lang('Disconnect Dapps');
    const description = dapp
      ? lang('Are you sure you want to disconnect?', { dappname: <strong>{dapp.name}</strong> })
      : lang('Are you sure you want to disconnect all websites?');
    const onDisconnect = dapp ? handleDeleteDapp : handleDeleteAllDapps;

    return (
      <Modal
        isOpen={isOpen}
        isCompact
        onClose={onClose}
        title={title}
        contentClassName={styles.content}
      >
        <p className={styles.description}>{description}</p>
        <div className={styles.buttons}>
          <Button onClick={onClose} className={styles.button}>{lang('Cancel')}</Button>
          <Button isDestructive onClick={onDisconnect} className={styles.button}>
            {lang('Disconnect')}
          </Button>
        </div>
      </Modal>
    );
  }

  return renderDisconnectModal();
}

export default memo(DisconnectDappModal);
