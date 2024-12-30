import React, {
  memo, useEffect, useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiStakingHistory, ApiStakingState, ApiTokenWithPrice } from '../../api/types';
import type { Theme, UserToken } from '../../global/types';

import { ANIMATED_STICKER_TINY_ICON_PX, SHORT_FRACTION_DIGITS, TONCOIN } from '../../config';
import { buildStakingDropdownItems } from '../../global/helpers/staking';
import {
  selectAccountStakingHistory,
  selectAccountStakingState,
  selectAccountStakingStates,
  selectAccountStakingTotalProfit,
  selectCurrentAccountState,
  selectCurrentAccountTokens,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatRelativeHumanDateTime } from '../../util/dateFormat';
import { toBig, toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useAppTheme from '../../hooks/useAppTheme';
import useForceUpdate from '../../hooks/useForceUpdate';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';
import { useTransitionActiveKey } from '../../hooks/useTransitionActiveKey';
import useWindowSize from '../../hooks/useWindowSize';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Dropdown from '../ui/Dropdown';
import ModalHeader from '../ui/ModalHeader';
import RichNumberField from '../ui/RichNumberField';
import Spinner from '../ui/Spinner';
import Transition from '../ui/Transition';
import StakingProfitItem from './StakingProfitItem';

import styles from './Staking.module.scss';

interface OwnProps {
  isActive?: boolean;
  isStatic?: boolean;
  onClose?: NoneToVoidFunction;
}

interface StateProps {
  states?: ApiStakingState[];
  stakingState?: ApiStakingState;
  totalProfit: bigint;
  stakingHistory?: ApiStakingHistory;
  tokens?: UserToken[];
  tokenBySlug?: Record<string, ApiTokenWithPrice>;
  endOfStakingCycle?: number;
  theme: Theme;
  shouldUseNominators?: boolean;
}

const UPDATE_UNSTAKE_DATE_INTERVAL_MS = 30000; // 30 sec
const HISTORY_SCROLL_APPEARANCE_HEIGHT_PX = 640;

function StakingInfoContent({
  states,
  stakingState,
  isActive,
  isStatic,
  totalProfit,
  stakingHistory,
  tokens,
  tokenBySlug,
  endOfStakingCycle,
  theme,
  onClose,
  shouldUseNominators,
}: OwnProps & StateProps) {
  const {
    startStaking,
    startUnstaking,
    startStakingClaim,
    fetchStakingHistory,
    changeCurrentStaking,
  } = getActions();

  const {
    id: stakingId,
    tokenSlug,
    balance: amount = 0n,
    annualYield = 0,
    isUnstakeRequested,
  } = stakingState ?? {};

  const token = useMemo(() => {
    return tokenSlug ? tokens?.find(({ slug }) => tokenSlug === slug) : undefined;
  }, [tokenSlug, tokens]);

  const { decimals, symbol } = token ?? {};

  const lang = useLang();
  const isLoading = !amount;
  const hasHistory = Boolean(stakingHistory?.length);
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isLoading && isActive);
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TONCOIN.slug)!, [tokens]);
  const forceUpdate = useForceUpdate();
  const { height } = useWindowSize();
  const appTheme = useAppTheme(theme);

  const unclaimedRewards = stakingState?.type === 'jetton'
    ? stakingState.unclaimedRewards
    : undefined;

  // Updates the unstaking countdown
  useInterval(forceUpdate, isUnstakeRequested ? UPDATE_UNSTAKE_DATE_INTERVAL_MS : undefined);

  useEffect(() => {
    if (isActive) {
      fetchStakingHistory();
    }
  }, [fetchStakingHistory, isActive]);

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

  const stakingResult = toBig(amount).round(SHORT_FRACTION_DIGITS).toString();
  const balanceResult = toBig(amount).mul((annualYield / 100) + 1).round(SHORT_FRACTION_DIGITS).toString();

  const dropDownItems = useMemo(() => {
    if (!tokenBySlug || !states) {
      return [];
    }

    return buildStakingDropdownItems({ tokenBySlug, states, shouldUseNominators });
  }, [tokenBySlug, states, shouldUseNominators]);

  function renderUnstakeDescription() {
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
          {Boolean(endOfStakingCycle) && lang('$unstaking_when_receive', {
            time: (
              <strong>
                {formatRelativeHumanDateTime(lang.code, endOfStakingCycle)}
              </strong>
            ),
          })}
        </div>
      </div>
    );
  }

  function renderHistory() {
    return (
      <div className={buildClassName(styles.history, isStatic && styles.history_static)}>
        <div className={styles.historyTotal}>
          {lang('$total', {
            value: (
              <span className={styles.historyTotalValue}>
                {formatCurrency(toDecimal(totalProfit), TONCOIN.symbol)}
              </span>
            ),
          })}
        </div>
        <div className={styles.historyTitle}>{lang('Earning History')}</div>
        <div className={buildClassName(
          styles.historyList,
          isStatic && styles.historyList_static,
          isStatic && 'custom-scroll',
          !isStatic && height >= HISTORY_SCROLL_APPEARANCE_HEIGHT_PX && 'custom-scroll',
        )}
        >
          {stakingHistory?.map((record) => (
            <StakingProfitItem
              key={record.timestamp}
              profit={record.profit}
              timestamp={record.timestamp}
              tonToken={tonToken}
            />
          ))}
        </div>
      </div>
    );
  }

  const fullClassName = buildClassName(
    styles.stakingInfo,
    !isStatic && styles.stakingInfo_modal,
    !hasHistory && styles.stakingInfoNoHistory,
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
          labelText={lang('Accumulated Rewards')}
          zeroValue="..."
          value={rewardString}
          decimals={decimals}
          suffix={symbol}
          inputClassName={styles.balanceResultInput}
          labelClassName={styles.balanceStakedLabel}
          valueClassName={styles.balanceResult}
        />
        <div className={styles.stakingInfoButtons}>
          <Button
            className={styles.stakingInfoButton}
            isDisabled={isLoading}
            onClick={handleClaimClick}
          >
            {lang('Claim')}
          </Button>
        </div>
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
            labelText={lang('Currently Staked')}
            zeroValue="..."
            value={stakingResult}
            decimals={decimals}
            className={styles.stakingBalance}
            labelClassName={styles.balanceStakedLabel}
            valueClassName={styles.balanceStakedResult}
          >
            <div className={styles.stakingInfoLoading}>
              {shouldRenderSpinner && (
                <Spinner className={buildClassName(styles.stakingInfoLoadingAnimation, spinnerClassNames)} />
              )}
            </div>

            <Dropdown
              items={dropDownItems}
              selectedValue={stakingId}
              className={styles.tokenDropdown}
              itemClassName={styles.tokenDropdownItem}
              menuClassName={styles.tokenDropdownMenu}
              onChange={handleChangeStaking}
            />

          </RichNumberField>
          {isUnstakeRequested
            ? renderUnstakeDescription()
            : (
              <>
                <RichNumberField
                  labelText={lang('Est. balance in a year')}
                  zeroValue="..."
                  value={balanceResult}
                  decimals={decimals}
                  suffix={symbol}
                  inputClassName={styles.balanceResultInput}
                  labelClassName={styles.balanceStakedLabel}
                  valueClassName={styles.balanceResult}
                />
                <div
                  className={
                    buildClassName(styles.stakingInfoButtons, !!unclaimedRewards && styles.stakingInfoButtonsWithMargin)
                  }
                >
                  <Button
                    className={styles.stakingInfoButton}
                    isPrimary
                    isDisabled={isLoading}
                    onClick={handleStakeClick}
                  >
                    {lang('Stake More')}
                  </Button>
                  <Button
                    className={styles.stakingInfoButton}
                    isDisabled={isLoading}
                    onClick={handleUnstakeClick}
                  >
                    {lang('Unstake')}
                  </Button>
                </div>
                {!!unclaimedRewards && renderRewards()}
              </>
            )}
        </div>

        {hasHistory && renderHistory()}
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
  const accountId = global.currentAccountId;
  const accountState = selectCurrentAccountState(global);

  const states = accountId ? selectAccountStakingStates(global, accountId) : undefined;
  const stakingState = accountId ? selectAccountStakingState(global, accountId) : undefined;

  const endOfStakingCycle = stakingState?.type === 'nominators'
    ? stakingState.end
    : global.stakingInfo?.round.end;

  const stakingHistory = accountId ? selectAccountStakingHistory(global, accountId) : undefined;
  const totalProfit = accountId ? selectAccountStakingTotalProfit(global, accountId) : 0n;

  return {
    stakingState,
    states,
    totalProfit,
    stakingHistory,
    tokens: selectCurrentAccountTokens(global),
    tokenBySlug: global.tokenInfo.bySlug,
    endOfStakingCycle,
    theme: global.settings.theme,
    shouldUseNominators: accountState?.staking?.shouldUseNominators,
  };
})(StakingInfoContent));
