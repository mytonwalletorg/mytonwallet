import { Dialog } from '@capacitor/dialog';
import type { FC } from '../lib/teact/teact';
import React, { memo, useEffect } from '../lib/teact/teact';
import { getActions, withGlobal } from '../global';

import renderText from '../global/helpers/renderText';
import { pick } from '../util/iteratees';
import { IS_DELEGATED_BOTTOM_SHEET, IS_DELEGATING_BOTTOM_SHEET } from '../util/windowEnvironment';

import useFlag from '../hooks/useFlag';
import useLang from '../hooks/useLang';

import Button from './ui/Button';
import Modal from './ui/Modal';

import styles from './Dialogs.module.scss';
import modalStyles from './ui/Modal.module.scss';

type StateProps = {
  dialogs: string[];
};

const Dialogs: FC<StateProps> = ({ dialogs }) => {
  const { dismissDialog } = getActions();

  const lang = useLang();
  const [isModalOpen, openModal, closeModal] = useFlag();

  const message = dialogs[dialogs.length - 1];
  const title = lang('Something went wrong.');

  useEffect(() => {
    if (IS_DELEGATING_BOTTOM_SHEET || IS_DELEGATED_BOTTOM_SHEET) {
      if (message) {
        Dialog.alert({
          title,
          message: lang(message),
        }).then(() => {
          dismissDialog();
        });
      }
    } else if (message) {
      openModal();
    } else {
      closeModal();
    }
  }, [dialogs, lang, message, openModal, title]);

  if (!message || IS_DELEGATING_BOTTOM_SHEET || IS_DELEGATED_BOTTOM_SHEET) {
    return undefined;
  }

  return (
    <Modal
      isOpen={isModalOpen}
      isCompact
      title={title}
      onClose={closeModal}
      onCloseAnimationEnd={dismissDialog}
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

export default memo(withGlobal(
  (global): StateProps => pick(global, ['dialogs']),
)(Dialogs));
