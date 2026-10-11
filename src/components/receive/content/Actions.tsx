import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiChain } from '../../../api/types';

import { selectIsCurrentAccountViewMode } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { getChainConfig } from '../../../util/chain';
import { getNativeToken } from '../../../util/tokens';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import styles from './Actions.module.scss';

interface OwnProps {
  chain: ApiChain;
  className?: string;
  onClose?: NoneToVoidFunction;
}

interface StateProps {
  isTestnet?: boolean;
  isViewMode?: boolean;
}

function Actions({
  chain,
  className,
  isTestnet,
  isViewMode,
  onClose,
}: OwnProps & StateProps) {
  const {
    openInvoiceModal,
    closeReceiveModal,
  } = getActions();

  const lang = useLang();

  const { formatTransferUrl } = getChainConfig(chain);
  const isDepositLinkSupported = !!formatTransferUrl;
  const shouldRender = isDepositLinkSupported;

  const handleReceiveClick = useLastCallback(() => {
    closeReceiveModal();
    openInvoiceModal({ tokenSlug: getNativeToken(chain).slug });
    onClose?.();
  });

  const contentClassName = buildClassName(
    styles.actionButtons,
    className,
  );

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div className={contentClassName}>
      {isDepositLinkSupported && (
        <div className={styles.actionButton} onClick={handleReceiveClick}>
          <i className={buildClassName(styles.actionIcon, 'icon-link')} aria-hidden />
          {lang('Create Deposit Link')}
          <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
        </div>
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    isViewMode: selectIsCurrentAccountViewMode(global),
  };
})(Actions));
