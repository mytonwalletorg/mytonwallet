import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';

import type { UserToken } from '../../global/types';

import { ANIMATED_STICKER_SMALL_SIZE_PX, MIN_BALANCE_FOR_UNSTAKE, TON_TOKEN_SLUG } from '../../config';
import { getActions, withGlobal } from '../../global';
import { bigStrToHuman } from '../../global/helpers';
import renderText from '../../global/helpers/renderText';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatCurrency, formatCurrencyExtended } from '../../util/formatNumber';
import { floor } from '../../util/round';
import { throttle } from '../../util/schedulers';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import RichNumberField from '../ui/RichNumberField';
import RichNumberInput from '../ui/RichNumberInput';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Staking.module.scss';

interface StateProps {
  isLoading?: boolean;
  apiError?: string;
  tokens?: UserToken[];
  fee?: string;
  stakingBalance: number;
  stakingMinAmount: number;
  apyValue: number;
}

export const STAKING_DECIMAL = 2;

// Fee may change, so we add 5% for more reliability. This is only safe for low-fee blockchains such as TON.
const RESERVED_FEE_FACTOR = 1.05;
const runThrottled = throttle((cb) => cb(), 1500, true);

function StakingInitial({
  isLoading,
  apiError,
  tokens,
  fee,
  stakingBalance,
  stakingMinAmount,
  apyValue,
}: StateProps) {
  const { submitStakingInitial, fetchStakingFee } = getActions();

  const lang = useLang();

  const [isStakingInfoModalOpen, openStakingInfoModal, closeStakingInfoModal] = useFlag();
  const [amount, setAmount] = useState<number | undefined>(0);
  const [isNotEnough, setIsNotEnough] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState<boolean>(false);
  const [shouldUseAllBalance, setShouldUseAllBalance] = useState<boolean>(false);

  const {
    amount: balance, decimals, symbol,
  } = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens]) || {};
  const hasAmountError = Boolean(isInsufficientBalance || apiError);

  const validateAndSetAmount = useCallback((newAmount: number | undefined, noReset = false) => {
    if (!noReset) {
      setShouldUseAllBalance(false);
      setIsNotEnough(false);
      setIsInsufficientBalance(false);
    }

    if (newAmount === undefined) {
      setAmount(undefined);
      return;
    }

    if (Number.isNaN(newAmount) || newAmount < 0) {
      setIsNotEnough(true);
      return;
    }

    if (!balance || newAmount > balance) {
      setIsInsufficientBalance(true);
    } else if (balance + stakingBalance < stakingMinAmount) {
      setIsNotEnough(true);
    }

    setAmount(newAmount);
  }, [balance, stakingBalance, stakingMinAmount]);

  useEffect(() => {
    if (shouldUseAllBalance && balance) {
      const calculatedFee = fee && shouldUseAllBalance ? bigStrToHuman(fee, decimals) : 0;
      const newAmount = balance - calculatedFee * RESERVED_FEE_FACTOR;

      validateAndSetAmount(newAmount, true);
    } else {
      validateAndSetAmount(amount, true);
    }
  }, [amount, balance, decimals, fee, shouldUseAllBalance, validateAndSetAmount]);

  useEffect(() => {
    if (!amount) {
      return;
    }

    runThrottled(() => {
      fetchStakingFee({
        amount,
      });
    });
  }, [amount, fetchStakingFee]);

  const handleAmountChange = useCallback(validateAndSetAmount, [validateAndSetAmount]);

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

    setShouldUseAllBalance(true);
  }, [balance]);

  const handleMinusOneClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!balance || !amount || amount <= MIN_BALANCE_FOR_UNSTAKE) {
      return;
    }

    validateAndSetAmount(amount - MIN_BALANCE_FOR_UNSTAKE);
  }, [amount, balance, validateAndSetAmount]);

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

  function renderTopRight() {
    if (!symbol) {
      return undefined;
    }

    const isFullBalanceSelected = balance && amount
      && (balance >= amount && balance - amount <= MIN_BALANCE_FOR_UNSTAKE);
    const balanceLink = lang('$your_balance_is', {
      balance: (
        <a href="#" onClick={handleBalanceLinkClick} className={styles.balanceLink}>
          {balance !== undefined
            ? formatCurrencyExtended(floor(balance, STAKING_DECIMAL), symbol, true)
            : lang('Loading...')}
        </a>
      ),
    });
    const minusOneLink = (
      <a href="#" onClick={handleMinusOneClick} className={styles.balanceLink}>
        {formatCurrency(-Math.round(MIN_BALANCE_FOR_UNSTAKE), symbol)}
      </a>
    );

    return (
      <Transition
        className={styles.amountTopRight}
        slideClassName={styles.amountTopRight_slide}
        name="fade"
        activeKey={isFullBalanceSelected ? 1 : 0}
      >
        {isFullBalanceSelected ? minusOneLink : balanceLink}
      </Transition>
    );
  }

  function renderBottomRight() {
    const error = getError();

    return (
      <Transition
        className={buildClassName(styles.amountBottomRight, isNotEnough && styles.amountBottomRight_error)}
        slideClassName={styles.amountBottomRight_slide}
        name="fade"
        activeKey={error ? 2 : !stakingBalance && !hasAmountError ? 1 : 0}
      >
        {error ? (
          <span className={styles.balanceError}>{error}</span>
        ) : !stakingBalance ? (
          lang('$min_value', {
            value: (
              <span className={styles.minAmountValue}>
                {formatCurrency(stakingMinAmount, 'TON')}
              </span>
            ),
          })
        ) : ' '}
      </Transition>
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
      <RichNumberField
        labelText={lang('Est. balance in a year')}
        zeroValue="..."
        value={balanceResult}
        decimals={decimals}
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

      {renderTopRight()}
      <RichNumberInput
        key="staking_amount"
        id="staking_amount"
        hasError={isNotEnough || isInsufficientBalance}
        value={amount}
        labelText={lang('Amount')}
        onBlur={handleAmountBlur}
        onChange={handleAmountChange}
        onPressEnter={handleSubmit}
        decimals={decimals}
        className={styles.amountInput}
      >
        <div className={styles.ton}>
          <img src={ASSET_LOGO_PATHS.ton} alt="" className={styles.tonIcon} />
          <span className={styles.tonName}>{symbol}</span>
        </div>
      </RichNumberInput>
      <div className={styles.amountBottomWrapper}>
        <div className={styles.amountBottom}>
          {renderBottomRight()}
        </div>
      </div>

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
    fee,
    error: apiError,
  } = global.staking;
  const tokens = selectCurrentAccountTokens(global);
  const accountState = selectCurrentAccountState(global);

  return {
    isLoading,
    tokens,
    apiError,
    fee,
    stakingBalance: accountState?.stakingBalance || 0,
    stakingMinAmount: accountState?.poolState?.minStake || 0,
    apyValue: accountState?.poolState?.lastApy || 0,
  };
})(StakingInitial));
