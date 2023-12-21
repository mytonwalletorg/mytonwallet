import React, { memo } from '../../lib/teact/teact';

import type { ApiSwapAsset } from '../../api/types';
import type { UserSwapToken } from '../../global/types';

import buildClassName from '../../util/buildClassName';
import { formatCurrencyExtended } from '../../util/formatNumber';
import getBlockchainNetworkName from '../../util/swap/getBlockchainNetworkName';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import styles from './SwapTokensInfo.module.scss';

interface OwnProps {
  tokenIn?: UserSwapToken | ApiSwapAsset;
  amountIn?: number;
  tokenOut?: UserSwapToken | ApiSwapAsset;
  amountOut?: number;
  isError?: boolean;
}

function SwapTokensInfo({
  tokenIn, amountIn, tokenOut, amountOut, isError = false,
}: OwnProps) {
  function renderTokenInfo(token?: UserSwapToken | ApiSwapAsset, amount = 0, isReceived = false) {
    const image = token?.image ?? ASSET_LOGO_PATHS[token?.symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
    const amountWithSign = isReceived ? amount : -amount;
    return (
      <div className={styles.infoRow}>
        <div className={styles.infoRowToken}>
          <img
            src={image}
            alt={token?.symbol}
            className={styles.infoRowIcon}
          />
          <div className={styles.infoRowText}>
            <span className={styles.infoRowTitle}>{token?.name}</span>
            <span className={styles.infoRowDescription}>{getBlockchainNetworkName(token?.blockchain)}</span>
          </div>
        </div>
        <div className={buildClassName(styles.infoRowText, styles.infoRowTextCenter)}>
          <span className={buildClassName(
            styles.infoRowAmount,
            isReceived && styles.infoRowAmountGreen,
            isError && styles.infoRowAmountError,
          )}
          >{formatCurrencyExtended(amountWithSign, token?.symbol ?? '')}
          </span>
        </div>
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
