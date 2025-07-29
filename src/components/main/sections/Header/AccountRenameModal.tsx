import React, { memo, useEffect, useRef, useState } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import useFocusAfterAnimation from '../../../../hooks/useFocusAfterAnimation';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';
import Input from '../../../ui/Input';
import Modal from '../../../ui/Modal';

import modalStyles from '../../../ui/Modal.module.scss';

interface OwnProps {
  isOpen: boolean;
  name: string;
  currentAccountId: string;
  onClose: NoneToVoidFunction;
}

const ACCOUNT_NAME_MAX_LENGTH = 255;

function AccountRenameModal({ isOpen, name, currentAccountId, onClose }: OwnProps) {
  const { renameAccount } = getActions();

  const lang = useLang();
  const inputRef = useRef<HTMLInputElement>();
  const [newName, setNewName] = useState<string>(name);

  useEffect(() => {
    if (isOpen) {
      setNewName(name);
    }
  }, [isOpen, name]);

  useFocusAfterAnimation(inputRef, !isOpen);

  const handleSubmit = useLastCallback(() => {
    renameAccount({ accountId: currentAccountId, title: newName.trim() });
    onClose();
  });

  return (
    <Modal
      isCompact
      isOpen={isOpen}
      title={lang('Rename Wallet')}
      onClose={onClose}
    >
      <p>{lang('You can rename this wallet for easier identification.')}</p>
      <Input
        ref={inputRef}
        placeholder={lang('Name')}
        onInput={setNewName}
        value={newName}
        maxLength={ACCOUNT_NAME_MAX_LENGTH}
      />

      <div className={modalStyles.buttons}>
        <Button onClick={onClose} className={modalStyles.button}>{lang('Cancel')}</Button>
        <Button
          onClick={handleSubmit}
          isPrimary
          isDisabled={newName.trim().length === 0}
          className={modalStyles.button}
        >
          {lang('Save')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(AccountRenameModal);
