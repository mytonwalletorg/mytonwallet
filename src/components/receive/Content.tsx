import React, { memo } from '../../lib/teact/teact';

import { withGlobal } from '../../global';
import renderText from '../../global/helpers/renderText';
import { selectAccount } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import InteractiveTextField from '../ui/InteractiveTextField';

import styles from './ReceiveModal.module.scss';

interface StateProps {
  address?: string;
}

type OwnProps = {
  isStatic?: boolean;
  onInvoiceModalOpen: () => void;
  onQrModalOpen: () => void;
};

function Content({
  address, isStatic, onInvoiceModalOpen, onQrModalOpen,
}: StateProps & OwnProps) {
  const lang = useLang();

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

      <div className={styles.buttons}>
        <Button
          className={styles.qrButton}
          kind={isStatic ? 'lighter' : undefined}
          onClick={onQrModalOpen}
          ariaLabel={lang('Show QR-Code')}
        >
          <i className={buildClassName('icon-qrcode', styles.qrIcon)} aria-hidden />
        </Button>
        <Button kind={isStatic ? 'lighter' : undefined} onClick={onInvoiceModalOpen}>
          {lang('Create Invoice')}
        </Button>
      </div>
    </>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const address = selectAccount(global, global.currentAccountId!)?.address;

    return {
      address,
    };
  })(Content),
);
