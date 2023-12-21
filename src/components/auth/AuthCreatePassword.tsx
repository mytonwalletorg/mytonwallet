import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { AuthMethod } from '../../global/types';

import buildClassName from '../../util/buildClassName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import CreatePasswordForm from '../ui/CreatePasswordForm';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
  method?: AuthMethod;
  isLoading?: boolean;
}

const AuthCreatePassword = ({
  isActive,
  method,
  isLoading,
}: OwnProps) => {
  const { afterCreatePassword, restartAuth } = getActions();

  const lang = useLang();
  const isImporting = method !== 'createAccount';
  const formId = getFormId(method!);

  useHistoryBack({
    isActive,
    onBack: restartAuth,
  });

  const handleSubmit = useLastCallback((password: string, isPasswordNumeric: boolean) => {
    afterCreatePassword({ password, isPasswordNumeric });
  });

  return (
    <div className={buildClassName(styles.container, styles.container_scrollable, 'custom-scroll')}>
      <AnimatedIconWithPreview
        play={isActive}
        tgsUrl={ANIMATED_STICKERS_PATHS.happy}
        previewUrl={ANIMATED_STICKERS_PATHS.happyPreview}
        noLoop={false}
        nonInteractive
        className={styles.sticker}
      />
      <div className={styles.title}>{lang('Congratulations!')}</div>
      <p className={styles.info}>
        <b>{lang(isImporting ? 'The wallet is imported' : 'The wallet is ready')}.</b>
      </p>
      <p className={styles.info}>
        {lang('Create a password to protect it.')}
      </p>

      <CreatePasswordForm
        isActive={isActive}
        isLoading={isLoading}
        formId={formId}
        onCancel={restartAuth}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

// eslint-disable-next-line consistent-return
function getFormId(method: AuthMethod) {
  switch (method) {
    case 'createAccount':
      return 'auth_create_password';
    case 'importMnemonic':
      return 'auth_import_mnemonic_password';
    case 'importHardwareWallet':
      return 'auth_import_hardware_password';
  }
}

export default memo(AuthCreatePassword);
