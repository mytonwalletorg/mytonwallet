import type { Ref, RefObject } from 'react';
import type { TeactNode } from '../../../../lib/teact/teact';
import React, { memo, useMemo } from '../../../../lib/teact/teact';

import type { ApiSwapActivity, ApiSwapAsset } from '../../../../api/types';
import type { Account, AppTheme } from '../../../../global/types';

import { ANIMATED_STICKER_TINY_ICON_PX, TONCOIN, WHOLE_PART_DELIMITER } from '../../../../config';
import { getIsInternalSwap, resolveSwapAsset } from '../../../../global/helpers';
import buildClassName from '../../../../util/buildClassName';
import { formatTime } from '../../../../util/dateFormat';
import { formatCurrencyExtended } from '../../../../util/formatNumber';
import getSwapRate from '../../../../util/swap/getSwapRate';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Button from '../../../ui/Button';

import styles from './Transaction.module.scss';

type OwnProps = {
  ref?: Ref<HTMLElement>;
  tokensBySlug?: Record<string, ApiSwapAsset>;
  isLast: boolean;
  activity: ApiSwapActivity;
  isActive: boolean;
  appTheme: AppTheme;
  addressByChain?: Account['addressByChain'];
  onClick: (id: string) => void;
};

const CHANGELLY_PENDING_STATUSES = new Set(['new', 'waiting', 'confirming', 'exchanging', 'sending', 'hold']);
const CHANGELLY_EXPIRED_STATUSES = new Set(['failed', 'expired', 'refunded', 'overdue']);
const ONCHAIN_ERROR_STATUSES = new Set(['expired', 'failed']);

function Swap({
  ref,
  tokensBySlug,
  activity,
  isLast,
  isActive,
  appTheme,
  addressByChain,
  onClick,
}: OwnProps) {
  const lang = useLang();

  const {
    id,
    timestamp,
    status,
    from,
    to,
    cex,
  } = activity;

  const fromToken = useMemo(() => {
    if (!from || !tokensBySlug) return undefined;

    return resolveSwapAsset(tokensBySlug, from);
  }, [from, tokensBySlug]);
  const toToken = useMemo(() => {
    if (!to || !tokensBySlug) return undefined;

    return resolveSwapAsset(tokensBySlug, to);
  }, [to, tokensBySlug]);

  const fromAmount = Number(activity.fromAmount);
  const toAmount = Number(activity.toAmount);
  const isPending = status === 'pending'
    || CHANGELLY_PENDING_STATUSES.has(cex?.status ?? '');
  const isError = ONCHAIN_ERROR_STATUSES.has(status)
    || CHANGELLY_EXPIRED_STATUSES.has(cex?.status ?? '');
  const isHold = cex?.status === 'hold';

  const isFromToncoin = from === TONCOIN.slug;
  const isInternalSwap = getIsInternalSwap({
    from: fromToken,
    to: toToken,
    toAddress: cex?.payoutAddress,
    addressByChain,
  });

  const handleClick = useLastCallback(() => {
    onClick(id);
  });

  const swapIconClass = buildClassName(
    'icon-swap',
    styles.icon_swap,
    isError && styles.icon_error,
  );

  const iconFullClass = buildClassName(
    styles.icon,
    swapIconClass,
  );

  function renderAmount() {
    const amountSwapClass = buildClassName(
      styles.amount,
      styles.swapAmount,
    );

    return (
      <div className={amountSwapClass}>
        <span className={buildClassName(styles.swapSell, isError && styles.swapError)}>
          {formatCurrencyExtended(
            Math.abs(fromAmount),
            fromToken?.symbol || TONCOIN.symbol,
            true,
          )}
        </span>
        <i
          className={buildClassName(
            styles.swapArrowRight,
            'icon-arrow-right',
            isError && styles.swapError,
            isHold && styles.swapHold,
          )}
          aria-hidden
        />
        <span className={buildClassName(
          styles.swapBuy,
          isError && styles.swapError,
          isHold && styles.swapHold,
        )}
        >
          {formatCurrencyExtended(
            Math.abs(toAmount),
            toToken?.symbol || TONCOIN.symbol,
            true,
          )}
        </span>
      </div>
    );
  }

  function renderErrorMessage() {
    const date: string | TeactNode[] = formatTime(timestamp);
    let state = '';
    const cexStatus = cex?.status;

    if (cexStatus === 'expired' || cexStatus === 'overdue') {
      state = lang('Expired');
    } else if (cexStatus === 'refunded') {
      state = lang('Refunded');
    } else if (cexStatus === 'hold') {
      state = lang('On Hold');
    } else if (cexStatus === 'failed' || isError) {
      state = lang('Failed');
    } else if (cexStatus === 'waiting' && !isFromToncoin && !isInternalSwap) {
      // Skip the 'waiting' status for transactions from Toncoin to account or from Tron to Ton
      // inside the multichain wallet for delayed status updates from Сhangelly
      state = lang('Waiting for Payment');
    } else if (isPending) {
      state = lang('In Progress');
    }

    return (
      <div className={buildClassName(isError && styles.isSwapErrorMessage)}>
        {date}{state ? `${WHOLE_PART_DELIMITER}∙${WHOLE_PART_DELIMITER}${state}` : ''}
      </div>
    );
  }

  function renderTitle() {
    if (isHold || isError) {
      return lang('SwapTitle');
    } else if (isPending) {
      return lang('Swapping');
    }

    return lang('Swapped');
  }

  return (
    <Button
      ref={ref as RefObject<HTMLButtonElement>}
      key={id}
      className={buildClassName(
        styles.item,
        isLast && styles.itemLast,
        isActive && styles.active,
      )}
      onClick={handleClick}
      isSimple
    >
      <i className={iconFullClass} aria-hidden />
      {isPending && (
        <AnimatedIconWithPreview
          play
          size={ANIMATED_STICKER_TINY_ICON_PX}
          className={styles.iconWaiting}
          nonInteractive
          noLoop={false}
          forceOnHeavyAnimation
          tgsUrl={ANIMATED_STICKERS_PATHS[appTheme].iconClockGreen}
          previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview.iconClockGreen}
        />
      )}
      {isError && (
        <i
          className={buildClassName(styles.iconError, 'icon-close-filled')}
          aria-hidden
        />
      )}
      <div className={styles.header}>
        <div className={styles.operationName}>
          {renderTitle()}
        </div>
        {renderAmount()}
      </div>
      <div className={styles.subheader}>
        {renderErrorMessage()}
        {renderCurrency(activity, fromToken, toToken)}
      </div>
    </Button>
  );
}

export default memo(Swap);

function renderCurrency(activity: ApiSwapActivity, fromToken?: ApiSwapAsset, toToken?: ApiSwapAsset) {
  const rate = getSwapRate(activity.fromAmount, activity.toAmount, fromToken, toToken);

  return (
    <div className={styles.address}>
      {
        rate && (
          <>
            {rate.firstCurrencySymbol}{' ≈ '}
            <span className={styles.addressValue}>
              {rate.price}{' '}{rate.secondCurrencySymbol}
            </span>
          </>
        )
      }
    </div>
  );
}
