import React, { memo, type TeactNode, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { IS_CAPACITOR } from '../../config';

import useEffectOnce from '../../hooks/useEffectOnce';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';

interface OwnProps {
  isActive: boolean;
  isLoading?: boolean;
  isBurning?: boolean;
  error?: string;
  children?: TeactNode;
  onSubmit: (password: string) => void;
  onCancel: NoneToVoidFunction;
}

function TransferPassword({
  isActive, isLoading, isBurning, error, children, onSubmit, onCancel,
}: OwnProps) {
  const {
    cancelTransfer,
    clearTransferError,
  } = getActions();

  const lang = useLang();
  const shouldSubmit = useRef(true);
  const onSubmitWrapper = useLastCallback((password: string) => {
    if (shouldSubmit.current) {
      shouldSubmit.current = false;

      onSubmit(password);
    }
  });

  useEffectOnce(() => {
    // Reset when the component is mounted, to allow next transfers through
    shouldSubmit.current = true;
  });

  useHistoryBack({
    isActive,
    onBack: onCancel,
  });

  const title = isBurning ? 'Confirm Burning' : 'Confirm Sending';

  return (
    <>
      {!IS_CAPACITOR && <ModalHeader title={lang(title)} onClose={cancelTransfer} />}
      <PasswordForm
        isActive={isActive}
        isLoading={isLoading}
        withCloseButton={Boolean(children)}
        operationType="transfer"
        error={error}
        submitLabel={lang('Send')}
        cancelLabel={lang('Back')}
        onSubmit={onSubmitWrapper}
        onCancel={onCancel}
        onUpdate={clearTransferError}
      >
        {children}
      </PasswordForm>
    </>
  );
}

export default memo(TransferPassword);
