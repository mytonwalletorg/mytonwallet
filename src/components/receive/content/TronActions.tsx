import React, { memo } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiCountryCode } from '../../../api/types';

import { DEFAULT_TRX_SWAP_FIRST_TOKEN_SLUG, TRX } from '../../../config';
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
  countryCode?: ApiCountryCode;
}

function TronActions({
  className,
  isStatic,
  isTestnet,
  isLedger,
  isSwapDisabled,
  isOnRampDisabled,
  countryCode,
  onClose,
}: OwnProps & StateProps) {
  const {
    startSwap,
    openOnRampWidgetModal,
  } = getActions();

  const lang = useLang();

  const canBuyWithCard = countryCode !== 'RU';
  const isSwapAllowed = !isTestnet && !isLedger && !isSwapDisabled;
  // TRX purchase is not possible via the Dreamwalkers service (Russian), however in static mode we show the buy button
  const isOnRampAllowed = !isTestnet && !isOnRampDisabled && (canBuyWithCard || isStatic);
  const shouldRender = Boolean(isSwapAllowed || isOnRampAllowed || isStatic);

  const handleBuyFiat = useLastCallback(() => {
    openOnRampWidgetModal({ chain: 'tron' });
    onClose?.();
  });

  const handleSwapClick = useLastCallback(() => {
    startSwap({
      tokenInSlug: DEFAULT_TRX_SWAP_FIRST_TOKEN_SLUG,
      tokenOutSlug: TRX.slug,
      amountIn: '10',
    });
    onClose?.();
  });

  const contentClassName = buildClassName(
    styles.actionButtons,
    isStatic && styles.actionButtonStatic,
    className,
  );

  if (!shouldRender) {
    return undefined;
  }

  return (
    <div className={contentClassName}>
      {isOnRampAllowed && (
        <div
          className={buildClassName(styles.actionButton, !canBuyWithCard && styles.disabled)}
          onClick={canBuyWithCard ? handleBuyFiat : undefined}
        >
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
      {isStatic && (
        <div className={buildClassName(styles.actionButton, styles.disabled)}>
          <i className={buildClassName(styles.actionIcon, 'icon-link')} aria-hidden />
          {lang('Create Deposit Link')}
          <i className={buildClassName(styles.iconChevronRight, 'icon-chevron-right')} aria-hidden />
        </div>
      )}
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    isSwapDisabled,
    isOnRampDisabled,
    countryCode,
  } = global.restrictions;

  return {
    isTestnet: global.settings.isTestnet,
    isSwapDisabled,
    isOnRampDisabled,
    countryCode,
  };
})(TronActions));
