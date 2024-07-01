import React, { memo } from '../../../../lib/teact/teact';

import type { ApiBaseCurrency } from '../../../../api/types';
import type { UserToken } from '../../../../global/types';

import { TONCOIN_SLUG } from '../../../../config';
import { Big } from '../../../../lib/big.js';
import buildClassName from '../../../../util/buildClassName';
import { calcChangeValue } from '../../../../util/calcChangeValue';
import { formatFullDay } from '../../../../util/dateFormat';
import { toDecimal } from '../../../../util/decimals';
import { formatCurrency, getShortCurrencySymbol } from '../../../../util/formatNumber';
import { round } from '../../../../util/round';
import { ASSET_LOGO_PATHS } from '../../../ui/helpers/assetLogos';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useShowTransition from '../../../../hooks/useShowTransition';

import AnimatedCounter from '../../../ui/AnimatedCounter';
import Button from '../../../ui/Button';

import styles from './Token.module.scss';

interface OwnProps {
  token: UserToken;
  stakingStatus?: 'active' | 'unstakeRequested';
  vestingStatus?: 'frozen' | 'readyToUnfreeze';
  unfreezeEndDate?: number;
  amount?: string;
  isInvestorView?: boolean;
  classNames?: string;
  style?: string;
  apyValue?: number;
  isActive?: boolean;
  baseCurrency?: ApiBaseCurrency;
  onClick: (slug: string) => void;
}

const DAY = 1000 * 60 * 60 * 24;
const UNFREEZE_DANGER_DURATION = 7 * DAY;

function Token({
  token,
  amount,
  stakingStatus,
  vestingStatus,
  unfreezeEndDate,
  apyValue,
  isInvestorView,
  classNames,
  style,
  isActive,
  baseCurrency,
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
    decimals,
  } = token;

  const lang = useLang();

  const isVesting = Boolean(vestingStatus?.length);
  const renderedAmount = amount ?? toDecimal(tokenAmount, decimals, true);
  const logoPath = image || ASSET_LOGO_PATHS[symbol.toLowerCase() as keyof typeof ASSET_LOGO_PATHS];
  const value = Big(renderedAmount).mul(price).toString();
  const changeClassName = change > 0 ? styles.change_up : change < 0 ? styles.change_down : undefined;
  const changeValue = Math.abs(round(calcChangeValue(Number(value), change), 4));
  const changePercent = Math.abs(round(change * 100, 2));
  const withApy = Boolean(apyValue) && slug === TONCOIN_SLUG;
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
      <Button className={fullClassName} isSimple style={style} onClick={handleClick}>
        <img src={logoPath} alt={symbol} className={styles.icon} />
        {stakingStatus && (
          <i
            className={buildClassName(stakingStatus === 'active' ? 'icon-percent' : 'icon-clock', styles.percent)}
            aria-hidden
          />
        )}
        {vestingStatus && (
          <i
            className={buildClassName(vestingStatus === 'frozen' ? 'icon-snow' : 'icon-fire', styles.vestingIcon)}
            aria-hidden
          />
        )}
        <div className={styles.primaryCell}>
          <div className={buildClassName(styles.name, withApy && styles.name_withApy)}>
            {name}
            {shouldRenderApy && renderApy()}
          </div>
          <div className={styles.subtitle}>
            <AnimatedCounter text={formatCurrency(renderedAmount, symbol)} />
            <i className={styles.dot} aria-hidden />
            <AnimatedCounter text={formatCurrency(price, shortBaseSymbol, undefined, true)} />
          </div>
        </div>
        <div className={styles.secondaryCell}>
          <div className={buildClassName(
            styles.secondaryValue,
            stakingStatus && styles.secondaryValue_staked,
            isVesting && styles.secondaryValue_vesting,
            isVesting && vestingStatus === 'readyToUnfreeze' && styles.secondaryValue_vestingUnfreeze,
          )}
          >
            <AnimatedCounter text={formatCurrency(value, shortBaseSymbol)} />
          </div>
          {unfreezeEndDate ? (
            <div
              className={buildClassName(
                styles.change,
                (unfreezeEndDate - Date.now() < UNFREEZE_DANGER_DURATION) && styles.change_down,
              )}
            >
              {lang('Unfreeze')}
              {' '}
              {lang('until %date%', { date: `${formatFullDay(lang.code!, unfreezeEndDate)}` })}
            </div>
          ) : (
            <div className={buildClassName(styles.change, changeClassName)}>
              {renderChangeIcon()}<AnimatedCounter text={String(changePercent)} />%
              <i className={styles.dot} aria-hidden />
              <AnimatedCounter text={formatCurrency(changeValue, shortBaseSymbol, undefined, true)} />
            </div>
          )}
        </div>
        <i className={buildClassName(styles.iconChevron, 'icon-chevron-right')} aria-hidden />
      </Button>
    );
  }

  function renderDefaultView() {
    const totalAmount = Big(renderedAmount).mul(price);
    const canRenderApy = Boolean(apyValue) && slug === TONCOIN_SLUG;

    return (
      <Button className={fullClassName} style={style} onClick={handleClick} isSimple>
        <img src={logoPath} alt={symbol} className={styles.icon} />
        {stakingStatus && (
          <i
            className={buildClassName(stakingStatus === 'active' ? 'icon-percent' : 'icon-clock', styles.percent)}
            aria-hidden
          />
        )}
        {vestingStatus && (
          <i
            className={buildClassName(vestingStatus === 'frozen' ? 'icon-snow' : 'icon-fire', styles.vestingIcon)}
            aria-hidden
          />
        )}
        <div className={styles.primaryCell}>
          <div className={buildClassName(styles.name, canRenderApy && styles.name_withApy)}>
            {name}
            {canRenderApy && renderApy()}
          </div>
          <div className={styles.subtitle}>
            <AnimatedCounter text={formatCurrency(price, shortBaseSymbol, undefined, true)} />
            {!stakingStatus && (
              <>
                <i className={styles.dot} aria-hidden />
                {unfreezeEndDate ? (
                  <span className={(unfreezeEndDate - Date.now() < UNFREEZE_DANGER_DURATION) && styles.change_down}>
                    {lang('Unfreeze')}
                    {' '}
                    {lang('until %date%', { date: `${formatFullDay(lang.code!, unfreezeEndDate)}` })}
                  </span>
                ) : (
                  <span className={changeClassName}>
                    {renderChangeIcon()}<AnimatedCounter text={String(changePercent)} />%
                  </span>
                )}
              </>
            )}
          </div>
        </div>
        <div className={styles.secondaryCell}>
          <div className={buildClassName(
            styles.secondaryValue,
            stakingStatus && styles.secondaryValue_staked,
            isVesting && styles.secondaryValue_vesting,
            isVesting && vestingStatus === 'readyToUnfreeze' && styles.secondaryValue_vestingUnfreeze,
          )}
          >
            <AnimatedCounter text={formatCurrency(renderedAmount, symbol)} />
          </div>
          <div className={styles.subtitle}>
            {totalAmount.gt(0) ? '≈' : ''}&thinsp;
            <AnimatedCounter text={formatCurrency(totalAmount, shortBaseSymbol, undefined, true)} />
          </div>
        </div>
        <i className={buildClassName(styles.iconChevron, 'icon-chevron-right')} aria-hidden />
      </Button>
    );
  }

  return isInvestorView ? renderInvestorView() : renderDefaultView();
}

export default memo(Token);
