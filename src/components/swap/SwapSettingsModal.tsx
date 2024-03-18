import React, { memo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { UserSwapToken, UserToken } from '../../global/types';

import { TON_SYMBOL } from '../../config';
import buildClassName from '../../util/buildClassName';
import { formatCurrency } from '../../util/formatNumber';

import useFlag from '../../hooks/useFlag';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import IconWithTooltip from '../ui/IconWithTooltip';
import Modal from '../ui/Modal';
import RichNumberInput from '../ui/RichNumberInput';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Swap.module.scss';

interface OwnProps {
  isOpen: boolean;
  tokenOut?: UserToken | UserSwapToken;
  fee?: number;
  onClose: () => void;
}

interface StateProps {
  slippage: number;
  priceImpact?: number;
  amountOutMin?: string;
}

const SLIPPAGE_VALUES = [0.5, 1, 2, 5, 10];
const MAX_SLIPPAGE_VALUE = 50;

export const MAX_PRICE_IMPACT_VALUE = 5;

function SwapSettingsModal({
  isOpen,
  onClose,
  tokenOut,
  slippage,
  priceImpact = 0,
  fee = 0,
  amountOutMin = '0',
}: OwnProps & StateProps) {
  const { setSlippage } = getActions();
  const lang = useLang();

  const [isSlippageFocused, markSlippageFocused, unmarkSlippageFocused] = useFlag();
  const [hasError, setHasError] = useState(false);

  const [currentSlippage, setCurrentSlippage] = useState<number | undefined>(slippage);

  const priceImpactError = priceImpact >= MAX_PRICE_IMPACT_VALUE;
  const slippageError = currentSlippage === undefined || currentSlippage > MAX_SLIPPAGE_VALUE;

  const handleSave = useLastCallback(() => {
    setSlippage({ slippage: currentSlippage! });
    onClose();
  });

  const resetModal = useLastCallback(() => {
    setCurrentSlippage(slippage);
  });

  const handleInputChange = useLastCallback((stringValue?: string) => {
    const value = stringValue ? Number(stringValue) : undefined;
    setCurrentSlippage(value);
  });

  function renderSlippageValues() {
    const slippageList = SLIPPAGE_VALUES.map((value, index) => {
      return (
        <>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setCurrentSlippage(value)}
            className={styles.balanceLink}
          >{value}%
          </div>
          {index + 1 !== SLIPPAGE_VALUES.length && <i className={styles.dot} aria-hidden />}
        </>
      );
    });

    return (
      <div className={styles.advancedSlippageContainer}>
        <span className={styles.advancedSlippage}>{slippageList}</span>
      </div>
    );
  }

  function renderSlippageError() {
    const error = currentSlippage === undefined
      ? lang('Slippage not specified')
      : currentSlippage > MAX_SLIPPAGE_VALUE
        ? lang('Slippage too high')
        : '';

    setHasError(!!error);

    return (
      <div className={styles.advancedSlippageError}>
        <span>{lang(error)}</span>
      </div>
    );
  }

  function renderSlippageLabel() {
    return (
      <>
        {lang('Slippage')}
        <IconWithTooltip
          message={(
            <div className={styles.advancedTooltipMessage}>
              <span>{lang('$swap_slippage_tooltip1')}</span>
              <span>{lang('$swap_slippage_tooltip2')}</span>
            </div>
          )}
          tooltipClassName={styles.advancedTooltipContainer}
          iconClassName={buildClassName(
            styles.advancedTooltip, slippageError && styles.advancedError,
          )}
        />
      </>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      isCompact
      onCloseAnimationEnd={resetModal}
    >
      <div className={styles.advancedTitle}>
        {lang('Swap Details')}
      </div>
      <div className={styles.advancedInput}>
        {renderSlippageValues()}
        <RichNumberInput
          labelText={renderSlippageLabel()}
          labelClassName={styles.slippageLabel}
          value={currentSlippage?.toString()}
          hasError={hasError}
          decimals={2}
          suffix={isSlippageFocused ? '' : '%'}
          onChange={handleInputChange}
          onFocus={markSlippageFocused}
          onBlur={unmarkSlippageFocused}
        />
        {renderSlippageError()}
      </div>
      <div className={styles.advancedBlock}>
        <div className={styles.advancedRow}>
          <span className={styles.advancedDescription}>
            {lang('Blockchain Fee')}
          </span>
          <span className={styles.advancedValue}>
            ≈ {formatCurrency(fee, TON_SYMBOL, undefined, true)}
          </span>
        </div>
        <div className={styles.advancedRow}>
          <span className={styles.advancedDescription}>
            {lang('Routing Fees')}
            <IconWithTooltip
              message={(
                <div className={styles.advancedTooltipMessage}>
                  <span>{lang('$swap_routing_fees_tooltip')}</span>
                </div>
              )}
              tooltipClassName={styles.advancedTooltipContainer}
              iconClassName={buildClassName(
                styles.advancedTooltip, priceImpactError && styles.advancedError,
              )}
            />
          </span>
          <span className={styles.advancedValue}>
            {lang('Included')}
          </span>
        </div>
        <div className={styles.advancedRow}>
          <span className={buildClassName(styles.advancedDescription, priceImpactError && styles.advancedError)}>
            {lang('Price Impact')}
            <IconWithTooltip
              message={(
                <div className={styles.advancedTooltipMessage}>
                  <span>{lang('$swap_price_impact_tooltip1')}</span>
                  <span>{lang('$swap_price_impact_tooltip2')}</span>
                </div>
              )}
              tooltipClassName={styles.advancedTooltipContainer}
              iconClassName={buildClassName(
                styles.advancedTooltip, priceImpactError && styles.advancedError,
              )}
            />
          </span>
          <span className={buildClassName(
            styles.advancedValue,
            priceImpactError && styles.advancedError,
          )}
          >{priceImpact}%
          </span>
        </div>
        <div className={styles.advancedRow}>
          <span className={styles.advancedDescription}>
            {lang('Minimum Received')}
            <IconWithTooltip
              message={(
                <div className={styles.advancedTooltipMessage}>
                  <span>{lang('$swap_minimum_received_tooltip1')}</span>
                  <span>{lang('$swap_minimum_received_tooltip2')}</span>
                </div>
              )}
              tooltipClassName={styles.advancedTooltipContainer}
              iconClassName={styles.advancedTooltip}
            />
          </span>
          {tokenOut && (
            <span className={styles.advancedValue}>{
              formatCurrency(Number(amountOutMin), tokenOut.symbol)
            }
            </span>
          )}
        </div>
      </div>
      <div className={modalStyles.buttons}>
        <Button
          className={modalStyles.button}
          onClick={onClose}
        >
          {lang('Close')}
        </Button>
        <Button
          isPrimary
          isDisabled={hasError}
          className={modalStyles.button}
          onClick={handleSave}
        >
          {lang('Save')}
        </Button>
      </div>
    </Modal>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const {
      slippage, priceImpact, amountOutMin,
    } = global.currentSwap;

    return {
      slippage,
      priceImpact,
      amountOutMin,
    };
  })(SwapSettingsModal),
);
