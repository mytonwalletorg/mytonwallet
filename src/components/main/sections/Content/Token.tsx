import React, { memo } from '../../../../lib/teact/teact';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import { TON_TOKEN_SLUG } from '../../../../config';
import buildClassName from '../../../../util/buildClassName';
import { calcChangeValue } from '../../../../util/calcChangeValue';
import { formatCurrency, getShortCurrencySymbol } from '../../../../util/formatNumber';
import { round } from '../../../../util/round';
import { ASSET_LOGO_PATHS } from '../../../ui/helpers/assetLogos';

import useLastCallback from '../../../../hooks/useLastCallback';
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
  isActive?: boolean;
  onClick: (slug: string) => void;
  baseCurrency?: ApiBaseCurrency;
}

function Token({
  token,
  amount,
  stakingStatus,
  apyValue,
  isInvestorView,
  classNames,
  isActive,
  onClick,
  baseCurrency,
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
  const fullClassName = buildClassName(styles.container, isActive && styles.active, classNames);
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);

  const {
    shouldRender: shouldRenderApy,
    transitionClassNames: renderApyClassNames,
  } = useShowTransition(withApy);

  const handleClick = useLastCallback(() => {
    onClick(slug);
  });

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

    return (
      <i
        className={buildClassName(styles.iconArrow, change > 0 ? 'icon-arrow-up' : 'icon-arrow-down')}
        aria-hidden
      />
    );
  }

  function renderInvestorView() {
    return (
      <Button className={fullClassName} onClick={handleClick} isSimple>
        <img src={logoPath} alt={symbol} className={styles.icon} />
        {stakingStatus && (
          <i
            className={buildClassName(stakingStatus === 'active' ? 'icon-percent' : 'icon-clock', styles.percent)}
            aria-hidden
          />
        )}
        <div className={styles.primaryCell}>
          <div className={buildClassName(styles.name, withApy && styles.name_withApy)}>
            {name}
            {shouldRenderApy && renderApy()}
          </div>
          <div className={styles.subtitle}>
            <AnimatedCounter
              text={formatCurrency(renderedAmount, symbol)}
              key={isInvestorView ? 'investor' : 'default'}
            />
            <i className={styles.dot} aria-hidden />
            <AnimatedCounter text={formatCurrency(price, shortBaseSymbol)} />
          </div>
        </div>
        <div className={styles.secondaryCell}>
          <div className={buildClassName(styles.secondaryValue, stakingStatus && styles.secondaryValue_staked)}>
            <AnimatedCounter text={formatCurrency(value, shortBaseSymbol)} />
          </div>
          <div className={buildClassName(styles.change, changeClassName)}>
            {renderChangeIcon()}<AnimatedCounter text={String(changePercent)} />%
            <i className={styles.dot} aria-hidden />
            <AnimatedCounter text={formatCurrency(changeValue, shortBaseSymbol)} />
          </div>
        </div>
        <i className={buildClassName(styles.iconChevron, 'icon-chevron-right')} aria-hidden />
      </Button>
    );
  }

  function renderDefaultView() {
    const totalAmount = renderedAmount * price;
    const canRenderApy = Boolean(apyValue) && slug === TON_TOKEN_SLUG;

    return (
      <Button className={fullClassName} onClick={handleClick} isSimple>
        <img src={logoPath} alt={symbol} className={styles.icon} />
        {stakingStatus && (
          <i
            className={buildClassName(stakingStatus === 'active' ? 'icon-percent' : 'icon-clock', styles.percent)}
            aria-hidden
          />
        )}
        <div className={styles.primaryCell}>
          <div className={buildClassName(styles.name, canRenderApy && styles.name_withApy)}>
            {name}
            {canRenderApy && renderApy()}
          </div>
          <div className={styles.subtitle}>
            <AnimatedCounter text={formatCurrency(price, shortBaseSymbol)} />
            {!stakingStatus && (
              <>
                <i className={styles.dot} aria-hidden />
                <span className={changeClassName}>
                  {renderChangeIcon()}<AnimatedCounter text={String(changePercent)} />%
                </span>
              </>
            )}
          </div>
        </div>
        <div className={styles.secondaryCell}>
          <div className={buildClassName(styles.secondaryValue, stakingStatus && styles.secondaryValue_staked)}>
            <AnimatedCounter
              text={formatCurrency(renderedAmount, symbol)}
              key={isInvestorView ? 'investor' : 'default'}
            />
          </div>
          <div className={styles.subtitle}>
            {totalAmount > 0 ? '≈' : ''}&thinsp;
            <AnimatedCounter text={formatCurrency(totalAmount, shortBaseSymbol)} />
          </div>
        </div>
        <i className={buildClassName(styles.iconChevron, 'icon-chevron-right')} aria-hidden />
      </Button>
    );
  }

  return isInvestorView ? renderInvestorView() : renderDefaultView();
}

export default memo(Token);
