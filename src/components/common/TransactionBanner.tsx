import type { TeactNode } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { ApiSwapAsset, ApiToken } from '../../api/types';
import type { UserSwapToken, UserToken } from '../../global/types';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import TokenIcon from './TokenIcon';

import styles from './TransactionBanner.module.scss';

interface OwnProps {
  tokenIn?: UserToken | UserSwapToken | ApiSwapAsset | ApiToken;
  imageUrl?: string;
  text: string | TeactNode[];
  withChainIcon?: boolean;
  tokenOut?: UserToken | UserSwapToken | ApiSwapAsset | ApiToken;
  secondText?: string;
  color?: 'purple' | 'green';
  className?: string;
}

function TransactionBanner({
  tokenIn,
  imageUrl,
  text,
  withChainIcon,
  tokenOut,
  secondText,
  color,
  className,
}: OwnProps) {
  const lang = useLang();

  const fullClassName = buildClassName(
    styles.root,
    color && styles[color],
    className,
  );

  return (
    <div className={fullClassName}>
      {tokenIn && (
        <TokenIcon
          token={tokenIn}
          withChainIcon={withChainIcon}
          size="small"
          className={styles.tokenIcon}
        />
      )}
      {imageUrl && <img src={imageUrl} alt="" className={styles.image} />}
      <span className={styles.text}>
        {secondText
          ? (
            lang('%amount% to %address%', {
              amount: <span className={styles.bold}>{text}</span>,
              address: <span className={styles.bold}>{secondText}</span>,
            }))
          : <span className={styles.bold}>{text}</span>}
      </span>
      {tokenOut && (
        <TokenIcon
          token={tokenOut}
          withChainIcon={withChainIcon}
          size="small"
          className={styles.tokenIcon}
        />
      )}
    </div>
  );
}

export default memo(TransactionBanner);
