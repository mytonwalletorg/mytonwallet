import React, { memo, useMemo, useState } from '../../lib/teact/teact';

import type { UserSwapToken } from '../../global/types';

import { CHANGELLY_WAITING_DEADLINE } from '../../config';
import buildClassName from '../../util/buildClassName';
import { formatCurrencyExtended } from '../../util/formatNumber';
import getBlockchainNetworkName from '../../util/swap/getBlockchainNetworkName';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Countdown from '../common/Countdown';
import SwapTokensInfo from '../common/SwapTokensInfo';
import Button from '../ui/Button';
import InteractiveTextField from '../ui/InteractiveTextField';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Swap.module.scss';

interface OwnProps {
  isActive: boolean;
  tokenIn?: UserSwapToken;
  tokenOut?: UserSwapToken;
  amountIn?: number;
  amountOut?: number;
  payinAddress?: string;
  onClose: NoneToVoidFunction;
}

function SwapWaitTokens({
  isActive,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  payinAddress,
  onClose,
}: OwnProps) {
  const lang = useLang();

  const [isExpired, setIsExpired] = useState(false);

  const timestamp = useMemo(() => Date.now(), []);

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const handleTimeout = useLastCallback(() => {
    setIsExpired(true);
  });

  function renderInfo() {
    if (isExpired) {
      return (
        <div className={styles.changellyInfoBlock}>
          <span className={styles.changellyImportantRed}>
            {lang('The time for sending coins is over')}
          </span>
          <span className={styles.changellyDescription}>
            {lang('Please wait a few moments...')}
          </span>
        </div>
      );
    }

    return (
      <div className={styles.changellyInfoBlock}>
        <span className={styles.changellyDescription}>{lang('$swap_changelly_to_ton_description1', {
          value: (
            <span className={styles.changellyDescriptionBold}>
              {formatCurrencyExtended(Number(amountIn), tokenIn?.symbol ?? '', true)}
            </span>
          ),
          blockchain: (
            <span className={styles.changellyDescriptionBold}>
              {getBlockchainNetworkName(tokenIn?.blockchain)}
            </span>
          ),
          time: <Countdown
            timestamp={timestamp}
            deadline={CHANGELLY_WAITING_DEADLINE}
            onCompleted={handleTimeout}
          />,
        })}
        </span>
        <InteractiveTextField
          address={payinAddress}
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
      <ModalHeader
        title={lang('Waiting for Payment')}
        onClose={onClose}
      />

      <div className={buildClassName(styles.scrollContent, styles.selectBlockchainBlock, 'custom-scroll')}>
        <SwapTokensInfo
          tokenIn={tokenIn}
          amountIn={amountIn}
          tokenOut={tokenOut}
          amountOut={amountOut}
        />

        <Transition
          name="fade"
          activeKey={isExpired ? 1 : 0}
        >
          {renderInfo()}
        </Transition>

        <div className={modalStyles.buttons}>
          <Button onClick={onClose} isPrimary>{lang('Close')}</Button>
        </div>
      </div>
    </>
  );
}

export default memo(SwapWaitTokens);
