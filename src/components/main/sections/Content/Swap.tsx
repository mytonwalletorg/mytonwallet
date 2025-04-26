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
import getPseudoRandomNumber from '../../../../util/getPseudoRandomNumber';
import getSwapRate from '../../../../util/swap/getSwapRate';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useLang from '../../../../hooks/useLang';

import TokenIcon from '../../../common/TokenIcon';
import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Button from '../../../ui/Button';
import SensitiveData from '../../../ui/SensitiveData';

import styles from './Activity.module.scss';

type OwnProps = {
  ref?: Ref<HTMLElement>;
  tokensBySlug?: Record<string, ApiSwapAsset>;
  isLast?: boolean;
  activity: ApiSwapActivity;
  isActive?: boolean;
  appTheme: AppTheme;
  addressByChain?: Account['addressByChain'];
  isSensitiveDataHidden?: boolean;
  isFuture?: boolean;
  onClick?: (id: string) => void;
};

const SWAP_HEIGHT = 4; // rem
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
  isSensitiveDataHidden,
  isFuture,
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
  const amountCols = useMemo(() => getPseudoRandomNumber(5, 13, timestamp.toString()), [timestamp]);

  const isFromToncoin = from === TONCOIN.slug;
  const isInternalSwap = getIsInternalSwap({
    from: fromToken,
    to: toToken,
    toAddress: cex?.payoutAddress,
    addressByChain,
  });

  function renderIcon() {
    return (
      <div className={buildClassName(styles.icon, styles.iconSwap)} aria-hidden>
        {fromToken && <TokenIcon token={fromToken} size="x-middle" className={styles.iconFromToken} />}
        {toToken && <TokenIcon token={toToken} size="x-middle" className={styles.iconToToken} />}
        {isPending && (
          <AnimatedIconWithPreview
            play
            size={ANIMATED_STICKER_TINY_ICON_PX}
            className={styles.iconWaiting}
            nonInteractive
            noLoop={false}
            forceOnHeavyAnimation
            tgsUrl={ANIMATED_STICKERS_PATHS[appTheme].iconClockGray}
            previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview.iconClockGray}
          />
        )}
        {isError && <i className={buildClassName(styles.iconError, 'icon-close-filled')} aria-hidden />}
      </div>
    );
  }

  function renderAmount() {
    const statusClass = buildClassName(isError && styles.swapError, isHold && styles.swapHold);

    return (
      <SensitiveData
        isActive={isSensitiveDataHidden}
        cols={amountCols}
        rows={2}
        cellSize={8}
        align="right"
        contentClassName={buildClassName(styles.amount, styles.swapAmount)}
      >
        <span className={buildClassName(styles.swapSell, statusClass)}>
          {formatCurrencyExtended(
            Math.abs(fromAmount),
            fromToken?.symbol || TONCOIN.symbol,
            true,
          )}
        </span>
        <i
          className={buildClassName(styles.swapArrowRight, 'icon-chevron-right', statusClass)}
          aria-hidden
        />
        <span className={buildClassName(styles.swapBuy, statusClass)}>
          {formatCurrencyExtended(
            Math.abs(toAmount),
            toToken?.symbol || TONCOIN.symbol,
            true,
          )}
        </span>
      </SensitiveData>
    );
  }

  function renderErrorMessage() {
    if (isFuture) {
      return <div />;
    }

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
      <div className={buildClassName(isError && styles.swapError)}>
        {date}{state ? `${WHOLE_PART_DELIMITER}∙${WHOLE_PART_DELIMITER}${state}` : ''}
      </div>
    );
  }

  function renderTitle() {
    if (isHold || isError || isFuture) {
      return lang('$swap_action');
    } else if (isPending) {
      return lang('Swapping');
    }

    return lang('Swapped');
  }

  function renderCurrency() {
    const rate = getSwapRate(activity.fromAmount, activity.toAmount, fromToken, toToken);

    if (!rate) return undefined;

    const [priceWhole, priceFraction] = rate.price.split('.');

    return (
      <span className={styles.address}>
        {rate.firstCurrencySymbol}{' ≈ '}
        <span className={styles.addressValue}>
          {priceWhole}
          <small>.{priceFraction}{' '}{rate.secondCurrencySymbol}</small>
        </span>
      </span>
    );
  }

  return (
    <Button
      ref={ref as RefObject<HTMLButtonElement>}
      className={buildClassName(
        styles.item,
        isLast && styles.itemLast,
        isActive && styles.active,
        onClick && styles.interactive,
      )}
      onClick={onClick && (() => onClick(id))}
      isSimple
    >
      {renderIcon()}
      <div className={styles.header}>
        <div className={buildClassName(styles.operationName, isFuture && styles.atMiddle)}>
          {renderTitle()}
        </div>
        {renderAmount()}
      </div>
      <div className={styles.subheader}>
        {renderErrorMessage()}
        {renderCurrency()}
      </div>
    </Button>
  );
}

export default memo(Swap);

export function getSwapHeight() {
  return SWAP_HEIGHT;
}
