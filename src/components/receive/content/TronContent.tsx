import React, { memo } from '../../../lib/teact/teact';

import renderText from '../../../global/helpers/renderText';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useQrCode from '../../../hooks/useQrCode';

import InteractiveTextField from '../../ui/InteractiveTextField';

import styles from '../ReceiveModal.module.scss';

interface OwnProps {
  isActive?: boolean;
  isStatic?: boolean;
  address: string;
}

function TronContent({
  isActive,
  isStatic,
  address,
}: OwnProps) {
  const lang = useLang();
  const { qrCodeRef, isInitialized } = useQrCode({
    address,
    chain: 'tron',
    isActive,
    hiddenClassName: styles.qrCodeHidden,
    withFormatTransferUrl: true,
  });
  const qrClassNames = buildClassName(
    styles.qrCode,
    isStatic && styles.qrCodeStatic,
    !isInitialized && styles.qrCodeHidden,
  );

  return (
    <div>
      <div className={buildClassName(styles.contentTitle, styles.contentTitleQr)}>
        {renderText(lang('$receive_tron_description'))}
      </div>

      <div className={qrClassNames} ref={qrCodeRef} />

      <InteractiveTextField
        chain="tron"
        address={address!}
        className={isStatic ? styles.copyButtonStatic : styles.addressWrapper}
        copyNotification={lang('Your address was copied!')}
        noSavedAddress
      />
    </div>
  );
}

export default memo(TronContent);
