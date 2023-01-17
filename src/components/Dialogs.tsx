import React, { FC, memo, useEffect } from '../lib/teact/teact';
import { getActions, withGlobal } from '../global';

import { pick } from '../util/iteratees';
import renderText from '../global/helpers/renderText';
import useFlag from '../hooks/useFlag';
import useLang from '../hooks/useLang';

import Modal from './ui/Modal';
import Button from './ui/Button';

import styles from './Dialogs.module.scss';
import modalStyles from './ui/Modal.module.scss';

type StateProps = {
  dialogs: string[];
};

const Dialogs: FC<StateProps> = ({ dialogs }) => {
  const { dismissDialog } = getActions();

  const lang = useLang();
  const [isModalOpen, openModal, closeModal] = useFlag();

  useEffect(() => {
    if (dialogs.length > 0) {
      openModal();
    }
  }, [dialogs, openModal]);

  if (!dialogs.length) {
    return undefined;
  }

  const renderDialog = (message: string) => {
    return (
      <Modal
        isCompact
        isOpen={isModalOpen}
        onClose={closeModal}
        onCloseAnimationEnd={dismissDialog}
        title={lang('Something went wrong')}
      >
        <div className={styles.content}>
          {renderText(lang(message))}
        </div>
        <div className={modalStyles.buttons}>
          <Button onClick={closeModal}>OK</Button>
        </div>
      </Modal>
    );
  };

  return (
    <div className={styles.dialogs}>
      {Boolean(dialogs.length) && renderDialog(dialogs[dialogs.length - 1])}
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['dialogs']),
)(Dialogs));
