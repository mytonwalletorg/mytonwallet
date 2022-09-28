import React, { memo, useCallback } from '../../lib/teact/teact';

import { UserToken } from '../../global/types';

import { DEFAULT_PRICE_CURRENCY } from '../../config';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';
import buildClassName from '../../util/buildClassName';
import { formatCurrency } from '../../util/formatNumber';
import { round } from '../../util/round';

import Button from '../ui/Button';

import styles from './Token.module.scss';

interface OwnProps {
  token: UserToken;
  onClick: (slug: string) => void;
}

function Token({
  token,
  onClick,
}: OwnProps) {
  const {
    name,
    symbol,
    slug,
    amount,
    price,
    change24h: change,
    image,
  } = token;

  const logoPath = image || ASSET_LOGO_PATHS[symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
  const value = amount * price;
  const changeClassName = change > 0 ? styles.change_up : change < 0 ? styles.change_down : undefined;
  const changePrefix = change > 0 ? '↑' : change < 0 ? '↓' : undefined;
  const changeValue = Math.abs(round(value * change, 4));
  const changePercent = Math.abs(round(change * 100, 2));

  const handleClick = useCallback(() => {
    onClick(slug);
  }, [onClick, slug]);

  return (
    <Button className={styles.container} onClick={handleClick} isSimple>
      <img src={logoPath} alt={symbol} className={styles.icon} />
      <div className={styles.main}>
        <div className={styles.name}>{name}</div>
        <div className={styles.amount}>
          <span className={styles.amountValue}>{formatCurrency(amount, '')}</span>
          {symbol} · {formatCurrency(price, DEFAULT_PRICE_CURRENCY)}
        </div>
      </div>
      <div className={styles.values}>
        <div className={styles.secondaryValue}>{formatCurrency(value, DEFAULT_PRICE_CURRENCY)}</div>
        <div className={buildClassName(styles.change, changeClassName)}>
          {changePrefix}{changePercent}% · {formatCurrency(changeValue, DEFAULT_PRICE_CURRENCY)}
        </div>
      </div>
      <i className={buildClassName(styles.iconArrow, 'icon-arrow-right')} aria-hidden />
    </Button>
  );
}

export default memo(Token);
