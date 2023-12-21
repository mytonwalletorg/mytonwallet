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
  onBack: NoneToVoidFunction;
}

function SwapPassword({
  isActive,
  isLoading,
  error,
  children,
  onSubmit,
  onBack,
}: OwnProps) {
  const { cancelSwap, clearSwapError } = getActions();

  const lang = useLang();

  useHistoryBack({
    isActive,
    onBack,
  });

  return (
    <>
      {!IS_CAPACITOR && <ModalHeader title={lang('Confirm Transaction')} onClose={cancelSwap} />}
      <PasswordForm
        isActive={isActive}
        isLoading={isLoading}
        error={error}
        operationType="swap"
        placeholder={lang('Enter your password')}
        withCloseButton={IS_CAPACITOR}
        onUpdate={clearSwapError}
        onSubmit={onSubmit}
        submitLabel={lang('Send')}
        onCancel={onBack}
        cancelLabel={lang('Back')}
      >
        {children}
      </PasswordForm>
    </>
  );
}

export default memo(SwapPassword);
