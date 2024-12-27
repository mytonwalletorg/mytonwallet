import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG, TONCOIN } from '../../../config';
import buildClassName from '../../../util/buildClassName';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import styles from './TonActions.module.scss';

interface OwnProps {
  isStatic?: boolean;
  isLedger?: boolean;
  className?: string;
  onClose?: NoneToVoidFunction;
}

interface StateProps {
  isTestnet?: boolean;
  isSwapDisabled?: boolean;
  isOnRampDisabled?: boolean;
}

function TonActions({
  className,
  isStatic,
  isTestnet,
  isLedger,
  isSwapDisabled,
  isOnRampDisabled,
  onClose,
}: OwnProps & StateProps) {
  const {
    startSwap,
    openOnRampWidgetModal,
    openInvoiceModal,
    closeReceiveModal,
  } = getActions();

  const lang = useLang();

  const isSwapAllowed = !isTestnet && !isLedger && !isSwapDisabled;
  const isOnRampAllowed = !isTestnet && !isOnRampDisabled;

  const handleBuyFiat = useLastCallback(() => {
    openOnRampWidgetModal({ chain: 'ton' });
    onClose?.();
  });

  const handleSwapClick = useLastCallback(() => {
    startSwap({
      tokenInSlug: DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG,
      tokenOutSlug: TONCOIN.slug,
      amountIn: '100',
    });
    onClose?.();
  });

  const handleReceiveClick = useLastCallback(() => {
    closeReceiveModal();
    openInvoiceModal();
    onClose?.();
  });

  const contentClassName = buildClassName(
    styles.actionButtons,
    isStatic && styles.actionButtonStatic,
    className,
  );

  return (
    <div className={contentClassName}>
      {isOnRampAllowed && (
        <div className={styles.actionButton} onClick={handleBuyFiat}>
          <i className={buildClassName(styles.actionIcon, 'icon-card')} aria-hidden />
          {lang('Buy with Card')}
          <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
        </div>
      )}
      {isSwapAllowed && (
        <div className={styles.actionButton} onClick={handleSwapClick}>
          <i className={buildClassName(styles.actionIcon, 'icon-crypto')} aria-hidden />
          {lang('Buy with Crypto')}
          <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
        </div>
      )}
      <div className={styles.actionButton} onClick={handleReceiveClick}>
        <i className={buildClassName(styles.actionIcon, 'icon-link')} aria-hidden />
        {lang('Create Deposit Link')}
        <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { isSwapDisabled, isOnRampDisabled } = global.restrictions;

  return {
    isTestnet: global.settings.isTestnet,
    isSwapDisabled,
    isOnRampDisabled,
  };
})(TonActions));
