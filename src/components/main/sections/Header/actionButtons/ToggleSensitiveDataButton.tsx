import React, { memo } from '../../../../../lib/teact/teact';
import { getActions } from '../../../../../global';

import useLang from '../../../../../hooks/useLang';
import useLastCallback from '../../../../../hooks/useLastCallback';

import Button from '../../../../ui/Button';

import styles from './Buttons.module.scss';

interface OwnProps {
  isSensitiveDataHidden: boolean;
}

function ToggleSensitiveDataButton({ isSensitiveDataHidden }: OwnProps) {
  const { setIsSensitiveDataHidden } = getActions();

  const lang = useLang();

  const handleSensitiveDataToggle = useLastCallback(() => {
    setIsSensitiveDataHidden({ isHidden: !isSensitiveDataHidden });
  });

  return (
    <Button
      className={styles.button}
      isText
      isSimple
      kind="transparent"
      ariaLabel={lang(isSensitiveDataHidden ? 'Show Sensitive Data' : 'Hide Sensitive Data')}
      onClick={handleSensitiveDataToggle}
    >
      <i className={isSensitiveDataHidden ? 'icon-eye' : 'icon-eye-closed'} aria-hidden />
    </Button>
  );
}

export default memo(ToggleSensitiveDataButton);
