import React from '../../lib/teact/teact';

import type { OwnProps as FeeProps } from '../ui/Fee';

import useLang from '../../hooks/useLang';

import Fee from '../ui/Fee';
import LoadingDots from '../ui/LoadingDots';
import Transition from '../ui/Transition';

import styles from './TransactionFee.module.scss';

interface OwnProps extends Pick<FeeProps, 'terms' | 'token' | 'precision'> {
  isLoading?: boolean;
  className?: string;
}

export default function TransactionFee({ terms, token, precision, isLoading, className }: OwnProps) {
  const lang = useLang();

  return (
    <div className={className}>
      <div className={styles.label}>
        {lang('Fee')}
      </div>
      <div className={styles.field}>
        <Transition activeKey={isLoading ? 1 : 0} name="fade" className={styles.field_transition}>
          {isLoading
            ? <LoadingDots isActive className={styles.field_loading} />
            : <Fee terms={terms} token={token} precision={precision} />}
        </Transition>
      </div>
    </div>
  );
}
