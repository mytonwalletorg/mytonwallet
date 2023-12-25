import React, { memo, type TeactNode } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { IS_CAPACITOR } from '../../config';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';

interface OwnProps {
  isActive: boolean;
  isLoading?: boolean;
  error?: string;
  children?: TeactNode;
  onSubmit: (password: string) => void;
  onCancel: NoneToVoidFunction;
}

function TransferPassword({
  isActive, isLoading, error, children, onSubmit, onCancel,
}: OwnProps) {
  const {
    cancelTransfer,
    clearTransferError,
  } = getActions();

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onCancel,
  });

  return (
    <>
      {!IS_CAPACITOR && <ModalHeader title={lang('Confirm Transaction')} onClose={cancelTransfer} />}
      <PasswordForm
        isActive={isActive}
        isLoading={isLoading}
        operationType="transfer"
        error={error}
        placeholder={lang('Enter your password')}
        withCloseButton={Boolean(children)}
        onUpdate={clearTransferError}
        onSubmit={onSubmit}
        submitLabel={lang('Send')}
        onCancel={onCancel}
        cancelLabel={lang('Back')}
      >
        {children}
      </PasswordForm>
    </>
  );
}

export default memo(TransferPassword);
