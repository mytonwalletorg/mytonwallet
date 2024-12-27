import React, { memo } from '../../lib/teact/teact';

import type { ApiNft } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import buildStyle from '../../util/buildStyle';
import { shortenAddress } from '../../util/shortenAddress';

import useCardCustomization from '../../hooks/useCardCustomization';

import { ACCOUNT_ADDRESS_SHIFT, HARDWARE_ACCOUNT_ADDRESS_SHIFT } from '../main/sections/Card/AccountSelector';

import styles from './AccountButton.module.scss';

interface StateProps {
  accountId: string;
  address: string;
  title?: string;
  isHardware?: boolean;
  isActive?: boolean;
  isLoading?: boolean;
  ariaLabel?: string;
  className?: string;
  withCheckbox?: boolean;
  cardBackgroundNft?: ApiNft;
  onClick?: NoneToVoidFunction;
}

function AccountButton({
  accountId,
  address,
  title,
  isHardware,
  ariaLabel,
  isActive,
  isLoading,
  className,
  withCheckbox,
  cardBackgroundNft,
  onClick,
}: StateProps) {
  const {
    backgroundImageUrl,
    withTextGradient,
    classNames: mtwCardClassNames,
  } = useCardCustomization(cardBackgroundNft);

  const fullClassName = buildClassName(
    className,
    styles.account,
    backgroundImageUrl && styles.customCard,
    mtwCardClassNames,
    isActive && !withCheckbox && styles.account_current,
    isLoading && styles.account_disabled,
  );

  return (
    <div
      key={accountId}
      className={fullClassName}
      onClick={onClick}
      style={buildStyle(backgroundImageUrl && `--bg: url(${backgroundImageUrl})`)}
      aria-label={ariaLabel}
    >
      {title && <span className={buildClassName(styles.accountName, withTextGradient && 'gradientText')}>{title}</span>}
      <div className={buildClassName(styles.accountFooter, withTextGradient && 'gradientText')}>
        {isHardware && <i className={buildClassName('icon-ledger', isHardware && styles.iconLedger)} aria-hidden />}
        <span className={styles.accountAddress}>
          {shortenAddress(
            address,
            isHardware ? HARDWARE_ACCOUNT_ADDRESS_SHIFT : ACCOUNT_ADDRESS_SHIFT,
            ACCOUNT_ADDRESS_SHIFT,
          )}
        </span>
      </div>
      {withCheckbox
      && <div className={buildClassName(styles.accountCheckMark, isActive && styles.accountCheckMark_active)} />}
    </div>
  );
}

export default memo(AccountButton);
