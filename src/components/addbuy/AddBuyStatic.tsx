import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG, TONCOIN_SLUG } from '../../config';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';

import styles from './AddBuyModal.module.scss';

type Props = {
  className?: string;
  isStatic?: boolean;
  isTestnet?: boolean;
  isLedger?: boolean;
  isSwapDisabled?: boolean;
  isOnRampDisabled?: boolean;
  onClose?: NoneToVoidFunction;
};

function AddBuyStatic({
  className,
  isStatic,
  isTestnet,
  isLedger,
  isSwapDisabled,
  isOnRampDisabled,
  onClose,
}: Props) {
  const {
    startSwap,
    openOnRampWidgetModal,
    openReceiveModal,
  } = getActions();

  const lang = useLang();

  const isSwapAllowed = !isTestnet && !isLedger && !isSwapDisabled;
  const isOnRampAllowed = !isTestnet && !isOnRampDisabled;

  const handleBuyFiat = useLastCallback(() => {
    openOnRampWidgetModal();
    onClose?.();
  });

  const handleSwapClick = useLastCallback(() => {
    startSwap({
      tokenInSlug: DEFAULT_CEX_SWAP_SECOND_TOKEN_SLUG,
      tokenOutSlug: TONCOIN_SLUG,
      amountIn: '100',
    });
    onClose?.();
  });

  const handleReceiveClick = useLastCallback(() => {
    openReceiveModal();
    onClose?.();
  });

  const contentClassName = buildClassName(
    styles.actionButtons,
    isStatic && styles.actionButtonStatic,
  );

  const renderActions = () => {
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
          <i className={buildClassName(styles.actionIcon, 'icon-receive')} aria-hidden />
          {lang('Receive with QR or Invoice')}
          <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
        </div>
      </div>
    );
  };

  return (
    <div className={buildClassName(styles.content, className)}>
      {renderActions()}
      {onClose && (
        <Button className={styles.cancelButton} onClick={onClose}>
          {lang('Cancel')}
        </Button>
      )}
    </div>
  );
}

export default memo(AddBuyStatic);
