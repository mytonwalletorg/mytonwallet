import React, { memo, useMemo } from '../../../../lib/teact/teact';

import type { ApiBaseCurrency, ApiYieldType } from '../../../../api/types';
import type { StakingStateStatus } from '../../../../global/helpers/staking';
import type { AppTheme, UserToken } from '../../../../global/types';

import { ANIMATED_STICKER_TINY_ICON_PX, IS_CORE_WALLET, TOKEN_WITH_LABEL } from '../../../../config';
import { Big } from '../../../../lib/big.js';
import buildClassName from '../../../../util/buildClassName';
import { calcChangeValue } from '../../../../util/calcChangeValue';
import { DAY, formatFullDay } from '../../../../util/dateFormat';
import { toDecimal } from '../../../../util/decimals';
import { formatCurrency, getShortCurrencySymbol } from '../../../../util/formatNumber';
import getPseudoRandomNumber from '../../../../util/getPseudoRandomNumber';
import { round } from '../../../../util/round';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';
import useShowTransition from '../../../../hooks/useShowTransition';

import TokenIcon from '../../../common/TokenIcon';
import AnimatedCounter from '../../../ui/AnimatedCounter';
import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Button from '../../../ui/Button';
import SensitiveData from '../../../ui/SensitiveData';

import styles from './Token.module.scss';

interface OwnProps {
  token: UserToken;
  stakingId?: string;
  // Undefined means that it's not a staked token
  stakingStatus?: StakingStateStatus;
  vestingStatus?: 'frozen' | 'readyToUnfreeze';
  unfreezeEndDate?: number;
  amount?: string;
  isInvestorView?: boolean;
  classNames?: string;
  style?: string;
  annualYield?: number;
  yieldType?: ApiYieldType;
  isActive?: boolean;
  baseCurrency?: ApiBaseCurrency;
  appTheme: AppTheme;
  withChainIcon?: boolean;
  isSensitiveDataHidden?: true;
  onClick: (slug: string) => void;
}

const UNFREEZE_DANGER_DURATION = 7 * DAY;

function Token({
  token,
  amount,
  stakingId,
  stakingStatus,
  vestingStatus,
  unfreezeEndDate,
  annualYield,
  isInvestorView,
  classNames,
  style,
  appTheme,
  isActive,
  baseCurrency,
  withChainIcon,
  isSensitiveDataHidden,
  yieldType,
  onClick,
}: OwnProps) {
  const {
    name,
    symbol,
    slug,
    amount: tokenAmount,
    price,
    change24h: change,
    decimals,
  } = token;

  const lang = useLang();

  const isVesting = Boolean(vestingStatus?.length);
  const renderedAmount = amount ?? toDecimal(tokenAmount, decimals, true);
  const value = Big(renderedAmount).mul(price).toString();
  const changeClassName = change > 0 ? styles.change_up : change < 0 ? styles.change_down : undefined;
  const changeValue = Math.abs(round(calcChangeValue(Number(value), change), 4));
  const changePercent = Math.abs(round(change * 100, 2));
  const withYield = !IS_CORE_WALLET && annualYield !== undefined;
  const fullClassName = buildClassName(styles.container, isActive && styles.active, classNames);
  const shortBaseSymbol = getShortCurrencySymbol(baseCurrency);
  const withLabel = Boolean(!isVesting && TOKEN_WITH_LABEL[slug]);
  const amountCols = useMemo(() => getPseudoRandomNumber(4, 12, name), [name]);
  const fiatAmountCols = 5 + (amountCols % 6);

  const {
    shouldRender: shouldRenderYield,
    transitionClassNames: renderYieldClassNames,
  } = useShowTransition(withYield);

  const handleClick = useLastCallback(() => {
    onClick(stakingId ?? slug);
  });

  function renderYield() {
    const labelClassName = buildClassName(
      styles.label,
      styles.apyLabel,
      stakingStatus && styles.apyLabel_staked,
      renderYieldClassNames,
    );

    return (
      <span className={labelClassName}>
        {yieldType} {annualYield}%
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

  function renderStakingIcon() {
    if (stakingStatus === 'active') {
      return (
        <i
          className={buildClassName('icon-percent', styles.percent)}
          aria-hidden
        />
      );
    }

    if (stakingStatus === 'readyToClaim') {
      return (
        <i
          className={buildClassName('icon-check-alt', styles.readyToClaim)}
          aria-hidden
        />
      );
    }

    return (
      <AnimatedIconWithPreview
        play
        size={ANIMATED_STICKER_TINY_ICON_PX}
        className={styles.percent}
        nonInteractive
        noLoop={false}
        tgsUrl={ANIMATED_STICKERS_PATHS[appTheme].iconClockPurple}
        previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview.iconClockPurple}
      />
    );
  }

  function renderInvestorView() {
    return (
      <Button className={fullClassName} isSimple style={style} onClick={handleClick}>
        <TokenIcon
          size="large"
          token={token}
          withChainIcon={withChainIcon}
          className={styles.tokenIcon}
        >
          <>
            {stakingStatus && renderStakingIcon()}
            {vestingStatus && (
              <i
                className={buildClassName(vestingStatus === 'frozen' ? 'icon-snow' : 'icon-fire', styles.vestingIcon)}
                aria-hidden
              />
            )}
          </>
        </TokenIcon>
        <div className={styles.primaryCell}>
          <div className={styles.name}>
            <span className={styles.nameText}>{name}</span>
            {shouldRenderYield && renderYield()}
            {withLabel && (
              <span className={buildClassName(styles.label, styles.chainLabel)}>{TOKEN_WITH_LABEL[slug]}</span>
            )}
          </div>
          <div className={styles.subtitle}>
            <SensitiveData
              isActive={isSensitiveDataHidden}
              cols={fiatAmountCols}
              rows={2}
              cellSize={8}
            >
              <AnimatedCounter text={formatCurrency(renderedAmount, symbol)} />
            </SensitiveData>
            <i className={styles.dot} aria-hidden />
            <AnimatedCounter text={formatCurrency(price, shortBaseSymbol, undefined, true)} />
          </div>
        </div>
        <div className={styles.secondaryCell}>
          <SensitiveData
            isActive={isSensitiveDataHidden}
            cols={amountCols}
            rows={2}
            cellSize={8}
            align="right"
            className={buildClassName(
              styles.secondaryValue,
              stakingStatus && styles.secondaryValue_staked,
              isVesting && styles.secondaryValue_vesting,
              isVesting && vestingStatus === 'readyToUnfreeze' && styles.secondaryValue_vestingUnfreeze,
            )}
          >
            <AnimatedCounter text={formatCurrency(value, shortBaseSymbol)} />
          </SensitiveData>
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
            <SensitiveData
              isActive={isSensitiveDataHidden}
              cols={fiatAmountCols}
              rows={2}
              cellSize={8}
              align="right" className={buildClassName(styles.change, changeClassName)}>
              {renderChangeIcon()}<AnimatedCounter text={String(changePercent)} />%
              <i className={styles.dot} aria-hidden />
              <AnimatedCounter text={formatCurrency(changeValue, shortBaseSymbol, undefined, true)} />
            </SensitiveData>
          )}
        </div>
      </Button>
    );
  }

  function renderDefaultView() {
    const totalAmount = Big(renderedAmount).mul(price);
    const canRenderYield = annualYield !== undefined;

    return (
      <Button className={fullClassName} style={style} onClick={handleClick} isSimple>
        <TokenIcon
          token={token}
          size="large"
          withChainIcon={withChainIcon}
          className={styles.tokenIcon}
        >
          <>
            {stakingStatus && renderStakingIcon()}
            {vestingStatus && (
              <i
                className={buildClassName(vestingStatus === 'frozen' ? 'icon-snow' : 'icon-fire', styles.vestingIcon)}
                aria-hidden
              />
            )}
          </>
        </TokenIcon>
        <div className={styles.primaryCell}>
          <div className={styles.name}>
            <span className={styles.nameText}>{name}</span>
            {canRenderYield && renderYield()}
            {withLabel && (
              <span className={buildClassName(styles.label, styles.chainLabel)}>{TOKEN_WITH_LABEL[slug]}</span>
            )}
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
          <SensitiveData
            isActive={isSensitiveDataHidden}
            cols={amountCols}
            rows={2}
            cellSize={8}
            align="right" className={buildClassName(
              styles.secondaryValue,
              stakingStatus && styles.secondaryValue_staked,
              isVesting && styles.secondaryValue_vesting,
              isVesting && vestingStatus === 'readyToUnfreeze' && styles.secondaryValue_vestingUnfreeze,
            )}
          >
            <AnimatedCounter text={formatCurrency(renderedAmount, symbol)} />
          </SensitiveData>
          <SensitiveData
            isActive={isSensitiveDataHidden}
            cols={fiatAmountCols}
            rows={2}
            cellSize={8}
            align="right"
            className={styles.subtitle}
          >
            {totalAmount.gt(0) ? '≈' : ''}&thinsp;
            <AnimatedCounter text={formatCurrency(totalAmount, shortBaseSymbol, undefined, true)} />
          </SensitiveData>
        </div>
      </Button>
    );
  }

  return isInvestorView ? renderInvestorView() : renderDefaultView();
}

export default memo(Token);
