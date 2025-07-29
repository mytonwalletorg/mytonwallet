import React, { memo } from '../../../../../lib/teact/teact';
import { getActions } from '../../../../../global';

import useLang from '../../../../../hooks/useLang';

import Button from '../../../../ui/Button';

import styles from './Buttons.module.scss';

function SettingsButton() {
  const { openSettings } = getActions();

  const lang = useLang();

  return (
    <Button
      className={styles.button}
      isText
      isSimple
      kind="transparent"
      ariaLabel={lang('Main menu')}
      onClick={openSettings}
    >
      <i className="icon-cog" aria-hidden />
    </Button>
  );
}

export default memo(SettingsButton);
