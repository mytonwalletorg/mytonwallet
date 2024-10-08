import React, { memo, useMemo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { Account, UserSwapToken } from '../../global/types';
import { SwapType } from '../../global/types';

import { TONCOIN } from '../../config';
import { getIsInternalSwap, getIsSupportedChain } from '../../global/helpers';
import { selectCurrentAccount } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { findChainConfig } from '../../util/chain';
import { formatCurrency } from '../../util/formatNumber';
import getChainNetworkName from '../../util/swap/getChainNetworkName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useLang from '../../hooks/useLang';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import InteractiveTextField from '../ui/InteractiveTextField';
import SwapTokensInfo from './SwapTokensInfo';

import transactionStyles from '../main/modals/TransactionModal.module.scss';
import styles from './SwapResult.module.scss';

interface OwnProps {
  tokenIn?: UserSwapToken;
  tokenOut?: UserSwapToken;
  amountIn?: string;
  amountOut?: string;
  playAnimation?: boolean;
  firstButtonText?: string;
  secondButtonText?: string;
  swapType?: SwapType;
  toAddress?: string;
  networkFee?: number;
  onFirstButtonClick?: NoneToVoidFunction;
  onSecondButtonClick?: NoneToVoidFunction;
}

interface StateProps {
  addressByChain?: Account['addressByChain'];
}

function SwapResult({
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  playAnimation,
  firstButtonText,
  secondButtonText,
  swapType,
  toAddress = '',
  networkFee,
  addressByChain,
  onFirstButtonClick,
  onSecondButtonClick,
}: OwnProps & StateProps) {
  const lang = useLang();

  const isInternalSwap = getIsInternalSwap({
    from: tokenIn, to: tokenOut, toAddress, addressByChain,
  });
  const isToAddressInCurrentWallet = useMemo(() => {
    return Boolean(toAddress && Object.values(addressByChain ?? {}).some((address) => address === toAddress));
  }, [addressByChain, toAddress]);
  const nativeToken = useMemo(() => {
    if (!tokenIn) return undefined;

    return findChainConfig(tokenIn.chain)?.nativeToken;
  }, [tokenIn]);

  function renderButtons() {
    if (!firstButtonText && !secondButtonText) {
      return undefined;
    }

    return (
      <div className={styles.buttons}>
        {firstButtonText && (
          <Button className={styles.button} onClick={onFirstButtonClick}>{firstButtonText}</Button>
        )}
        {secondButtonText && (
          <Button className={styles.button} onClick={onSecondButtonClick}>{secondButtonText}</Button>
        )}
      </div>
    );
  }

  function renderSticker() {
    if (swapType === SwapType.CrosschainFromWallet && !isInternalSwap) return undefined;

    return (
      <AnimatedIconWithPreview
        play={playAnimation}
        noLoop={false}
        nonInteractive
        className={styles.sticker}
        tgsUrl={ANIMATED_STICKERS_PATHS.thumbUp}
        previewUrl={ANIMATED_STICKERS_PATHS.thumbUpPreview}
      />
    );
  }

  function renderFee() {
    return (
      <div className={buildClassName(styles.feeBlock, transactionStyles.textFieldWrapperFullWidth)}>
        <span className={transactionStyles.textFieldLabel}>
          {lang('Blockchain Fee')}
        </span>
        <div className={transactionStyles.textField}>
          {formatCurrency(networkFee!, nativeToken?.symbol ?? TONCOIN.symbol, undefined, true)}
        </div>
      </div>
    );
  }

  function renderTimeWarning() {
    return (
      <div className={styles.changellyInfoBlock}>
        <span className={styles.changellyDescription}>
          {lang('Please note that it may take up to a few hours for tokens to appear in your wallet.')}
        </span>
      </div>
    );
  }

  function renderChangellyInfo() {
    if (swapType !== SwapType.CrosschainFromWallet || isToAddressInCurrentWallet) {
      return undefined;
    }
    const chain = getIsSupportedChain(tokenOut?.chain) ? tokenOut.chain : undefined;

    return (
      <div className={styles.changellyInfoBlock}>
        <span className={styles.changellyDescription}>
          {
            lang('$swap_changelly_from_ton_description', {
              blockchain: (
                <span className={styles.changellyDescriptionBold}>
                  {getChainNetworkName(tokenOut?.chain)}
                </span>
              ),
            })
          }
        </span>
        <InteractiveTextField
          chain={chain}
          address={toAddress}
          copyNotification={lang('Address was copied!')}
          noSavedAddress
          noExplorer
          className={styles.changellyTextField}
        />
      </div>
    );
  }

  return (
    <>
      {renderSticker()}

      <SwapTokensInfo
        tokenIn={tokenIn}
        amountIn={amountIn}
        tokenOut={tokenOut}
        amountOut={amountOut}
      />

      {!!networkFee && renderFee()}

      {swapType !== SwapType.OnChain && renderTimeWarning()}
      {renderChangellyInfo()}

      {renderButtons()}
    </>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    addressByChain: selectCurrentAccount(global)?.addressByChain,
  };
})(SwapResult));
