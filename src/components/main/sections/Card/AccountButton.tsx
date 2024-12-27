import React from '../../../../lib/teact/teact';

import type { ApiNft } from '../../../../api/types';
import type { Account } from '../../../../global/types';

import buildClassName from '../../../../util/buildClassName';
import buildStyle from '../../../../util/buildStyle';
import { shortenAddress } from '../../../../util/shortenAddress';
import stopEvent from '../../../../util/stopEvent';

import useCardCustomization from '../../../../hooks/useCardCustomization';
import useLang from '../../../../hooks/useLang';

import styles from './AccountSelector.module.scss';

interface OwnProps {
  isActive: boolean;
  accountId: string;
  addressByChain: Account['addressByChain'];
  isHardware?: boolean;
  title?: string;
  cardBackgroundNft?: ApiNft;
  canEditAccount?: boolean;
  onClick: (accountId: string) => void;
  onEdit: NoneToVoidFunction;
}

const HARDWARE_ACCOUNT_ADDRESS_SHIFT = 3;
const ACCOUNT_ADDRESS_SHIFT = 4;

function AccountButton({
  isActive,
  accountId,
  addressByChain,
  isHardware,
  title,
  cardBackgroundNft,
  canEditAccount,
  onClick,
  onEdit,
}: OwnProps) {
  const lang = useLang();

  const addressOrMultichain = Object.keys(addressByChain).length > 1
    ? lang('Multichain')
    : shortenAddress(
      addressByChain.ton,
      isHardware ? HARDWARE_ACCOUNT_ADDRESS_SHIFT : ACCOUNT_ADDRESS_SHIFT,
      ACCOUNT_ADDRESS_SHIFT,
    );

  const {
    backgroundImageUrl,
    withTextGradient,
    classNames: mtwCardClassNames,
  } = useCardCustomization(cardBackgroundNft);
  const fullClassName = buildClassName(
    styles.button,
    isActive && styles.button_current,
    backgroundImageUrl && styles.customCard,
    mtwCardClassNames,
  );

  const handleEditClick = (e: React.MouseEvent) => {
    stopEvent(e);

    onEdit();
  };

  return (
    <div
      className={fullClassName}
      aria-label={lang('Switch Account')}
      onClick={isActive ? undefined : () => onClick(accountId)}
      style={buildStyle(backgroundImageUrl && `--bg: url(${backgroundImageUrl})`)}
    >
      {title && <span className={buildClassName(styles.accountName, withTextGradient && 'gradientText')}>{title}</span>}
      <div className={buildClassName(styles.accountAddressBlock, withTextGradient && 'gradientText')}>
        {isHardware && <i className="icon-ledger" aria-hidden />}
        <span>{addressOrMultichain}</span>
      </div>

      {isActive && canEditAccount && (
        <div className={styles.edit} onClick={handleEditClick}>
          <i className="icon-pen" aria-hidden />
        </div>
      )}
    </div>
  );
}

export default AccountButton;
