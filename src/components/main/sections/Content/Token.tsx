import React, { memo, useCallback } from '../../../../lib/teact/teact';

import { UserToken } from '../../../../global/types';

import { DEFAULT_PRICE_CURRENCY, TON_TOKEN_SLUG } from '../../../../config';
import { ASSET_LOGO_PATHS } from '../../../ui/helpers/assetLogos';
import buildClassName from '../../../../util/buildClassName';
import { formatCurrency } from '../../../../util/formatNumber';
import { round } from '../../../../util/round';
import { calcChangeValue } from '../../../../util/calcChangeValue';
import useShowTransition from '../../../../hooks/useShowTransition';

import AnimatedCounter from '../../../ui/AnimatedCounter';
import Button from '../../../ui/Button';

import styles from './Token.module.scss';

interface OwnProps {
  token: UserToken;
  stakingStatus?: 'active' | 'unstakeRequested';
  amount?: number;
  isInvestorView?: boolean;
  classNames?: string;
  apyValue?: number;
  onClick: (slug: string) => void;
}

function Token({
  token,
  amount,
  stakingStatus,
  apyValue,
  isInvestorView,
  classNames,
  onClick,
}: OwnProps) {
  const {
    name,
    symbol,
    slug,
    amount: tokenAmount,
    price,
    change24h: change,
    image,
  } = token;

  const renderedAmount = amount ?? tokenAmount;
  const logoPath = image || ASSET_LOGO_PATHS[symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
  const value = renderedAmount * price;
  const changeClassName = change > 0 ? styles.change_up : change < 0 ? styles.change_down : undefined;
  const changeValue = Math.abs(round(calcChangeValue(value, change), 4));
  const changePercent = Math.abs(round(change * 100, 2));
  const withApy = Boolean(apyValue) && slug === TON_TOKEN_SLUG;

  const {
    shouldRender: shouldRenderApy,
    transitionClassNames: renderApyClassNames,
  } = useShowTransition(withApy);

  const handleClick = useCallback(() => {
    onClick(slug);
  }, [onClick, slug]);

  function renderApy() {
    return (
      <span className={buildClassName(styles.apy, stakingStatus && styles.apy_staked, renderApyClassNames)}>
        APY {apyValue}%
      </span>
    );
  }

  function renderChangeIcon() {
    if (change === 0) {
      return undefined;
    }

    return <i className={buildClassName(styles.iconArrow, change > 0 ? 'icon-arrow-up' : 'icon-arrow-down')} />;
  }

  function renderInvestorView() {
    return (
      <Button className={buildClassName(styles.container, classNames)} onClick={handleClick} isSimple>
        <img src={logoPath} alt={symbol} className={styles.icon} />
        {stakingStatus && (
          <i className={buildClassName(stakingStatus === 'active' ? 'icon-percent' : 'icon-clock', styles.percent)} />
        )}
        <div className={styles.primaryCell}>
          <div className={styles.name}>
            {name}
            {shouldRenderApy && renderApy()}
          </div>
          <div className={styles.subtitle}>
            <AnimatedCounter text={formatCurrency(renderedAmount, symbol)} />
            <i className={styles.dot} />
            <AnimatedCounter text={formatCurrency(price, DEFAULT_PRICE_CURRENCY)} />
          </div>
        </div>
        <div className={styles.secondaryCell}>
          <div className={buildClassName(styles.secondaryValue, stakingStatus && styles.secondaryValue_staked)}>
            <AnimatedCounter text={formatCurrency(value, DEFAULT_PRICE_CURRENCY)} />
          </div>
          <div className={buildClassName(styles.change, changeClassName)}>
            {renderChangeIcon()}<AnimatedCounter text={String(changePercent)} />%
            <i className={styles.dot} />
            <AnimatedCounter text={formatCurrency(changeValue, DEFAULT_PRICE_CURRENCY)} />
          </div>
        </div>
        <i className={buildClassName(styles.iconChevron, 'icon-chevron-right')} aria-hidden />
      </Button>
    );
  }

  function renderDefaultView() {
    const totalAmount = renderedAmount * price;

    return (
      <Button className={buildClassName(styles.container, classNames)} onClick={handleClick} isSimple>
        <img src={logoPath} alt={symbol} className={styles.icon} />
        {stakingStatus && (
          <i className={buildClassName(stakingStatus === 'active' ? 'icon-percent' : 'icon-clock', styles.percent)} />
        )}
        <div className={styles.primaryCell}>
          <div className={styles.name}>
            {name}
            {Boolean(apyValue) && slug === TON_TOKEN_SLUG && renderApy()}
          </div>
          <div className={styles.subtitle}>
            <AnimatedCounter text={formatCurrency(price, DEFAULT_PRICE_CURRENCY)} />
            {!stakingStatus && (
              <>
                <i className={styles.dot} />
                <span className={changeClassName}>
                  {renderChangeIcon()}<AnimatedCounter text={String(changePercent)} />%
                </span>
              </>
            )}
          </div>
        </div>
        <div className={styles.secondaryCell}>
          <div className={buildClassName(styles.secondaryValue, stakingStatus && styles.secondaryValue_staked)}>
            <AnimatedCounter text={formatCurrency(renderedAmount, symbol)} />
          </div>
          <div className={styles.subtitle}>
            {totalAmount > 0 ? '≈' : ''}&thinsp;
            <AnimatedCounter text={formatCurrency(totalAmount, DEFAULT_PRICE_CURRENCY)} />
          </div>
        </div>
        <i className={buildClassName(styles.iconChevron, 'icon-chevron-right')} aria-hidden />
      </Button>
    );
  }

  return isInvestorView ? renderInvestorView() : renderDefaultView();
}

export default memo(Token);
