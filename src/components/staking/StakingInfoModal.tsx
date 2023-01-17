import React, { memo, useCallback } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { CARD_SECONDARY_VALUE_SYMBOL } from '../../config';
import { STAKING_DECIMAL } from './StakingInitial';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { selectCurrentAccountState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { round } from '../../util/round';
import useLang from '../../hooks/useLang';
import useShowTransition from '../../hooks/useShowTransition';

import InputNumberRich from '../ui/InputNumberRich';
import Modal from '../ui/Modal';
import ModalHeader from '../ui/ModalHeader';
import Button from '../ui/Button';
import Loading from '../ui/Loading';

import styles from './Staking.module.scss';

interface OwnProps {
  isOpen?: boolean;
  onClose: NoneToVoidFunction;
}

interface StateProps {
  amount: number;
  apyValue: number;
}

function StakingInfoModal({
  isOpen,
  amount,
  apyValue,
  onClose,
}: OwnProps & StateProps) {
  const { startStaking } = getActions();

  const lang = useLang();
  const isLoading = !amount;
  const {
    shouldRender: shouldRenderSpinner,
    transitionClassNames: spinnerClassNames,
  } = useShowTransition(isLoading && isOpen);

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
  const infoFullClass = buildClassName(styles.stakingInfo, IS_SINGLE_COLUMN_LAYOUT && styles.stakingInfo_forSlideUp);

  return (
    <Modal
      isOpen={isOpen}
      isSlideUp
      onClose={onClose}
    >
      <div className={infoFullClass}>
        <ModalHeader
          title={lang('Staking')}
          closeClassName={styles.stakingInfoClose}
          onClose={onClose}
        />
        <InputNumberRich
          labelText={lang('Currently staked')}
          isReadable
          zeroValue="..."
          value={stakingResult}
          decimals={STAKING_DECIMAL}
          suffix={CARD_SECONDARY_VALUE_SYMBOL}
          className={styles.stakingBalance}
          labelClassName={styles.balanceStakedLabel}
          valueClassName={styles.balanceStakedResult}
        >
          {shouldRenderSpinner && <Loading className={buildClassName(styles.stakingInfoLoading, spinnerClassNames)} />}
        </InputNumberRich>
        <InputNumberRich
          labelText={lang('Est. balance in a year')}
          isReadable
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
      </div>
    </Modal>
  );
}

export default memo(withGlobal((global): StateProps => {
  const accountState = selectCurrentAccountState(global);

  return {
    amount: accountState?.stakingBalance || 0,
    apyValue: accountState?.poolState?.lastApy || 0,
  };
})(StakingInfoModal));
