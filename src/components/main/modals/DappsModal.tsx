import React, { memo, useCallback, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import useLang from '../../../hooks/useLang';

import Modal from '../../ui/Modal';

import styles from './DappsModal.module.scss';
import Button from '../../ui/Button';
import buildClassName from '../../../util/buildClassName';
import modalStyles from '../../ui/Modal.module.scss';
import { ApiDapp } from '../../../api/types';

interface OwnProps {
  isOpen?: boolean;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  dapps: ApiDapp[];
}

function DappsModal({ isOpen, onClose, dapps }: OwnProps & StateProps) {
  const {
    getDapps,
    deleteAllDapps,
    deleteDapp,
  } = getActions();

  const lang = useLang();

  useEffect(() => {
    getDapps();
  }, [getDapps]);

  const handleDeleteAllDapps = useCallback(() => {
    void deleteAllDapps();
  }, [deleteAllDapps]);

  const handleDeleteDapp = useCallback((origin: string) => {
    void deleteDapp({ origin });
  }, [deleteDapp]);

  function renderDapp({
    url, name, iconUrl, origin,
  }: ApiDapp) {
    const disconnect = () => {
      handleDeleteDapp(origin);
    };

    return (
      <div className={buildClassName(styles.item, styles.dapp)}>
        <img className={styles.dappIcon} src={iconUrl} alt="" />
        <div className={styles.dappInfo}>
          <div>{name}</div>
          <div>{url}</div>
        </div>
        <Button
          isSmall
          className={styles.dappDisconnect}
          // eslint-disable-next-line react/jsx-no-bind
          onClick={disconnect}
        >
          {lang('Disconnect')}
        </Button>
      </div>
    );
  }

  function renderDapps() {
    const dappsList = [...dapps, ...dapps].map(renderDapp);

    return (
      <>
        <p className={styles.blockTitle}>{lang('Logged in with MyTonWallet')}</p>
        <div className={styles.block}>
          { dappsList }
        </div>
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      title={lang('Dapps')}
      hasCloseButton
      isSlideUp
      noBackdrop
      onClose={onClose}
      dialogClassName={styles.modal}
      contentClassName={styles.content}
    >
      <div className={styles.block}>
        <Button
          className={styles.disconnectButton}
          isSimple
          onClick={handleDeleteAllDapps}
        >
          {lang('Disconnect All Dapps')}
        </Button>
      </div>
      <p className={styles.description}>{lang('$dapps-description')}</p>

      {renderDapps}

      <div className={modalStyles.buttons}>
        <Button onClick={onClose}>{lang('Back')}</Button>
      </div>
    </Modal>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const {
      dapps,
    } = global.settings;

    return {
      dapps,
    };
  })(DappsModal),
);
