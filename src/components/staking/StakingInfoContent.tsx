import React, {
  memo, useEffect, useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiStakingHistory } from '../../api/types';
import type { UserToken } from '../../global/types';

import { TON_SYMBOL, TON_TOKEN_SLUG } from '../../config';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatRelativeHumanDateTime } from '../../util/dateFormat';
import { formatCurrency } from '../../util/formatNumber';
import { round } from '../../util/round';

import useForceUpdate from '../../hooks/useForceUpdate';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useShowTransition from '../../hooks/useShowTransition';
import useWindowSize from '../../hooks/useWindowSize';

import Button from '../ui/Button';
import Loading from '../ui/Loading';
import ModalHeader from '../ui/ModalHeader';
import RichNumberField from '../ui/RichNumberField';
import { STAKING_DECIMAL } from './StakingInitial';
import StakingProfitItem from './StakingProfitItem';

import styles from './Staking.module.scss';

interface OwnProps {
  isActive?: boolean;
  isStatic?: boolean;
  onClose?: NoneToVoidFunction;
}

interface StateProps {
  amount: number;
  apyValue: number;
  totalProfit: number;
  stakingHistory?: ApiStakingHistory;
  tokens?: UserToken[];
  isUnstakeRequested?: boolean;
  endOfStakingCycle?: number;
}

const UPDATE_UNSTAKE_DATE_INTERVAL_MS = 30000; // 30 sec
const HISTORY_SCROLL_APPEARANCE_HEIGHT_PX = 640;

function StakingInfoContent({
  isActive,
  isStatic,
  amount,
  apyValue,
  totalProfit,
  stakingHistory,
  tokens,
  isUnstakeRequested,
  endOfStakingCycle,
  onClose,
}: OwnProps & StateProps) {
  const { startStaking, fetchStakingHistory } = getActions();

  const lang = useLang();
  const isLoading = !amount;
  const hasHistory = Boolean(stakingHistory?.length);
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isLoading && isActive);
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG)!, [tokens]);
  const forceUpdate = useForceUpdate();
  const { height } = useWindowSize();

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
    startStaking({ isUnstaking: true });
  });

  const stakingResult = round(amount, STAKING_DECIMAL);
  const balanceResult = round(amount + (amount / 100) * apyValue, STAKING_DECIMAL);

  function renderUnstakeDescription() {
    return (
      <div className={buildClassName(styles.unstakeTime, styles.unstakeTime_purple)}>
        <i className={buildClassName(styles.unstakeTimeIcon, 'icon-clock')} aria-hidden />
        {Boolean(endOfStakingCycle) && lang('$unstaking_when_receive', {
          time: <strong>{formatRelativeHumanDateTime(lang.code, endOfStakingCycle)}</strong>,
        })}
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
                {formatCurrency(totalProfit, TON_SYMBOL)}
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
          decimals={STAKING_DECIMAL}
          suffix={TON_SYMBOL}
          className={styles.stakingBalance}
          labelClassName={styles.balanceStakedLabel}
          valueClassName={styles.balanceStakedResult}
        >
          {shouldRenderSpinner && <Loading className={buildClassName(styles.stakingInfoLoading, spinnerClassNames)} />}
        </RichNumberField>
        {isUnstakeRequested
          ? renderUnstakeDescription()
          : (
            <>
              <RichNumberField
                labelText={lang('Est. balance in a year')}
                zeroValue="..."
                value={balanceResult}
                decimals={STAKING_DECIMAL}
                suffix={TON_SYMBOL}
                inputClassName={styles.balanceResultInput}
                labelClassName={styles.balanceStakedLabel}
                valueClassName={styles.balanceResult}
              />
              <div className={styles.stakingInfoButtons}>
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
            </>
          )}
      </div>

      {hasHistory && renderHistory()}
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const accountState = selectCurrentAccountState(global);

  return {
    amount: accountState?.staking?.balance || 0,
    apyValue: accountState?.staking?.apy || 0,
    totalProfit: accountState?.staking?.totalProfit ?? 0,
    stakingHistory: accountState?.stakingHistory,
    tokens: selectCurrentAccountTokens(global),
    isUnstakeRequested: accountState?.staking?.isUnstakeRequested,
    endOfStakingCycle: accountState?.staking?.end,
  };
})(StakingInfoContent));
