import React, { memo, type TeactNode, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiSwapActivity, ApiSwapAsset } from '../../../api/types';

import {
  ANIMATION_END_DELAY,
  ANIMATION_LEVEL_MIN,
  CHANGELLY_LIVE_CHAT_URL,
  CHANGELLY_SECURITY_EMAIL,
  CHANGELLY_SUPPORT_EMAIL,
  CHANGELLY_WAITING_DEADLINE,
  TON_EXPLORER_NAME,
  TON_SYMBOL,
  TONCOIN_SLUG,
} from '../../../config';
import { selectCurrentAccountState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatFullDay, formatTime } from '../../../util/dateFormat';
import { formatCurrency, formatCurrencyExtended } from '../../../util/formatNumber';
import getBlockchainNetworkName from '../../../util/swap/getBlockchainNetworkName';
import { getTonExplorerTransactionUrl } from '../../../util/url';

import { useDeviceScreen } from '../../../hooks/useDeviceScreen';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';
import useQrCode from '../../../hooks/useQrCode';

import Countdown from '../../common/Countdown';
import SwapTokensInfo from '../../common/SwapTokensInfo';
import Button from '../../ui/Button';
import InteractiveTextField from '../../ui/InteractiveTextField';
import Modal, { CLOSE_DURATION, CLOSE_DURATION_PORTRAIT } from '../../ui/Modal';

import modalStyles from '../../ui/Modal.module.scss';
import styles from './TransactionModal.module.scss';

type StateProps = {
  activity?: ApiSwapActivity;
  tokensBySlug?: Record<string, ApiSwapAsset>;
};

const CHANGELLY_EXPIRE_CHECK_STATUSES = new Set(['new', 'waiting']);
const CHANGELLY_PENDING_STATUSES = new Set(['new', 'waiting', 'confirming', 'exchanging', 'sending']);
const CHANGELLY_ERROR_STATUSES = new Set(['failed', 'expired', 'refunded', 'overdue']);
const ONCHAIN_ERROR_STATUSES = new Set(['failed', 'expired']);

function SwapActivityModal({ activity, tokensBySlug }: StateProps) {
  const {
    startSwap,
    closeActivityInfo,
  } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  const animationLevel = getGlobal().settings.animationLevel;
  const animationDuration = animationLevel === ANIMATION_LEVEL_MIN
    ? 0
    : (isPortrait ? CLOSE_DURATION_PORTRAIT : CLOSE_DURATION) + ANIMATION_END_DELAY;
  const renderedActivity = usePrevDuringAnimation(activity, animationDuration);
  const tonExplorerTitle = useMemo(() => {
    return (lang('View Transaction on %ton_explorer_name%', {
      ton_explorer_name: TON_EXPLORER_NAME,
    }) as TeactNode[]
    ).join('');
  }, [lang]);

  const { txIds, timestamp, networkFee = 0 } = renderedActivity ?? {};

  let fromToken: ApiSwapAsset | undefined;
  let toToken: ApiSwapAsset | undefined;
  let fromAmount = '0';
  let toAmount = '0';
  let isPending = true;
  let isError = false;
  let isCexSwap = false;
  let isCexError = false;
  let isCexHold = false;
  let isCexWaiting = false;
  let isCexPending = false;
  let isExpired = false;
  let cexTransactionId = '';
  let title = '';
  let cexErrorMessage = '';
  let isFromToncoin = true;
  let isCountdownFinished = false;

  if (renderedActivity) {
    const {
      status, from, to, cex,
    } = renderedActivity;
    fromToken = tokensBySlug?.[from];
    toToken = tokensBySlug?.[to];
    fromAmount = renderedActivity.fromAmount;
    toAmount = renderedActivity.toAmount;
    isFromToncoin = from === TONCOIN_SLUG;

    if (cex) {
      isCountdownFinished = timestamp
        ? (timestamp + CHANGELLY_WAITING_DEADLINE - Date.now() < 0)
        : false;
      isExpired = CHANGELLY_EXPIRE_CHECK_STATUSES.has(cex.status) && isCountdownFinished;
      isCexSwap = true;
      isPending = !isExpired && CHANGELLY_PENDING_STATUSES.has(cex.status);
      isCexPending = isPending;
      isCexError = isExpired || CHANGELLY_ERROR_STATUSES.has(cex.status);
      isCexHold = cex.status === 'hold';
      // Skip the 'waiting' status for transactions from Toncoin to account for delayed status updates from Сhangelly
      isCexWaiting = cex.status === 'waiting' && !isFromToncoin && !isExpired;
      cexTransactionId = cex.transactionId;
    } else {
      isPending = status === 'pending';
      isError = ONCHAIN_ERROR_STATUSES.has(status!);
    }

    if (isPending) {
      title = lang('Swapping');
    } else if (isCexHold) {
      title = lang('Swap On Hold');
    } else if (isCexError) {
      const { status: cexStatus } = renderedActivity?.cex ?? {};
      if (cexStatus === 'expired' || cexStatus === 'overdue') {
        title = lang('Swap Expired');
        cexErrorMessage = lang('You have not sent the coins to the specified address.');
      } else if (cexStatus === 'refunded') {
        title = lang('Swap Refunded');
        cexErrorMessage = lang('Exchange failed and coins were refunded to your wallet.');
      } else {
        title = lang('Swap Failed');
      }
    } else if (isError) {
      title = lang('Swap Failed');
    } else {
      title = lang('Swapped');
    }
  }

  const [, transactionHash] = (txIds?.[0] || '').split(':');
  const transactionUrl = getTonExplorerTransactionUrl(transactionHash);

  const { payinAddress, payoutAddress, payinExtraId } = renderedActivity?.cex || {};
  const shouldShowQrCode = !payinExtraId;
  const { qrCodeRef, isInitialized } = useQrCode(
    payinAddress,
    !!payinAddress,
    styles.qrCodeHidden,
    true,
  );

  const handleClose = useLastCallback(() => {
    closeActivityInfo({ id: renderedActivity!.id });
  });

  const handleSwapClick = useLastCallback(() => {
    closeActivityInfo({ id: activity!.id });
    startSwap({
      tokenInSlug: activity!.from,
      tokenOutSlug: activity!.to,
      amountIn: fromAmount,
    });
  });

  function renderHeader() {
    return (
      <div className={styles.transactionHeader}>
        <div className={styles.headerTitle}>
          {title}
          {isPending && (
            <i
              className={buildClassName(styles.clockIcon, 'icon-clock')}
              title={title}
              aria-hidden
            />
          )}
        </div>
        {!!timestamp && (
          <div className={styles.headerDate}>
            {formatFullDay(lang.code!, timestamp)}, {formatTime(timestamp)}
          </div>
        )}
      </div>
    );
  }

  function renderFooterButton() {
    let isButtonVisible = true;
    let buttonText = 'Swap Again';

    if (isCexWaiting) {
      return (
        <Button onClick={handleClose} className={styles.button}>
          {lang('Close')}
        </Button>
      );
    }

    if (isCexHold) {
      isButtonVisible = false;
    } else if (isCexError) {
      const { status: cexStatus } = renderedActivity?.cex ?? {};
      if (cexStatus === 'expired' || cexStatus === 'refunded' || cexStatus === 'overdue') {
        buttonText = 'Try Again';
      }
    }

    if (!isButtonVisible) {
      return undefined;
    }

    return (
      <Button onClick={handleSwapClick} className={styles.button}>
        {lang(buttonText)}
      </Button>
    );
  }

  function renderCexInformation() {
    if (isCexHold) {
      return (
        <div className={styles.textFieldWrapperFullWidth}>
          <span className={styles.changellyDescription}>
            {lang('$swap_changelly_kyc_security', {
              email: (
                <span className={styles.changellyDescriptionBold}>
                  {CHANGELLY_SECURITY_EMAIL}
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
      <div className={buildClassName(styles.textFieldWrapperFullWidth, styles.swapSupportBlock)}>
        {cexErrorMessage && <span className={styles.errorCexMessage}>{cexErrorMessage}</span>}

        {isCexPending && (
          <span className={buildClassName(styles.changellyDescription)}>
            {lang('Please note that it may take up to a few hours for tokens to appear in your wallet.')}
          </span>
        )}
        {isCountdownFinished && (
          <>
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
          </>
        )}
      </div>
    );
  }

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

  function renderFee() {
    return (
      <div className={styles.textFieldWrapper}>
        <span className={styles.textFieldLabel}>
          {lang('Blockchain Fee')}
        </span>
        <div className={styles.textField}>
          {formatCurrency(networkFee, TON_SYMBOL, undefined, true)}
        </div>
      </div>
    );
  }

  function renderAddress() {
    if (!payinAddress) return undefined;

    return (
      <div className={styles.textFieldWrapper}>
        <span className={styles.textFieldLabel}>
          {isFromToncoin
            ? lang('Your %blockchain% Address', { blockchain: toToken?.name })
            : lang('Address for %blockchain% transfer', { blockchain: fromToken?.name })}
        </span>
        <InteractiveTextField
          address={isFromToncoin ? payoutAddress : payinAddress}
          copyNotification={lang('Address was copied!')}
          noSavedAddress
          noExplorer
        />
      </div>
    );
  }

  function renderSwapInfo() {
    if (isCexWaiting) {
      return (
        <div className={styles.changellyInfoBlock}>
          {networkFee > 0 && renderFee()}
          <span className={styles.changellyDescription}>{lang('$swap_changelly_to_ton_description1', {
            value: (
              <span className={styles.changellyDescriptionBold}>
                {formatCurrencyExtended(Number(fromAmount), fromToken?.symbol ?? '', true)}
              </span>
            ),
            blockchain: (
              <span className={styles.changellyDescriptionBold}>
                {getBlockchainNetworkName(fromToken?.blockchain)}
              </span>
            ),
            time: <Countdown timestamp={timestamp ?? 0} deadline={CHANGELLY_WAITING_DEADLINE} />,
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
        </div>
      );
    }

    const shouldRenderFee = !(isCexError || isCexHold) || networkFee > 0;

    return (
      <>
        {shouldRenderFee && renderFee()}
        {renderAddress()}
        {renderMemo()}
      </>
    );
  }

  function renderContent() {
    return (
      <>
        <SwapTokensInfo
          tokenIn={fromToken}
          amountIn={fromAmount}
          tokenOut={toToken}
          amountOut={toAmount}
          isError={isError || isCexError}
        />
        <div className={styles.infoBlock}>
          {renderSwapInfo()}
          {isCexSwap && renderCexInformation()}
        </div>
        <div className={styles.footer}>
          {renderFooterButton()}
        </div>
      </>
    );
  }

  return (
    <Modal
      hasCloseButton
      title={renderHeader()}
      isOpen={Boolean(activity)}
      nativeBottomSheetKey="swap-activity"
      onClose={handleClose}
    >
      <div className={modalStyles.transitionContent}>
        {transactionUrl && (
          <a
            href={transactionUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.tonExplorer}
            title={tonExplorerTitle}
          >
            <i className="icon-tonexplorer" aria-hidden />
          </a>
        )}
        {renderContent()}
      </div>
    </Modal>
  );
}

export default memo(
  withGlobal((global): StateProps => {
    const accountState = selectCurrentAccountState(global);

    const id = accountState?.currentActivityId;
    const activity = id ? accountState?.activities?.byId[id] : undefined;

    return {
      activity: activity?.kind === 'swap' ? activity : undefined,
      tokensBySlug: global.swapTokenInfo?.bySlug,
    };
  })(SwapActivityModal),
);
