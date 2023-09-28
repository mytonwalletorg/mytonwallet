import React, { memo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import renderText from '../../global/helpers/renderText';
import { selectAccount } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import InteractiveTextField from '../ui/InteractiveTextField';

import styles from './ReceiveModal.module.scss';

interface StateProps {
  address?: string;
  isLedger?: boolean;
}

type OwnProps = {
  isStatic?: boolean;
  onInvoiceModalOpen: () => void;
  onQrModalOpen: () => void;
};

function Content({
  address, isStatic, onInvoiceModalOpen, onQrModalOpen, isLedger,
}: StateProps & OwnProps) {
  const lang = useLang();

  const { verifyHardwareAddress } = getActions();

  const handleVerify = useLastCallback(() => {
    verifyHardwareAddress();
  });

  return (
    <>
      <div className={buildClassName(styles.info, isStatic && styles.infoStatic)}>
        {renderText(lang('$receive_ton_description'))}
      </div>

      <p className={styles.description}>{lang('Your address')}</p>
      <InteractiveTextField
        address={address!}
        className={isStatic ? styles.copyButtonStatic : undefined}
        copyNotification={lang('Your address was copied!')}
        noSavedAddress
      />

      {isLedger && (
        <div className={buildClassName(styles.info, isStatic && styles.infoStatic)}>
          {renderText(lang('$ledger_verify_address'))}
          {' '}
          <a href="#" onClick={handleVerify} className={styles.dottedLink}>
            {lang('Verify now')}
          </a>
        </div>
      )}

      <div className={styles.buttons}>
        <Button
          className={styles.qrButton}
          onClick={onQrModalOpen}
          ariaLabel={lang('Show QR-Code')}
        >
          <i className={buildClassName('icon-qrcode', styles.qrIcon)} aria-hidden />
        </Button>
        <Button onClick={onInvoiceModalOpen} className={styles.invoiceButton}>
          {lang('Create Invoice')}
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
