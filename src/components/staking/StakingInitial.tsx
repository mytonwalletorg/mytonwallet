import { Dialog } from 'native-dialog';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { StakingState, type UserToken } from '../../global/types';

import {
  ANIMATED_STICKER_MIDDLE_SIZE_PX,
  ANIMATED_STICKER_SMALL_SIZE_PX,
  DEFAULT_DECIMAL_PLACES,
  DEFAULT_FEE,
  NOMINATORS_STAKING_MIN_AMOUNT,
  ONE_TON,
  STAKING_MIN_AMOUNT,
  TONCOIN_SLUG,
} from '../../config';
import renderText from '../../global/helpers/renderText';
import { selectCurrentAccountState, selectCurrentAccountTokens } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { vibrate } from '../../util/capacitor';
import { fromDecimal, toBig, toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
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

const ACTIVE_STATES = new Set([StakingState.StakeInitial, StakingState.None]);

const runThrottled = throttle((cb) => cb(), 1500, true);

const TWO_TON = 2n * ONE_TON;
const MINIMUM_REQUIRED_AMOUNT_TON = 3n * ONE_TON + (ONE_TON / 10n);

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
  const { submitStakingInitial, fetchStakingFee } = getActions();

  const lang = useLang();

  const [isStakingInfoModalOpen, openStakingInfoModal, closeStakingInfoModal] = useFlag();
  const [amount, setAmount] = useState<bigint | undefined>();
  const [isNotEnough, setIsNotEnough] = useState<boolean>(false);
  const [isInsufficientBalance, setIsInsufficientBalance] = useState<boolean>(false);
  const [isInsufficientFee, setIsInsufficientFee] = useState(false);
  const [isBelowMinimumAmount, setIsBelowMinimumAmount] = useState(false);
  const [shouldUseAllBalance, setShouldUseAllBalance] = useState<boolean>(false);

  const {
    amount: balance, symbol,
  } = useMemo(() => tokens?.find(({ slug }) => slug === TONCOIN_SLUG), [tokens]) || {};
  const hasAmountError = Boolean(isInsufficientBalance || apiError);
  const calculatedFee = fee ?? DEFAULT_FEE;
  const decimals = DEFAULT_DECIMAL_PLACES;

  const minAmount = shouldUseNominators ? NOMINATORS_STAKING_MIN_AMOUNT : STAKING_MIN_AMOUNT;

  const shouldRenderBalanceWithSmallFee = balance && balance >= MINIMUM_REQUIRED_AMOUNT_TON;
  const availableBalance = shouldRenderBalanceWithSmallFee
    ? balance - TWO_TON
    : balance && balance > ONE_TON
      ? balance - ONE_TON
      : balance;

  const validateAndSetAmount = useLastCallback((newAmount: bigint | undefined, noReset = false) => {
    if (!noReset) {
      setShouldUseAllBalance(false);
      setIsNotEnough(false);
      setIsInsufficientBalance(false);
      setIsBelowMinimumAmount(false);
      setIsInsufficientFee(false);
    }

    if (newAmount === undefined) {
      setAmount(undefined);
      return;
    }

    if (Number.isNaN(newAmount) || newAmount < 0) {
      setIsNotEnough(true);
      return;
    }

    if (newAmount < minAmount) {
      setIsBelowMinimumAmount(true);
    } else if (!availableBalance || newAmount + calculatedFee > availableBalance) {
      setIsInsufficientBalance(true);
    } else if (newAmount >= minAmount && newAmount < TWO_TON && !shouldRenderBalanceWithSmallFee) {
      setIsInsufficientFee(true);
    } else if (availableBalance + stakingBalance < minAmount) {
      setIsNotEnough(true);
    }

    setAmount(newAmount);
  });

  useEffect(() => {
    if (shouldUseAllBalance && availableBalance) {
      const newAmount = availableBalance - calculatedFee;

      validateAndSetAmount(newAmount, true);
    } else {
      validateAndSetAmount(amount, true);
    }
  }, [amount, fee, shouldUseAllBalance, validateAndSetAmount, calculatedFee, availableBalance]);

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
        title: lang('Why is staking safe?'),
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

  const handleMaxAmountClick = useLastCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!availableBalance) {
      return;
    }

    vibrate();

    setShouldUseAllBalance(true);
  });

  const canSubmit = amount && availableBalance && !isNotEnough && !isBelowMinimumAmount && !isInsufficientFee
    && amount <= availableBalance
    && (amount + stakingBalance >= minAmount);

  const handleSubmit = useLastCallback((e) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    vibrate();

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

    if (isInsufficientFee) {
      return lang('$insufficient_fee', { fee: formatCurrency(toDecimal(ONE_TON), symbol ?? '') });
    }

    if (isBelowMinimumAmount) {
      return lang('$min_value', {
        value: (
          <span className={styles.minAmountValue}>
            {formatCurrency(toDecimal(minAmount), symbol ?? '')}
          </span>
        ),
      });
    }

    return apiError ? lang(apiError) : undefined;
  }

  function renderTopRight() {
    if (!symbol) return undefined;

    const hasBalance = availableBalance !== undefined;
    const balanceButton = lang('$max_balance', {
      balance: (
        <div
          role="button"
          tabIndex={0}
          className={styles.balanceLink}
          onClick={handleMaxAmountClick}
        >
          {hasBalance ? formatCurrency(toDecimal(availableBalance, decimals), symbol) : lang('Loading...')}
        </div>
      ),
    });

    return (
      <Transition
        className={buildClassName(styles.amountTopRight, isStatic && styles.amountTopRight_static)}
        slideClassName={styles.amountTopRight_slide}
        name="fade"
        activeKey={0}
      >
        <div className={styles.balanceContainer}>
          <span className={styles.balance}>
            {balanceButton}
          </span>
        </div>
      </Transition>
    );
  }

  function renderBottomRight() {
    const error = getError();

    const activeKey = isInsufficientBalance ? 0
      : isInsufficientFee ? 1
        : isBelowMinimumAmount ? 2
          : apiError ? 3
            : !stakingBalance && !hasAmountError ? 4
              : 5;

    return (
      <Transition
        className={buildClassName(styles.amountBottomRight, isNotEnough && styles.amountBottomRight_error)}
        slideClassName={styles.amountBottomRight_slide}
        name="fade"
        activeKey={activeKey}
      >
        {error ? (
          <span className={styles.balanceError}>{error}</span>
        ) : (
          lang('$min_value', {
            value: (
              <span className={styles.minAmountValue}>
                {formatCurrency(toDecimal(minAmount), 'TON')}
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
        title={lang('Why is staking safe?')}
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

export default memo(
  withGlobal(
    (global): StateProps => {
      const {
        state,
        isLoading,
        fee,
        error: apiError,
      } = global.staking;
      const tokens = selectCurrentAccountTokens(global);
      const accountState = selectCurrentAccountState(global);
      const shouldUseNominators = accountState?.staking?.type === 'nominators';

      return {
        isLoading: isLoading && ACTIVE_STATES.has(state),
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
