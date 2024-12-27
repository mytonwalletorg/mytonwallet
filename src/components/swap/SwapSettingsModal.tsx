import React, { memo, useState } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiSwapAsset, ApiToken } from '../../api/types';
import type { FormatFeeOptions } from '../../util/fee/formatFee';
import { SwapType } from '../../global/types';

import { DEFAULT_OUR_SWAP_FEE } from '../../config';
import renderText from '../../global/helpers/renderText';
import {
  selectCurrentSwapNativeTokenIn,
  selectCurrentSwapTokenIn,
  selectCurrentSwapTokenOut,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { fromDecimal } from '../../util/decimals';
import { formatFee } from '../../util/fee/formatFee';
import { formatCurrency } from '../../util/formatNumber';
import getSwapRate from '../../util/swap/getSwapRate';

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
  isGaslessSwap: boolean;
  realNetworkFeeInDiesel: number;
  onClose: () => void;
}

interface StateProps {
  amountIn?: string;
  amountOut?: string;
  tokenIn?: ApiSwapAsset;
  tokenOut?: ApiSwapAsset;
  nativeTokenIn?: Pick<ApiToken, 'symbol' | 'decimals'>;
  networkFee?: string;
  realNetworkFee?: string;
  swapType?: SwapType;
  slippage: number;
  priceImpact?: number;
  amountOutMin?: string;
  ourFee?: string;
  ourFeePercent?: number;
}

const SLIPPAGE_VALUES = [0.5, 1, 2, 5, 10];
const MAX_SLIPPAGE_VALUE = 50;

export const MAX_PRICE_IMPACT_VALUE = 5;

function SwapSettingsModal({
  isOpen,
  isGaslessSwap,
  onClose,
  amountIn,
  amountOut,
  swapType,
  tokenIn,
  tokenOut,
  nativeTokenIn,
  slippage,
  priceImpact = 0,
  networkFee = '0',
  realNetworkFee = '0',
  realNetworkFeeInDiesel,
  amountOutMin = '0',
  ourFee = '0',
  ourFeePercent = DEFAULT_OUR_SWAP_FEE,
}: OwnProps & StateProps) {
  const { setSlippage } = getActions();
  const lang = useLang();
  const canEditSlippage = swapType === SwapType.OnChain;

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
        <div key={value} className={styles.advancedSlippageButton}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => setCurrentSlippage(value)}
            className={styles.balanceLink}
          >{value}%
          </div>
          {index + 1 !== SLIPPAGE_VALUES.length && <i className={styles.dot} aria-hidden />}
        </div>
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

  function renderRate() {
    const rate = getSwapRate(
      amountIn,
      amountOut,
      tokenIn,
      tokenOut,
      true,
    );

    if (!rate) return undefined;

    return (
      <div className={styles.advancedRow}>
        <span className={styles.advancedDescription}>
          {lang('Exchange Rate')}
        </span>
        <span className={styles.advancedValue}>
          {`${rate.firstCurrencySymbol} ≈ ${rate.price} ${rate.secondCurrencySymbol}`}
        </span>
      </div>
    );
  }

  function renderNetworkFee() {
    let feeOptions: FormatFeeOptions | undefined;

    if (isGaslessSwap && tokenIn) {
      feeOptions = {
        terms: { native: fromDecimal(realNetworkFeeInDiesel, tokenIn.decimals) },
        token: tokenIn,
        nativeToken: tokenIn,
        precision: 'approximate',
      };
    }
    if (!isGaslessSwap && nativeTokenIn) {
      feeOptions = {
        terms: { native: fromDecimal(realNetworkFee, nativeTokenIn.decimals) },
        token: nativeTokenIn,
        nativeToken: nativeTokenIn,
        precision: realNetworkFee === networkFee ? 'exact' : 'approximate',
      };
    }

    return (
      <div className={styles.advancedRow}>
        <span className={styles.advancedDescription}>
          {lang('Blockchain Fee')}
        </span>
        <span className={styles.advancedValue}>
          {feeOptions && formatFee(feeOptions)}
        </span>
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
      {canEditSlippage && (
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
      )}
      <div className={styles.advancedBlock}>
        {renderRate()}
        {renderNetworkFee()}

        {swapType === SwapType.OnChain && (
          <>
            <div className={styles.advancedRow}>
              <span className={styles.advancedDescription}>
                {lang('Aggregator Fee')}
                <IconWithTooltip
                  message={(
                    <div className={styles.advancedTooltipMessage}>
                      <span>{renderText(lang('$swap_aggregator_fee_tooltip', { percent: `${ourFeePercent}%` }))}</span>
                    </div>
                  )}
                  tooltipClassName={styles.advancedTooltipContainer}
                  iconClassName={styles.advancedTooltip}
                />
              </span>
              <span className={styles.advancedValue}>
                {formatCurrency(ourFee, tokenIn?.symbol ?? '', undefined, true)}
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
          </>
        )}
      </div>
      <div className={modalStyles.buttons}>
        <Button
          className={modalStyles.button}
          onClick={onClose}
        >
          {lang('Close')}
        </Button>
        {canEditSlippage && (
          <Button
            isPrimary
            isDisabled={hasError}
            className={modalStyles.button}
            onClick={handleSave}
          >
            {lang('Save')}
          </Button>
        )}
      </div>
    </Modal>
  );
}

export default memo(
  withGlobal<OwnProps>((global): StateProps => {
    const {
      amountIn,
      amountOut,
      networkFee,
      realNetworkFee,
      swapType,
      slippage,
      priceImpact,
      amountOutMin,
      ourFee,
      ourFeePercent,
    } = global.currentSwap;

    return {
      amountIn,
      amountOut,
      networkFee,
      realNetworkFee,
      swapType,
      tokenIn: selectCurrentSwapTokenIn(global),
      tokenOut: selectCurrentSwapTokenOut(global),
      nativeTokenIn: selectCurrentSwapNativeTokenIn(global),
      slippage,
      priceImpact,
      amountOutMin,
      ourFee,
      ourFeePercent,
    };
  })(SwapSettingsModal),
);
