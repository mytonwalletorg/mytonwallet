import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import renderText from '../../global/helpers/renderText';
import { selectAccount } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useQrCode from '../../hooks/useQrCode';

import Button from '../ui/Button';
import InteractiveTextField from '../ui/InteractiveTextField';

import modalStyles from '../ui/Modal.module.scss';
import styles from './ReceiveModal.module.scss';

interface StateProps {
  address?: string;
  isLedger?: boolean;
}

type OwnProps = {
  isOpen?: boolean;
  isStatic?: boolean;
  onInvoiceModalOpen: NoneToVoidFunction;
};

function Content({
  isOpen, address, isStatic, onInvoiceModalOpen, isLedger,
}: StateProps & OwnProps) {
  const lang = useLang();

  const { qrCodeRef, isInitialized } = useQrCode(address, isOpen, styles.qrCodeHidden, undefined, true);
  const { verifyHardwareAddress } = getActions();

  const handleVerify = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    e.stopPropagation();

    verifyHardwareAddress();
  };

  return (
    <>
      <div className={styles.contentTitle}>
        {renderText(lang('$receive_ton_description'))}
      </div>

      <p className={styles.label}>{lang('Your address')}</p>
      <InteractiveTextField
        address={address!}
        className={isStatic ? styles.copyButtonStatic : undefined}
        copyNotification={lang('Your address was copied!')}
        noSavedAddress
      />

      <div className={buildClassName(styles.qrCode, !isInitialized && styles.qrCodeHidden)} ref={qrCodeRef} />

      {isLedger && (
        <div className={styles.contentTitle}>
          {renderText(lang('$ledger_verify_address'))}
          {' '}
          <a href="#" onClick={handleVerify} className={styles.dottedLink}>
            {lang('Verify now')}
          </a>
        </div>
      )}

      <div className={modalStyles.buttons}>
        <Button onClick={onInvoiceModalOpen} className={styles.invoiceButton}>
          {lang('Create Deposit Link')}
        </Button>
      </div>
    </>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const account = selectAccount(global, global.currentAccountId!);

    return {
      address: account?.address,
      isLedger: Boolean(account?.ledger),
    };
  })(Content),
);
