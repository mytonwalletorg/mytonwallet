import type { TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';

import styles from './AccountButton.module.scss';

interface StateProps {
  accountLength: number;
  labelText?: string;
  children: TeactNode;
  className?: string;
}

function AccountButtonWrapper({
  accountLength,
  labelText,
  children,
  className,
}: StateProps) {
  const fullClassName = buildClassName(
    className,
    styles.accounts,
    'custom-scroll',
    accountLength === 1 && styles.accounts_single,
    accountLength === 2 && styles.accounts_two,
  );
  return (
    <>
      {labelText && <p className={styles.label}>{labelText}</p>}
      <div className={fullClassName}>
        {children}
      </div>
    </>
  );
}

export default memo(AccountButtonWrapper);
