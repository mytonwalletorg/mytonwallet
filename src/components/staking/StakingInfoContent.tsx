import React, {
  memo, type TeactNode, useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiBaseCurrency, ApiCurrencyRates, ApiStakingState, ApiTokenWithPrice,
} from '../../api/types';
import type { Theme, UserToken } from '../../global/types';

import {
  ANIMATED_STICKER_TINY_ICON_PX,
  SHORT_FRACTION_DIGITS,
} from '../../config';
import {
  selectAccountStakingState,
  selectAccountStakingStates,
  selectCurrentAccountId,
  selectCurrentAccountTokens,
  selectIsCurrentAccountViewMode,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatRelativeHumanDateTime } from '../../util/dateFormat';
import { toBig, toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import { getIsNewStakeAllowed, getStakingStateStatus, getUnstakeTime } from '../../util/staking';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useAppTheme from '../../hooks/useAppTheme';
import useForceUpdate from '../../hooks/useForceUpdate';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';
import { useTransitionActiveKey } from '../../hooks/useTransitionActiveKey';
import { useTokenDropdown } from './hooks/useTokenDropdown';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';
import RichNumberField from '../ui/RichNumberField';
import Spinner from '../ui/Spinner';
import TokenDropdown from '../ui/TokenDropdown';
import Transition from '../ui/Transition';

import styles from './Staking.module.scss';

interface OwnProps {
  isActive?: boolean;
  isStatic?: boolean;
  onClose?: NoneToVoidFunction;
}

interface StateProps {
  isViewMode: boolean;
  states?: ApiStakingState[];
  stakingState?: ApiStakingState;
  tokens?: UserToken[];
  tokenBySlug?: Record<string, ApiTokenWithPrice>;
  baseCurrency: ApiBaseCurrency;
  currencyRates: ApiCurrencyRates;
  theme: Theme;
  isSensitiveDataHidden?: true;
}

const UPDATE_UNSTAKE_DATE_INTERVAL_MS = 30000; // 30 sec
const FRACTION_DIGITS = 2;

function StakingInfoContent({
  states,
  stakingState,
  isActive,
  isStatic,
  tokens,
  tokenBySlug,
  baseCurrency,
  currencyRates,
  theme,
  isViewMode,
  isSensitiveDataHidden,
  onClose,
}: OwnProps & StateProps) {
  const {
    startStaking,
    startUnstaking,
    startStakingClaim,
    changeCurrentStaking,
  } = getActions();

  const {
    id: stakingId,
    tokenSlug,
    balance: amount,
    annualYield = 0,
    unstakeRequestAmount,
  } = stakingState ?? {};

  const unstakeTime = getUnstakeTime(stakingState);
  const canBeClaimed = stakingState ? getStakingStateStatus(stakingState) === 'readyToClaim' : undefined;

  const token = useMemo(() => {
    return tokenSlug ? tokens?.find(({ slug }) => tokenSlug === slug) : undefined;
  }, [tokenSlug, tokens]);

  const { decimals, symbol } = token ?? {};

  const lang = useLang();
  const isLoading = amount === undefined;
  const {
    shouldRender: shouldRenderSpinner,
    ref: spinnerRef,
  } = useShowTransition({
    isOpen: isLoading && isActive,
    withShouldRender: true,
  });
  const forceUpdate = useForceUpdate();
  const appTheme = useAppTheme(theme);

  const unclaimedRewards = stakingState?.type === 'jetton'
    ? stakingState.unclaimedRewards
    : undefined;

  // Updates the unstaking countdown
  useInterval(forceUpdate, unstakeRequestAmount ? UPDATE_UNSTAKE_DATE_INTERVAL_MS : undefined);

  const handleStakeClick = useLastCallback(() => {
    onClose?.();
    startStaking();
  });

  const handleUnstakeClick = useLastCallback(() => {
    onClose?.();
    startUnstaking();
  });

  const handleClaimClick = useLastCallback(() => {
    onClose?.();
    startStakingClaim();
  });

  let stakingResult = '0';
  let balanceResult = '0';
  if (amount) {
    stakingResult = toBig(amount, decimals).round(SHORT_FRACTION_DIGITS).toString();
    balanceResult = toBig(amount, decimals)
      .mul((annualYield / 100) + 1)
      .round(SHORT_FRACTION_DIGITS)
      .toString();
  }

  const [selectedToken, selectableTokens] = useTokenDropdown({
    tokenBySlug,
    states,
    selectedStakingId: stakingId,
    isViewMode,
    shouldKeepActiveBlockedStates: true,
    baseCurrency,
    currencyRates,
  });

  function renderUnstakeDescription() {
    let text: string | TeactNode[] | undefined;

    if (unstakeTime) {
      const textKey = '$unstaking_when_receive_with_amount';

      text = lang(textKey, {
        time: (
          <strong>
            {formatRelativeHumanDateTime(lang.code, unstakeTime)}
          </strong>
        ),
        amount: (
          <strong>
            {formatCurrency(toDecimal(unstakeRequestAmount ?? 0n, decimals), symbol!).replace(' ', '\u00A0')}
          </strong>
        ),
      });
    }

    return (
      <div className={buildClassName(styles.unstakeTime, styles.unstakeTime_purple)}>
        <AnimatedIconWithPreview
          play={isActive}
          size={ANIMATED_STICKER_TINY_ICON_PX}
          className={styles.unstakeTimeIcon}
          nonInteractive
          noLoop={false}
          tgsUrl={ANIMATED_STICKERS_PATHS[appTheme].iconClockPurple}
          previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview.iconClockPurple}
        />
        <div>
          {text}
        </div>
      </div>
    );
  }

  const fullClassName = buildClassName(
    styles.stakingInfo,
    !isStatic && styles.stakingInfo_modal,
    styles.stakingInfoNoHistory,
    isStatic && 'staking-info',
  );

  const handleChangeStaking = useLastCallback((id: string) => {
    onClose?.();

    changeCurrentStaking({ stakingId: id, shouldReopenModal: !isStatic });
  });

  function renderRewards() {
    const rewardString = toDecimal(unclaimedRewards!, decimals);

    return (
      <>
        <RichNumberField
          isSensitiveData
          isSensitiveDataHidden={isSensitiveDataHidden}
          sensitiveDataMaskSkin="purple"
          labelText={lang('Accumulated Rewards')}
          zeroValue="..."
          value={rewardString}
          decimals={decimals}
          suffix={symbol}
          className={styles.stakingBalance}
        />
        {!isViewMode && (
          <div className={styles.stakingInfoButtons}>
            <Button
              className={styles.stakingInfoButton}
              isDisabled={isLoading}
              onClick={handleClaimClick}
            >
              {lang('Claim')}
            </Button>
          </div>
        )}
      </>
    );
  }

  function render() {
    return (
      <>
        <div className={fullClassName}>
          {!isStatic && (
            <ModalHeader
              title={lang('Staking')}
              closeClassName={styles.stakingInfoClose}
              onClose={onClose}
            />
          )}

          <RichNumberField
            isSensitiveData
            isSensitiveDataHidden={isSensitiveDataHidden}
            sensitiveDataMaskSkin="purple"
            labelText={lang('Currently Staked')}
            zeroValue="..."
            value={stakingResult}
            decimals={decimals}
            className={styles.stakingBalance}
          >
            <div className={styles.stakingInfoLoading}>
              {shouldRenderSpinner && (
                <Spinner ref={spinnerRef} className={styles.stakingInfoLoadingAnimation} />
              )}
            </div>

            <TokenDropdown
              selectedToken={selectedToken}
              allTokens={selectableTokens}
              theme="purple"
              onChange={handleChangeStaking}
            />

          </RichNumberField>
          {unstakeRequestAmount && unstakeRequestAmount > 0n
            ? renderUnstakeDescription()
            : (
              <>
                <RichNumberField
                  isSensitiveData
                  isSensitiveDataHidden={isSensitiveDataHidden}
                  sensitiveDataMaskSkin="purple"
                  labelText={lang('Est. balance in a year')}
                  zeroValue="..."
                  value={balanceResult}
                  decimals={decimals}
                  suffix={symbol}
                  className={styles.stakingBalance}
                />
                {!isViewMode && (
                  <div
                    className={buildClassName(
                      styles.stakingInfoButtons,
                      !!unclaimedRewards && styles.stakingInfoButtonsWithMargin,
                    )}
                  >
                    {getIsNewStakeAllowed(tokenSlug) && (
                      <Button
                        className={styles.stakingInfoButton}
                        isPrimary
                        isDisabled={isLoading}
                        onClick={handleStakeClick}
                      >
                        {lang('Stake More')}
                      </Button>
                    )}
                    {!canBeClaimed && (
                      <Button
                        className={styles.stakingInfoButton}
                        isDisabled={isLoading}
                        onClick={handleUnstakeClick}
                      >
                        {lang('Unstake')}
                      </Button>
                    )}
                    {canBeClaimed && (
                      <Button
                        className={styles.stakingInfoButton}
                        isDisabled={isLoading}
                        onClick={handleClaimClick}
                      >
                        {lang('Unstake %amount%', {
                          amount: isSensitiveDataHidden
                            ? `*** ${symbol}`
                            : formatCurrency(toDecimal(unstakeRequestAmount!, decimals), symbol!, FRACTION_DIGITS),
                        })}
                      </Button>
                    )}
                  </div>
                )}
                {!!unclaimedRewards && renderRewards()}
              </>
            )}
        </div>

      </>
    );
  }

  // No need to animate if it's in modal (`!isStatic`), because the modal is animated itself
  const activeKey = useTransitionActiveKey([isStatic, stakingId], !isStatic);

  return (
    <Transition
      name="fade"
      activeKey={activeKey}
      shouldCleanup
      className={styles.stakingTransition}
      slideClassName={isStatic ? 'staking-info' : undefined}
    >
      {render()}
    </Transition>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accountId = selectCurrentAccountId(global);
  const {
    settings: { theme, isSensitiveDataHidden },
    tokenInfo: { bySlug: tokenBySlug },
  } = global;

  const states = accountId ? selectAccountStakingStates(global, accountId) : undefined;
  const stakingState = accountId ? selectAccountStakingState(global, accountId) : undefined;

  return {
    stakingState,
    states,
    tokens: selectCurrentAccountTokens(global),
    tokenBySlug,
    baseCurrency: global.settings.baseCurrency,
    currencyRates: global.currencyRates,
    theme,
    isSensitiveDataHidden,
    isViewMode: selectIsCurrentAccountViewMode(global),
  };
})(StakingInfoContent));
