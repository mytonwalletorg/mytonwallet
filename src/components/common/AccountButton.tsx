import React, { memo } from '../../lib/teact/teact';

import type { ApiChain } from '../../api/types';
import type { Account, AccountType } from '../../global/types';

import buildClassName from '../../util/buildClassName';
import { getOrderedAccountChains } from '../../util/chain';
import { formatAccountAddresses } from '../../util/formatAccountAddress';

import styles from './AccountButton.module.scss';

interface OwnProps {
  accountId: string;
  byChain: Account['byChain'];
  visibleChains?: ApiChain[];
  title?: string;
  accountType: AccountType;
  isActive?: boolean;
  isLoading?: boolean;
  ariaLabel?: string;
  className?: string;
  titleClassName?: string;
  withCheckbox?: boolean;
  onClick?: NoneToVoidFunction;
}

function AccountButton({
  accountId,
  byChain,
  visibleChains,
  title,
  accountType,
  ariaLabel,
  isActive,
  isLoading,
  className,
  titleClassName,
  withCheckbox,
  onClick,
}: OwnProps) {
  const isViewMode = accountType === 'view';
  const fullClassName = buildClassName(
    className,
    styles.account,
    isActive && !withCheckbox && styles.account_current,
    isLoading && styles.account_disabled,
    !onClick && styles.account_inactive,
  );

  const chains = visibleChains ?? getOrderedAccountChains(byChain);
  const formattedAddress = formatAccountAddresses(byChain, chains, 'x-small');

  return (
    <div
      key={accountId}
      className={fullClassName}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {title && (
        <span className={buildClassName(styles.accountName, titleClassName)}>
          {title}
        </span>
      )}
      <div className={buildClassName(styles.accountFooter)}>
        {isViewMode && <i className={buildClassName('icon-eye-filled', styles.icon)} aria-hidden />}
        <span className={styles.accountAddress}>
          {formattedAddress}
        </span>
      </div>
      {withCheckbox
        && <div className={buildClassName(styles.accountCheckMark, isActive && styles.accountCheckMark_active)} />}
    </div>
  );
}

export default memo(AccountButton);
