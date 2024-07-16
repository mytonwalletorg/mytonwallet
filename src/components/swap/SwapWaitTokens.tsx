import React, { memo, useMemo, useState } from '../../lib/teact/teact';

import type { ApiActivity } from '../../api/types';
import type { UserSwapToken } from '../../global/types';

import { CHANGELLY_LIVE_CHAT_URL, CHANGELLY_SUPPORT_EMAIL, CHANGELLY_WAITING_DEADLINE } from '../../config';
import buildClassName from '../../util/buildClassName';
import { formatCurrencyExtended } from '../../util/formatNumber';
import getBlockchainNetworkName from '../../util/swap/getBlockchainNetworkName';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useQrCode from '../../hooks/useQrCode';

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
  amountIn?: string;
  amountOut?: string;
  payinAddress?: string;
  payinExtraId?: string;
  activity?: ApiActivity;
  onClose: NoneToVoidFunction;
}

function SwapWaitTokens({
  isActive,
  tokenIn,
  tokenOut,
  amountIn,
  amountOut,
  payinAddress,
  payinExtraId,
  activity,
  onClose,
}: OwnProps) {
  const lang = useLang();

  const [isExpired, setIsExpired] = useState(false);

  const timestamp = useMemo(() => Date.now(), []);

  const { qrCodeRef, isInitialized } = useQrCode(payinAddress, isActive, styles.qrCodeHidden, true);

  const shouldShowQrCode = !payinExtraId;

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const handleTimeout = useLastCallback(() => {
    setIsExpired(true);
  });

  function renderMemo() {
    if (!payinExtraId) return undefined;

    return (
      <div className={styles.textFieldWrapperFullWidth}>
        <span className={styles.textFieldLabel}>
          {lang('Memo')}
        </span>
        <InteractiveTextField
          address={payinExtraId}
          copyNotification={lang('Memo was copied!')}
          noSavedAddress
          noExplorer
          className={styles.changellyTextField}
        />
      </div>
    );
  }

  function renderInfo() {
    if (isExpired) {
      const cexTransactionId = activity && 'cex' in activity ? activity.cex?.transactionId : undefined;

      return (
        <div className={styles.changellyInfoBlock}>
          <span className={styles.changellyImportantRed}>
            {lang('The time for sending coins is over.')}
          </span>
          <span className={styles.changellyDescription}>
            {lang('$swap_changelly_support', {
              livechat: (
                <a
                  href={CHANGELLY_LIVE_CHAT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.changellyDescriptionBold}
                >
                  {lang('Changelly Live Chat')}
                </a>),
              email: (
                <span className={styles.changellyDescriptionBold}>
                  {CHANGELLY_SUPPORT_EMAIL}
                </span>),
            })}
          </span>
          {cexTransactionId && (
            <InteractiveTextField
              text={cexTransactionId}
              copyNotification={lang('Transaction ID was copied!')}
              noSavedAddress
              noExplorer
              className={styles.changellyTextField}
            />
          )}
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
        {renderMemo()}
        {shouldShowQrCode && (
          <div className={buildClassName(styles.qrCode, !isInitialized && styles.qrCodeHidden)} ref={qrCodeRef} />
        )}
        <span className={styles.changellyDescription}>
          {lang('Please note that it may take up to a few hours for tokens to appear in your wallet.')}
        </span>
      </div>
    );
  }

  return (
    <>
      <ModalHeader
        title={lang(isExpired ? 'Swap Expired' : 'Waiting for Payment')}
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
          <Button isPrimary onClick={onClose}>{lang('Close')}</Button>
        </div>
      </div>
    </>
  );
}

export default memo(SwapWaitTokens);
