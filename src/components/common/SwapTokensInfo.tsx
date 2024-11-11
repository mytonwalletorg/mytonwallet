import React, { memo } from '../../lib/teact/teact';

import type { ApiSwapAsset } from '../../api/types';
import type { UserSwapToken } from '../../global/types';

import { TOKEN_WITH_LABEL } from '../../config';
import buildClassName from '../../util/buildClassName';
import { formatCurrencyExtended } from '../../util/formatNumber';
import getChainNetworkName from '../../util/swap/getChainNetworkName';
import getSwapRate from '../../util/swap/getSwapRate';

import TokenIcon from './TokenIcon';

import styles from './SwapTokensInfo.module.scss';

interface OwnProps {
  tokenIn?: UserSwapToken | ApiSwapAsset;
  amountIn?: string;
  tokenOut?: UserSwapToken | ApiSwapAsset;
  amountOut?: string;
  isError?: boolean;
}

function SwapTokensInfo({
  tokenIn, amountIn, tokenOut, amountOut, isError = false,
}: OwnProps) {
  function renderTokenInfo(token?: UserSwapToken | ApiSwapAsset, amount = '0', isReceived = false) {
    const amountWithSign = isReceived ? amount : -amount;
    const withLabel = Boolean(token && TOKEN_WITH_LABEL[token.slug]);

    return (
      <div className={buildClassName(styles.infoRow, !token && styles.noIcon, isReceived && styles.noCurrency)}>
        {Boolean(token) && (
          <TokenIcon
            token={token}
            withChainIcon
            className={styles.infoRowIcon}
          />
        )}

        <span className={styles.infoRowToken}>
          {token?.name}
          {withLabel && (
            <span className={buildClassName(styles.label, styles.chainLabel)}>{TOKEN_WITH_LABEL[token!.slug]}</span>
          )}
        </span>
        <span className={buildClassName(
          styles.infoRowAmount,
          isReceived && styles.infoRowAmountGreen,
          isError && styles.infoRowAmountError,
        )}
        >
          {formatCurrencyExtended(amountWithSign, token?.symbol ?? '')}
        </span>
        <span className={styles.infoRowChain}>{getChainNetworkName(token?.chain)}</span>
        {!isReceived && renderCurrency(amountIn, amountOut, tokenIn, tokenOut)}
      </div>
    );
  }

  return (
    <div className={styles.infoBlock}>
      {renderTokenInfo(tokenIn, amountIn)}
      <div className={styles.infoSeparator}>
        <i
          className={buildClassName(
            styles.infoSeparatorIcon,
            isError && styles.infoSeparatorIconError,
            isError ? 'icon-close' : 'icon-arrow-down',
          )}
          aria-hidden
        />
      </div>
      {renderTokenInfo(tokenOut, amountOut, true)}
    </div>
  );
}

export default memo(SwapTokensInfo);

function renderCurrency(amountIn?: string, amountOut?: string, fromToken?: ApiSwapAsset, toToken?: ApiSwapAsset) {
  const rate = getSwapRate(amountIn, amountOut, fromToken, toToken);
  if (!rate) return undefined;

  return (
    <span className={styles.infoRowCurrency}>
      {rate.firstCurrencySymbol} ≈
      <span className={styles.infoRowCurrencyValue}>
        {rate.price}{' '}{rate.secondCurrencySymbol}
      </span>
    </span>
  );
}
