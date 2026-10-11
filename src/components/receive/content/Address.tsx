import React, { memo } from '../../../lib/teact/teact';

import type { ApiChain } from '../../../api/types';

import renderText from '../../../global/helpers/renderText';
import buildClassName from '../../../util/buildClassName';
import { getChainTitle } from '../../../util/chain';

import useLang from '../../../hooks/useLang';
import useQrCode from '../../../hooks/useQrCode';

import InteractiveTextField from '../../ui/InteractiveTextField';
import WarningMessage from '../../ui/WarningMessage';
import Actions from './Actions';

import styles from '../ReceiveModal.module.scss';

interface OwnProps {
  chain: ApiChain;
  isActive?: boolean;
  isViewMode?: boolean;
  address: string;
  onClose?: NoneToVoidFunction;
}

function Address({
  chain,
  isActive,
  isViewMode,
  address,
  onClose,
}: OwnProps) {
  const lang = useLang();
  const { qrCodeRef } = useQrCode({
    address,
    chain,
    isActive,
    preferUrl: true,
  });

  return (
    <div>
      <div className={buildClassName(styles.contentTitle, styles.contentTitleQr)}>
        {renderText(lang('$receive_description'))}
      </div>

      <div className={styles.qrCode} ref={qrCodeRef} />

      <InteractiveTextField
        chain={chain}
        address={address}
        className={styles.addressWrapper}
        copyNotification={lang('%chain% Address Copied', { chain: getChainTitle(chain) }) as string}
        noSavedAddress
        noDimming
      />

      {isViewMode && (
        <WarningMessage className={styles.viewModeWarning}>
          {renderText(lang('$view_only_wallet_receive_warning'))}
        </WarningMessage>
      )}

      {!isViewMode && <Actions chain={chain} onClose={onClose} />}
    </div>
  );
}

export default memo(Address);
