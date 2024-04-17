import { Dialog } from 'native-dialog';
import type { FC } from '../lib/teact/teact';
import React, { memo, useEffect } from '../lib/teact/teact';
import { getActions, withGlobal } from '../global';

import type { DialogType } from '../global/types';

import { IS_CAPACITOR } from '../config';
import renderText from '../global/helpers/renderText';
import { pick } from '../util/iteratees';

import useFlag from '../hooks/useFlag';
import useLang from '../hooks/useLang';

import Button from './ui/Button';
import Modal from './ui/Modal';

import modalStyles from './ui/Modal.module.scss';

type StateProps = {
  dialogs: DialogType[];
};

const Dialogs: FC<StateProps> = ({ dialogs }) => {
  const { dismissDialog } = getActions();

  const lang = useLang();
  const [isModalOpen, openModal, closeModal] = useFlag();

  const dialog = dialogs[dialogs.length - 1];
  const title = lang(dialog?.title ?? 'Something went wrong');

  useEffect(() => {
    if (IS_CAPACITOR) {
      if (dialog) {
        Dialog.alert({
          title,
          message: lang(dialog.message),
        }).then(() => {
          dismissDialog();
        });
      }
    } else if (dialog) {
      openModal();
    } else {
      closeModal();
    }
  }, [dialogs, lang, dialog, openModal, title]);

  if (!dialog || IS_CAPACITOR) {
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
      <div>
        {renderText(lang(dialog.message))}
      </div>
      <div className={modalStyles.footerButtons}>
        <Button onClick={closeModal}>{lang('OK')}</Button>
      </div>
    </Modal>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['dialogs']),
)(Dialogs));
