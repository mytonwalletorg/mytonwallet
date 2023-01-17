import React, {
  memo, useCallback, useMemo, useState,
} from '../../lib/teact/teact';
import { withGlobal, getActions } from '../../global';

import type { UserToken } from '../../global/types';

import { ANIMATED_STICKER_SMALL_SIZE_PX, TON_TOKEN_SLUG } from '../../config';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';
import buildClassName from '../../util/buildClassName';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import { formatCurrency, formatCurrencyExtended } from '../../util/formatNumber';
import { floor } from '../../util/round';
import renderText from '../../global/helpers/renderText';
import useLang from '../../hooks/useLang';
import useFlag from '../../hooks/useFlag';

import Button from '../ui/Button';
import InputNumberRich from '../ui/InputNumberRich';
import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Modal from '../ui/Modal';

import styles from './Staking.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface StateProps {
  isLoading?: boolean;
  apiError?: string;
  tokens?: UserToken[];
  stakingBalance: number;
  stakingMinAmount: number;
  apyValue: number;
}

export const STAKING_DECIMAL = 2;

function StakingInitial({
  isLoading,
  apiError,
  tokens,
  stakingBalance,
  stakingMinAmount,
  apyValue,
}: StateProps) {
  const { submitStakingInitial } = getActions();

  const lang = useLang();
  const [isStakingInfoModalOpen, openStakingInfoModal, closeStakingInfoModal] = useFlag();
  const [amount, setAmount] = useState<number | undefined>(0);
  const [isNotEnough, setIsNotEnough] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState<boolean>(false);
  const tonToken = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens]);
  const balance = tonToken?.amount;

  const handleAmountInput = useCallback((value?: number) => {
    if (value !== amount) {
      setIsNotEnough(false);
      setIsInsufficientBalance(false);
    }

    if (value === undefined) {
      setAmount(undefined);
      return;
    }
    if (Number.isNaN(value) || value < 0) {
      setIsNotEnough(true);
      return;
    }

    setAmount(value);

    if (!balance || value > balance) {
      setIsInsufficientBalance(true);
    }
  }, [amount, balance]);

  const handleAmountBlur = useCallback(() => {
    if (amount && amount + stakingBalance < stakingMinAmount) {
      setIsNotEnough(true);
    }
  }, [amount, stakingBalance, stakingMinAmount]);

  const handleBalanceLinkClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!balance) {
      return;
    }

    let percentOfAmount = Number(e.currentTarget.dataset.amount || 100);
    if (Number.isNaN(percentOfAmount) || ![25, 50, 100].includes(percentOfAmount)) {
      percentOfAmount = 100;
    }

    const newBalace = floor((balance / 100) * percentOfAmount, STAKING_DECIMAL);
    setAmount(newBalace);

    if (newBalace + stakingBalance < stakingMinAmount) {
      setIsNotEnough(true);
    }
  }, [balance, stakingBalance, stakingMinAmount]);

  const canSubmit = amount && balance && !isNotEnough
    && amount <= balance
    && (amount + stakingBalance >= stakingMinAmount);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    submitStakingInitial({ amount });
  }, [canSubmit, submitStakingInitial, amount]);

  function getError() {
    if (isInsufficientBalance) {
      return lang('Insufficient balance');
    }

    return apiError ? lang(apiError) : undefined;
  }

  function renderBalance() {
    if (!tonToken) {
      return undefined;
    }

    const canSetHalf = stakingBalance > stakingMinAmount || (Boolean(balance) && balance / 2 >= stakingMinAmount);
    const canSetQuarter = stakingBalance > stakingMinAmount || (Boolean(balance) && balance / 4 >= stakingMinAmount);

    return (
      <div className={styles.balance}>
        {lang('$your_balance_is', {
          balance: (
            <a href="#" onClick={handleBalanceLinkClick} className={styles.balanceLink} data-amount="100">
              {balance !== undefined
                ? formatCurrencyExtended(floor(balance, STAKING_DECIMAL), tonToken.symbol, true)
                : lang('Loading...')}
            </a>
          ),
        })}
        {canSetHalf && (
          <a href="#" onClick={handleBalanceLinkClick} className={styles.balanceLink} data-amount="50">50%</a>
        )}
        {canSetQuarter && (
          <a href="#" onClick={handleBalanceLinkClick} className={styles.balanceLink} data-amount="25">25%</a>
        )}
      </div>
    );
  }

  function renderStakingSafeModal() {
    return (
      <Modal
        isCompact
        isOpen={isStakingInfoModalOpen}
        title={lang('Why staking is safe?')}
        onClose={closeStakingInfoModal}
        dialogClassName={styles.stakingSafeDialog}
      >
        <p className={modalStyles.text}>
          {renderText(lang('$safe_staking_description1'))}
        </p>
        <p className={modalStyles.text}>
          {renderText(lang('$safe_staking_description2'))}
        </p>
        <p className={modalStyles.text}>
          {renderText(lang('$safe_staking_description3'))}
        </p>

        <div className={modalStyles.buttons}>
          <Button onClick={closeStakingInfoModal}>{lang('Close')}</Button>
        </div>
      </Modal>
    );
  }

  function renderStakingResult() {
    const balanceResult = amount ? floor(amount! + (amount! / 100) * apyValue, STAKING_DECIMAL) : 0;

    return (
      <InputNumberRich
        labelText={lang('Est. balance in a year')}
        isReadable
        zeroValue="..."
        value={balanceResult}
        decimals={tonToken?.decimals}
        inputClassName={styles.balanceResultInput}
        labelClassName={styles.balanceResultLabel}
        valueClassName={styles.balanceResult}
      />
    );
  }

  return (
    <form className={modalStyles.transitionContent} onSubmit={handleSubmit}>
      <div className={styles.welcome}>
        <AnimatedIconWithPreview
          size={ANIMATED_STICKER_SMALL_SIZE_PX}
          play
          noLoop={false}
          nonInteractive
          className={styles.sticker}
          tgsUrl={ANIMATED_STICKERS_PATHS.wait}
          previewUrl={ANIMATED_STICKERS_PATHS.waitPreview}
        />
        <div className={styles.welcomeInformation}>
          <div>{lang('Earn from your tokens while holding them')}</div>
          <div className={styles.stakingApy}>{lang('$est_apy_val', apyValue)}</div>
          <Button isText className={styles.textButton} onClick={openStakingInfoModal}>
            {lang('Why this is safe')}
          </Button>
        </div>
      </div>

      {!isInsufficientBalance && renderBalance()}
      <InputNumberRich
        key="staking_amount"
        id="staking_amount"
        hasError={isNotEnough || isInsufficientBalance}
        value={amount}
        labelText={lang('Amount')}
        error={getError()}
        onBlur={handleAmountBlur}
        onInput={handleAmountInput}
        onPressEnter={handleSubmit}
        decimals={tonToken?.decimals}
      >
        <div className={styles.ton}>
          <img src={ASSET_LOGO_PATHS.ton} alt="" className={styles.tonIcon} />
          <span className={styles.tonName}>{tonToken?.symbol}</span>
        </div>
      </InputNumberRich>
      {!stakingBalance && (
        <div className={buildClassName(styles.minAmount, isNotEnough && styles.minAmount_error)}>
          {lang('$min_value', {
            value: <span className={styles.minAmountValue}>{formatCurrency(stakingMinAmount, 'TON')}</span>,
          })}
        </div>
      )}

      {renderStakingResult()}

      <div className={modalStyles.buttons}>
        <Button
          isPrimary
          isSubmit
          isDisabled={!canSubmit}
          isLoading={isLoading}
        >
          {lang('Stake TON')}
        </Button>
      </div>
      {renderStakingSafeModal()}
    </form>
  );
}

export default memo(withGlobal((global): StateProps => {
  const {
    isLoading,
    error: apiError,
  } = global.staking;
  const tokens = selectCurrentAccountTokens(global);
  const accountState = selectCurrentAccountState(global);

  return {
    isLoading,
    tokens,
    apiError,
    stakingBalance: accountState?.stakingBalance || 0,
    stakingMinAmount: accountState?.poolState?.minStake || 0,
    apyValue: accountState?.poolState?.lastApy || 0,
  };
})(StakingInitial));
