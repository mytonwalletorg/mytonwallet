import React, { memo } from '../../lib/teact/teact';

import type { UserSwapToken } from '../../global/types';
import { SwapType } from '../../global/types';

import getBlockchainNetworkName from '../../util/swap/getBlockchainNetworkName';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';

import useLang from '../../hooks/useLang';

import AnimatedIconWithPreview from '../ui/AnimatedIconWithPreview';
import Button from '../ui/Button';
import InteractiveTextField from '../ui/InteractiveTextField';
import SwapTokensInfo from './SwapTokensInfo';

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
  onFirstButtonClick?: NoneToVoidFunction;
  onSecondButtonClick?: NoneToVoidFunction;
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
  onFirstButtonClick,
  onSecondButtonClick,
}: OwnProps) {
  const lang = useLang();

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
    if (swapType === SwapType.CrosschainFromToncoin) return undefined;

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

  function renderChangellyInfo() {
    if (swapType !== SwapType.CrosschainFromToncoin) return undefined;

    return (
      <div className={styles.changellyInfoBlock}>
        <span className={styles.changellyDescription}>
          {
            lang('$swap_changelly_from_ton_description', {
              blockchain: (
                <span className={styles.changellyDescriptionBold}>
                  {getBlockchainNetworkName(tokenOut?.blockchain)}
                </span>
              ),
            })
          }
        </span>
        <InteractiveTextField
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

      {renderChangellyInfo()}

      {renderButtons()}
    </>
  );
}

export default memo(SwapResult);
