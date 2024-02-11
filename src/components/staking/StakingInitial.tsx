import { Dialog } from '@capacitor/dialog';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { UserToken } from '../../global/types';

import {
  ANIMATED_STICKER_MIDDLE_SIZE_PX,
  ANIMATED_STICKER_SMALL_SIZE_PX,
  DEFAULT_DECIMAL_PLACES,
  DEFAULT_FEE,
  MIN_BALANCE_FOR_UNSTAKE,
  NOMINATORS_STAKING_MIN_AMOUNT,
  ONE_TON,
  STAKING_FORWARD_AMOUNT,
  STAKING_MIN_AMOUNT,
  TON_TOKEN_SLUG,
} from '../../config';
import renderText from '../../global/helpers/renderText';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { fromDecimal, toBig, toDecimal } from '../../util/decimals';
import { formatCurrency, formatCurrencySimple } from '../../util/formatNumber';
import { throttle } from '../../util/schedulers';
import { IS_DELEGATED_BOTTOM_SHEET } from '../../util/windowEnvironment';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { ASSET_LOGO_PATHS } from '../ui/helpers/assetLogos';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useSyncEffect from '../../hooks/useSyncEffect';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import RichNumberField from '../ui/RichNumberField';
import RichNumberInput from '../ui/RichNumberInput';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Staking.module.scss';

interface OwnProps {
  isActive?: boolean;
  isStatic?: boolean;
}

interface StateProps {
  isLoading?: boolean;
  apiError?: string;
  tokens?: UserToken[];
  fee?: bigint;
  stakingBalance: bigint;
  apyValue: number;
  shouldUseNominators?: boolean;
}

export const STAKING_DECIMAL = 2;

const runThrottled = throttle((cb) => cb(), 1500, true);

function StakingInitial({
  isActive,
  isStatic,
  isLoading,
  apiError,
  tokens,
  fee,
  stakingBalance,
  apyValue,
  shouldUseNominators,
}: OwnProps & StateProps) {
  const { submitStakingInitial, fetchStakingFee, cancelStaking } = getActions();

  const lang = useLang();

  const [isStakingInfoModalOpen, openStakingInfoModal, closeStakingInfoModal] = useFlag();
  const [amount, setAmount] = useState<bigint | undefined>();
  const [isNotEnough, setIsNotEnough] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState<boolean>(false);
  const [shouldUseAllBalance, setShouldUseAllBalance] = useState<boolean>(false);

  const {
    amount: balance, symbol,
  } = useMemo(() => tokens?.find(({ slug }) => slug === TON_TOKEN_SLUG), [tokens]) || {};
  const hasAmountError = Boolean(isInsufficientBalance || apiError);
  const calculatedFee = fee ?? DEFAULT_FEE;
  const decimals = DEFAULT_DECIMAL_PLACES;

  const minAmount = shouldUseNominators ? NOMINATORS_STAKING_MIN_AMOUNT : STAKING_MIN_AMOUNT;

  const validateAndSetAmount = useLastCallback((newAmount: bigint | undefined, noReset = false) => {
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

    if (!balance || newAmount + minAmount + calculatedFee > balance) {
      setIsInsufficientBalance(true);
    } else if (balance + stakingBalance < minAmount) {
      setIsNotEnough(true);
    }

    setAmount(newAmount);
  });

  useEffect(() => {
    if (shouldUseAllBalance && balance) {
      const newAmount = balance - STAKING_FORWARD_AMOUNT - calculatedFee;

      validateAndSetAmount(newAmount, true);
    } else {
      validateAndSetAmount(amount, true);
    }
  }, [amount, balance, fee, shouldUseAllBalance, validateAndSetAmount, calculatedFee]);

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

  useSyncEffect(() => {
    if (!IS_DELEGATED_BOTTOM_SHEET) return;

    if (isStakingInfoModalOpen) {
      Dialog.alert({
        title: lang('Why staking is safe?'),
        message: [
          `1. ${lang('$safe_staking_description1')}`,
          `2. ${lang('$safe_staking_description2')}`,
          `3. ${lang('$safe_staking_description3')}`,
        ].join('\n\n').replace(/\*\*/g, ''),
      })
        .then(closeStakingInfoModal);
    }
  }, [isStakingInfoModalOpen, lang]);

  const handleAmountBlur = useLastCallback(() => {
    if (amount && amount + stakingBalance < minAmount) {
      setIsNotEnough(true);
    }
  });

  const handleBalanceLinkClick = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!balance) {
      return;
    }

    setShouldUseAllBalance(true);
  });

  const handleMinusOneClick = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!balance || !amount || amount <= MIN_BALANCE_FOR_UNSTAKE) {
      return;
    }

    validateAndSetAmount(amount - MIN_BALANCE_FOR_UNSTAKE);
    setShouldUseAllBalance(false);
  });

  const canSubmit = amount && balance && !isNotEnough
    && amount <= balance
    && (amount + stakingBalance >= minAmount);

  const handleSubmit = useLastCallback((e) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    submitStakingInitial({ amount });
  });

  const handleAmountChange = useLastCallback((stringValue?: string) => {
    const value = stringValue ? fromDecimal(stringValue, decimals) : undefined;
    validateAndSetAmount(value);
  });

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
      && (balance >= amount && balance - amount < MIN_BALANCE_FOR_UNSTAKE);

    const balanceLink = lang('$max_balance', {
      balance: (
        <a href="#" onClick={handleBalanceLinkClick} className={styles.balanceLink}>
          {balance !== undefined
            ? formatCurrencySimple(balance, symbol, decimals)
            : lang('Loading...')}
        </a>
      ),
    });

    const minusOneLink = (
      <a href="#" onClick={handleMinusOneClick} className={styles.balanceLink}>
        {formatCurrency(toDecimal(-ONE_TON), symbol)}
      </a>
    );

    return (
      <Transition
        className={buildClassName(styles.amountTopRight, isStatic && styles.amountTopRight_static)}
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
        ) : (
          lang('$min_value', {
            value: (
              <span className={styles.minAmountValue}>
                {formatCurrency(toDecimal(STAKING_MIN_AMOUNT), 'TON')}
              </span>
            ),
          })
        )}
      </Transition>
    );
  }

  function renderStakingSafeModal() {
    if (IS_DELEGATED_BOTTOM_SHEET) return undefined;

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
    const balanceResult = amount
      ? toBig(amount).mul((apyValue / 100) + 1).round(STAKING_DECIMAL).toString()
      : '0';

    return (
      <RichNumberField
        labelText={lang('Est. balance in a year')}
        zeroValue="..."
        value={balanceResult}
        decimals={decimals}
        className={styles.balanceResultWrapper}
        inputClassName={buildClassName(styles.balanceResultInput, isStatic && styles.inputRichStatic)}
        labelClassName={styles.balanceResultLabel}
        valueClassName={styles.balanceResult}
      />
    );
  }

  return (
    <form
      className={isStatic ? undefined : modalStyles.transitionContent}
      onSubmit={handleSubmit}
    >
      <div className={buildClassName(styles.welcome, isStatic && styles.welcome_static)}>
        <AnimatedIconWithPreview
          size={isStatic ? ANIMATED_STICKER_MIDDLE_SIZE_PX : ANIMATED_STICKER_SMALL_SIZE_PX}
          play={isActive}
          noLoop={false}
          nonInteractive
          className={buildClassName(styles.sticker, isStatic && styles.sticker_static)}
          tgsUrl={ANIMATED_STICKERS_PATHS.wait}
          previewUrl={ANIMATED_STICKERS_PATHS.waitPreview}
        />
        <div className={buildClassName(styles.welcomeInformation, isStatic && styles.welcomeInformation_static)}>
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
        value={amount === undefined ? undefined : toDecimal(amount)}
        labelText={lang('Amount')}
        onBlur={handleAmountBlur}
        onChange={handleAmountChange}
        onPressEnter={handleSubmit}
        decimals={decimals}
        inputClassName={isStatic ? styles.inputRichStatic : undefined}
        className={styles.amountInput}
      >
        <div className={styles.ton}>
          <img src={ASSET_LOGO_PATHS.ton} alt="" className={styles.tonIcon} />
          <span className={styles.tonName}>{symbol}</span>
        </div>
      </RichNumberInput>
      <div className={buildClassName(styles.amountBottomWrapper, isStatic && styles.amountBottomWrapper_static)}>
        <div className={styles.amountBottom}>
          {renderBottomRight()}
        </div>
      </div>

      {renderStakingResult()}

      <div className={modalStyles.buttons}>
        <Button className={modalStyles.button} onClick={cancelStaking}>{lang('Cancel')}</Button>

        <Button
          isPrimary
          isSubmit
          isDisabled={!canSubmit}
          isLoading={isLoading}
          className={modalStyles.button}
        >
          {lang('Stake TON')}
        </Button>
      </div>
      {renderStakingSafeModal()}
    </form>
  );
}

export default memo(
  withGlobal(
    (global): StateProps => {
      const {
        isLoading,
        fee,
        error: apiError,
      } = global.staking;
      const tokens = selectCurrentAccountTokens(global);
      const accountState = selectCurrentAccountState(global);
      const shouldUseNominators = accountState?.staking?.type === 'nominators';

      return {
        isLoading,
        tokens,
        apiError,
        fee,
        stakingBalance: accountState?.staking?.balance || 0n,
        apyValue: accountState?.staking?.apy || 0,
        shouldUseNominators,
      };
    },
    (global, _, stickToFirst) => stickToFirst(global.currentAccountId),
  )(StakingInitial),
);
