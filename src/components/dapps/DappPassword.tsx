import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { IS_CAPACITOR } from '../../config';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';

interface OwnProps {
  isActive: boolean;
  error?: string;
  onSubmit: (password: string) => void;
  onCancel: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

function DappPassword({
  isActive,
  error,
  onSubmit,
  onCancel,
  onClose,
}: OwnProps) {
  const { clearDappConnectRequestError } = getActions();

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack: onCancel,
  });

  return (
    <>
      {!IS_CAPACITOR && <ModalHeader title={lang('Enter Password')} onClose={onClose} />}
      <PasswordForm
        isActive={isActive}
        error={error}
        placeholder={lang('Enter your password')}
        submitLabel={lang('Connect')}
        withCloseButton={IS_CAPACITOR}
        onUpdate={clearDappConnectRequestError}
        onSubmit={onSubmit}
        cancelLabel={lang('Cancel')}
        onCancel={onCancel}
      />
    </>
  );
}

export default memo(DappPassword);
