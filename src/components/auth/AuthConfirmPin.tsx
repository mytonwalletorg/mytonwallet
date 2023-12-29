import React, { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { AuthMethod } from '../../global/types';

import { PIN_LENGTH } from '../../config';
import buildClassName from '../../util/buildClassName';
import { pause } from '../../util/schedulers';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import PinPad from '../ui/PinPad';

import styles from './Auth.module.scss';

interface OwnProps {
  isActive?: boolean;
  method?: AuthMethod;
}

interface StateProps {
  pin: string;
}

const SUBMIT_PAUSE_MS = 1500;

const AuthConfirmPin = ({
  isActive,
  method,
  pin,
}: OwnProps & StateProps) => {
  const { confirmPin, cancelConfirmPin } = getActions();

  const lang = useLang();
  const [pinConfirm, setPinConfirm] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const isImporting = method !== 'createAccount';

  const handleBackClick = useLastCallback(() => {
    cancelConfirmPin({ isImporting });
  });

  useHistoryBack({
    isActive,
    onBack: handleBackClick,
  });

  useEffect(() => {
    if (isActive) {
      setPinConfirm('');
      setError('');
      setIsConfirmed(false);
    }
  }, [isActive]);

  const handleChange = useLastCallback((value: string) => {
    setPinConfirm(value);
    setError('');
  });

  const handleSubmit = useLastCallback(async (value: string) => {
    if (value === pin) {
      setIsConfirmed(true);
      await pause(SUBMIT_PAUSE_MS);
      confirmPin({ isImporting });
    } else {
      setError(lang('Codes don\'t match'));
    }
  });

  return (
    <div className={buildClassName(styles.container, styles.containerFullSize)}>
      <Button isSimple isText onClick={handleBackClick} className={styles.headerBack}>
        <i className={buildClassName(styles.iconChevron, 'icon-chevron-left')} aria-hidden />
        <span>{lang('Back')}</span>
      </Button>

      <div className={styles.pinPadHeader}>
        <AnimatedIconWithPreview
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.guard}
          previewUrl={ANIMATED_STICKERS_PATHS.guardPreview}
          noLoop={false}
          nonInteractive
        />
        <div className={styles.title}>{lang(isImporting ? 'Wallet is imported!' : 'Wallet is ready!')}</div>
      </div>

      <PinPad
        isActive={isActive}
        title={isConfirmed ? lang('Code set successfully') : (error || lang('Enter your code again'))}
        type={isConfirmed ? 'success' : (error ? 'error' : undefined)}
        length={PIN_LENGTH}
        value={pinConfirm}
        onChange={handleChange}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global) => {
  return {
    pin: global.auth.password,
  };
})(AuthConfirmPin));
