import React, { memo } from '../../../lib/teact/teact';

import { IS_CAPACITOR } from '../../../config';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';

import ModalHeader from '../../ui/ModalHeader';
import PasswordForm from '../../ui/PasswordForm';

interface OwnProps {
  isActive: boolean;
  isLoading?: boolean;
  error?: string;
  onClearError: NoneToVoidFunction;
  onSubmit: (password: string) => void;
  onBack: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

function AddAccountPasswordModal({
  isActive,
  isLoading,
  error,
  onClearError,
  onSubmit,
  onBack,
  onClose,
}: OwnProps) {
  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack,
  });

  return (
    <>
      {!IS_CAPACITOR && <ModalHeader title={lang('Enter Password')} onClose={onClose} />}
      <PasswordForm
        isActive={isActive}
        isLoading={isLoading}
        error={error}
        placeholder={lang('Enter your password')}
        withCloseButton={IS_CAPACITOR}
        onUpdate={onClearError}
        onSubmit={onSubmit}
        submitLabel={lang('Send')}
        onCancel={onBack}
        cancelLabel={lang('Back')}
      />
    </>
  );
}

export default memo(AddAccountPasswordModal);
