import React, { memo } from '../../../../../lib/teact/teact';
import { getActions } from '../../../../../global';

import { useDeviceScreen } from '../../../../../hooks/useDeviceScreen';
import useLang from '../../../../../hooks/useLang';
import useLastCallback from '../../../../../hooks/useLastCallback';

import Button from '../../../../ui/Button';

import styles from './Buttons.module.scss';

function ToggleLayoutButton() {
  const { setAppLayout } = getActions();
  const lang = useLang();
  const { isPortrait } = useDeviceScreen();

  const handleAppLayoutToggle = useLastCallback(() => {
    setAppLayout({ layout: isPortrait ? 'landscape' : 'portrait' });
  });

  return (
    <Button
      className={styles.button}
      isText
      isSimple
      kind="transparent"
      ariaLabel={lang(isPortrait ? 'Toggle to landscape layout' : 'Toggle to portrait layout')}
      onClick={handleAppLayoutToggle}
    >
      <i className={isPortrait ? 'icon-view-landscape' : 'icon-view-portrait'} aria-hidden />
    </Button>
  );
}

export default memo(ToggleLayoutButton);
