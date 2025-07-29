import React, { memo } from '../../lib/teact/teact';

import Spinner from '../../components/ui/Spinner';

import styles from './LoadingPage.module.scss';

function LoadingPage() {
  return (
    <div className={styles.loadingContainer}>
      <Spinner />
    </div>
  );
}

export default memo(LoadingPage);
