import React, {
  memo, useCallback, useEffect, useMemo,
} from '../../lib/teact/teact';

import type { ApiBackendStakingState } from '../../api/types';
import type { UserToken } from '../../global/types';

import { CARD_SECONDARY_VALUE_SYMBOL, TON_TOKEN_SLUG } from '../../config';
import { getActions, withGlobal } from '../../global';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatRelativeHumanDateTime } from '../../util/dateFormat';
import { formatCurrency } from '../../util/formatNumber';
import { round } from '../../util/round';

import useForceUpdate from '../../hooks/useForceUpdate';
import useInterval from '../../hooks/useInterval';
import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';

import Button from '../ui/Button';
import Loading from '../ui/Loading';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import RichNumberField from '../ui/RichNumberField';
import { STAKING_DECIMAL } from './StakingInitial';
import StakingProfitItem from './StakingProfitItem';

import styles from './Staking.module.scss';

interface OwnProps {
  isOpen?: boolean;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  amount: number;
  apyValue: number;
  stakingHistory?: ApiBackendStakingState;
  tokens?: UserToken[];
  isUnstakeRequested?: boolean;
  endOfStakingCycle?: number;
}

const UPDATE_UNSTAKE_DATE_INTERVAL_MS = 30000; // 30 sec

function StakingInfoModal({
  isOpen,
  amount,
  apyValue,
  stakingHistory,
  tokens,
  isUnstakeRequested,
  endOfStakingCycle,
  onClose,
}: OwnProps & StateProps) {
  const { startStaking, fetchBackendStakingState } = getActions();

  const lang = useLang();
  const isLoading = !amount;
  const hasHistory = Boolean(stakingHistory?.profitHistory.length);
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isLoading && isOpen);
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG)!, [tokens]);
  const forceUpdate = useForceUpdate();

  useInterval(forceUpdate, isUnstakeRequested ? UPDATE_UNSTAKE_DATE_INTERVAL_MS : undefined);

  useEffect(() => {
    if (isOpen) {
      fetchBackendStakingState();
    }
  }, [fetchBackendStakingState, isOpen]);

  const handleStakeClick = useCallback(() => {
    onClose();
    startStaking();
  }, [onClose, startStaking]);

  const handleUnstakeClick = useCallback(() => {
    onClose();
    startStaking({ isUnstaking: true });
  }, [onClose, startStaking]);

  const stakingResult = round(amount, STAKING_DECIMAL);
  const balanceResult = round(amount + (amount / 100) * apyValue, STAKING_DECIMAL);

  function renderUnstakeDescription() {
    return (
      <div className={buildClassName(styles.unstakeTime, styles.unstakeTime_purple)}>
        <i className={buildClassName(styles.unstakeTimeIcon, 'icon-clock')} />
        {Boolean(endOfStakingCycle) && lang('$unstaking_when_receive', {
          time: <strong>{formatRelativeHumanDateTime(lang.code, endOfStakingCycle)}</strong>,
        })}
      </div>
    );
  }

  function renderHistory() {
    return (
      <div className={styles.history}>
        <div className={styles.historyTotal}>
          {lang('$total', {
            value: (
              <span className={styles.historyTotalValue}>
                {formatCurrency(stakingHistory!.totalProfit, CARD_SECONDARY_VALUE_SYMBOL)}
              </span>
            ),
          })}
        </div>
        <div className={styles.historyTitle}>{lang('Earning history')}</div>
        <div className={styles.historyList}>
          {stakingHistory?.profitHistory.map((record) => (
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

  return (
    <Modal
      isOpen={isOpen}
      isSlideUp
      onClose={onClose}
      dialogClassName={buildClassName(styles.stakingInfoModal, hasHistory && styles.stakingInfoModal_withHistory)}
    >
      <div className={styles.stakingInfo}>
        <ModalHeader
          title={lang('Staking')}
          closeClassName={styles.stakingInfoClose}
          onClose={onClose}
        />
        <RichNumberField
          labelText={lang('Currently staked')}
          zeroValue="..."
          value={stakingResult}
          decimals={STAKING_DECIMAL}
          suffix={CARD_SECONDARY_VALUE_SYMBOL}
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
                suffix={CARD_SECONDARY_VALUE_SYMBOL}
                inputClassName={styles.balanceResultInput}
                labelClassName={styles.balanceStakedLabel}
                valueClassName={styles.balanceResult}
              />
              <div className={styles.stakingInfoButtons}>
                <Button className={styles.stakingInfoButton} isPrimary onClick={handleStakeClick}>
                  {lang('Stake More')}
                </Button>
                <Button className={styles.stakingInfoButton} onClick={handleUnstakeClick}>{lang('Unstake')}</Button>
              </div>
            </>
          )}
      </div>

      {hasHistory && renderHistory()}
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const accountState = selectCurrentAccountState(global);

  return {
    amount: accountState?.stakingBalance || 0,
    apyValue: accountState?.poolState?.lastApy || 0,
    stakingHistory: accountState?.stakingHistory,
    tokens: selectCurrentAccountTokens(global),
    isUnstakeRequested: accountState?.isUnstakeRequested,
    endOfStakingCycle: accountState?.poolState?.endOfCycle,
  };
})(StakingInfoModal));
