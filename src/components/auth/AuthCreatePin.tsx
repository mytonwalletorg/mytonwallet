import React, { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

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

const SUBMIT_PAUSE_MS = 750;

const AuthCreatePin = ({
  isActive,
  method,
}: OwnProps) => {
  const { createPin, resetAuth } = getActions();

  const lang = useLang();
  const [pin, setPin] = useState<string>('');
  const isImporting = method !== 'createAccount';

  useEffect(() => {
    if (isActive) {
      setPin('');
    }
  }, [isActive]);

  useHistoryBack({
    isActive,
    onBack: resetAuth,
  });

  const handleSubmit = useLastCallback(async (value: string) => {
    await pause(SUBMIT_PAUSE_MS);
    createPin({ pin: value, isImporting });
  });

  return (
    <div className={buildClassName(styles.container, styles.containerFullSize)}>
      <Button isSimple isText onClick={resetAuth} className={styles.headerBack}>
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
        title={lang('Create a code to protect it')}
        length={PIN_LENGTH}
        value={pin}
        onChange={setPin}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default memo(AuthCreatePin);
