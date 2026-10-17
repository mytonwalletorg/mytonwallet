import React, { memo, type TeactNode } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { getDoesUsePinPad } from '../../util/biometrics';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import ModalHeader from '../ui/ModalHeader';
import PasswordForm from '../ui/PasswordForm';

interface OwnProps {
  isActive: boolean;
  isLoading?: boolean;
  needsBatch?: boolean;
  error?: string;
  children?: TeactNode;
  onAuthorize: (enclaveToken: string) => void;
  onBack: NoneToVoidFunction;
}

function SwapPassword({
  isActive,
  isLoading,
  needsBatch,
  error,
  children,
  onAuthorize,
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
      {!getDoesUsePinPad() && <ModalHeader title={lang('Confirm Swap')} onClose={cancelSwap} />}
      <PasswordForm
        isActive={isActive}
        isLoading={isLoading}
        error={error}
        operationType="swap"
        submitLabel={lang('Swap')}
        cancelLabel={lang('Back')}
        footerNotice={needsBatch ? lang('$swap_batch_tx_duration_hint') : undefined}
        // An EVM batch whose backend auth token is not cached reads the secret three times: to build
        // the token, to sign the batch, and to submit. Fewer reads are used otherwise, and the
        // session is released when the flow ends.
        extraAuthUsages={2}
        onAuthorize={onAuthorize}
        onCancel={onBack}
        onUpdate={clearSwapError}
      >
        {children}
      </PasswordForm>
    </>
  );
}

export default memo(SwapPassword);
