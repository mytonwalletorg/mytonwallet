import React from '../lib/teact/teact';

import { APP_NAME } from '../config';
import renderText from '../global/helpers/renderText';

import useLang from '../hooks/useLang';
import useLastCallback from '../hooks/useLastCallback';

import Button from './ui/Button';

import styles from './AppInactive.module.scss';

import appInactivePathPng from '../assets/app-inactive.png';
import appInactivePathWebP from '../assets/app-inactive.webp';

function AppInactive() {
  const lang = useLang();

  const handleReload = useLastCallback(() => {
    window.location.reload();
  });

  return (
    <div className={styles.root}>
      <div className={styles.content}>
        <picture className={styles.img}>
          <source src={appInactivePathWebP} />
          <img src={appInactivePathPng} alt="" className={styles.img} />
        </picture>

        <h3 className={styles.title}>{lang('Such error, many tabs')}</h3>

        <div className={styles.description}>
          {renderText(lang('$many_tabs_error_description', { app_name: APP_NAME }))}
        </div>

        <div className={styles.actions}>
          <Button isText className={styles.button} onClick={handleReload}>
            {lang('Reload App')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AppInactive;
