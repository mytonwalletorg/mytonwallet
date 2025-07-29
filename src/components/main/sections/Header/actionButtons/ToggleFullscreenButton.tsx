import React, { memo } from '../../../../../lib/teact/teact';

import { getTelegramApp } from '../../../../../util/telegram';

import useLang from '../../../../../hooks/useLang';
import useLastCallback from '../../../../../hooks/useLastCallback';

import Button from '../../../../ui/Button';

import styles from './Buttons.module.scss';

interface OwnProps {
  isFullscreen: boolean;
}

function ToggleFullscreenButton({ isFullscreen }: OwnProps) {
  const lang = useLang();

  const handleFullscreenToggle = useLastCallback(() => {
    if (isFullscreen) {
      getTelegramApp()?.exitFullscreen();
    } else {
      getTelegramApp()?.requestFullscreen();
    }
  });

  return (
    <Button
      className={styles.button}
      isText
      isSimple
      kind="transparent"
      ariaLabel={lang('Toggle fullscreen')}
      onClick={handleFullscreenToggle}
    >
      <i className={isFullscreen ? 'icon-fullscreen-exit' : 'icon-fullscreen'} aria-hidden />
    </Button>
  );
}

export default memo(ToggleFullscreenButton);
