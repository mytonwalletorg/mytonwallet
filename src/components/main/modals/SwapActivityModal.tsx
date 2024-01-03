import React, { memo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiSwapActivity, ApiSwapAsset } from '../../../api/types';

import {
  ANIMATION_END_DELAY,
  ANIMATION_LEVEL_MIN,
  CHANGELLY_SECURITY_EMAIL,
  CHANGELLY_SUPPORT_EMAIL,
  CHANGELLY_WAITING_DEADLINE,
  TON_SYMBOL,
  TON_TOKEN_SLUG,
  TONSCAN_BASE_MAINNET_URL,
} from '../../../config';
import { selectCurrentAccountState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatFullDay, formatTime } from '../../../util/dateFormat';
import { formatCurrency, formatCurrencyExtended } from '../../../util/formatNumber';
import getBlockchainNetworkName from '../../../util/swap/getBlockchainNetworkName';
import getSwapRate from '../../../util/swap/getSwapRate';

import { useDeviceScreen } from '../../../hooks/useDeviceScreen';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';

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

enum EmailType {
  Support,
  Security,
}

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

  const { txId, timestamp, networkFee = 0 } = renderedActivity ?? {};

  let fromToken: ApiSwapAsset | undefined;
  let toToken: ApiSwapAsset | undefined;
  let fromAmount = 0;
  let toAmount = 0;
  let isPending = true;
  let isError = false;
  let isCexError = false;
  let isCexHold = false;
  let isCexWaiting = false;
  let title = '';
  let errorMessage = '';
  let emailType: EmailType | undefined;

  if (renderedActivity) {
    const {
      status, from, to, cex,
    } = renderedActivity;
    fromToken = tokensBySlug?.[from];
    toToken = tokensBySlug?.[to];
    fromAmount = Number(renderedActivity.fromAmount);
    toAmount = Number(renderedActivity.toAmount);

    const isFromTon = from === TON_TOKEN_SLUG;

    if (cex) {
      isPending = CHANGELLY_PENDING_STATUSES.has(cex.status);
      isCexError = CHANGELLY_ERROR_STATUSES.has(cex.status);
      isCexHold = cex.status === 'hold';
      // Skip the 'waiting' status for transactions from TON to account for delayed status updates from changelly.
      isCexWaiting = cex.status === 'waiting' && !isFromTon;
    } else {
      isPending = status === 'pending';
      isError = ONCHAIN_ERROR_STATUSES.has(status!);
    }

    if (isPending) {
      title = lang('Swapping');
    } else if (isCexHold) {
      title = lang('Swap Hold');
      errorMessage = lang('Please contact security team to pass the KYC procedure.');
      emailType = EmailType.Security;
    } else if (isCexError) {
      const { status: cexStatus } = renderedActivity?.cex ?? {};
      if (cexStatus === 'expired' || cexStatus === 'overdue') {
        title = lang('Swap Expired');
        errorMessage = lang('You have not sent the coins to the specified address.');
      } else if (cexStatus === 'refunded') {
        title = lang('Swap Refunded');
        errorMessage = lang('Exchange failed and coins were refunded to your wallet.');
      } else {
        title = lang('Swap Failed');
        errorMessage = lang('Please contact support and provide a transaction ID.');
        emailType = EmailType.Support;
      }
    } else if (isError) {
      title = lang('Swap Failed');
    } else {
      title = lang('Swapped');
    }
  }

  const [, transactionHash] = (txId || '').split(':');
  const tonscanBaseUrl = TONSCAN_BASE_MAINNET_URL;
  const tonscanTransactionUrl = transactionHash ? `${tonscanBaseUrl}tx/${transactionHash}` : undefined;

  const handleClose = useLastCallback(() => {
    closeActivityInfo({ id: renderedActivity!.id });
  });

  const handleSwapClick = useLastCallback(() => {
    closeActivityInfo({ id: activity!.id });
    startSwap({
      tokenInSlug: activity!.from,
      tokenOutSlug: activity!.to,
      amountIn: fromAmount,
      isPortrait,
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
        <Button onClick={handleClose} className={styles.button} isPrimary>
          {lang('Close')}
        </Button>
      );
    }

    if (isCexHold) {
      isButtonVisible = false;
    } else if (isCexError) {
      const { status: cexStatus } = renderedActivity?.cex ?? {};
      if (cexStatus === 'expired' || cexStatus === 'refunded') {
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

  function renderErrorMessage() {
    const email = emailType === EmailType.Support
      ? CHANGELLY_SUPPORT_EMAIL
      : CHANGELLY_SECURITY_EMAIL;

    return (
      <div className={styles.errorCexBlock}>
        <span className={styles.errorCexMessage}>{errorMessage}</span>
        {emailType !== undefined && <a className={styles.errorCexEmail} href={`mailto:${email}`}>{email}</a>}
      </div>
    );
  }

  function renderSwapInfo() {
    const payinAddress = renderedActivity?.cex?.payinAddress;

    if (isCexWaiting) {
      return (
        <div className={styles.changellyInfoBlock}>
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
        </div>
      );
    }

    if (isCexError || isCexHold) {
      return (
        <div className={styles.textFieldWrapper}>
          <span className={styles.textFieldLabel}>{lang('Changelly Payment Address')}</span>
          <InteractiveTextField
            address={payinAddress}
            copyNotification={lang('Address was copied!')}
            noSavedAddress
            noExplorer
          />
        </div>
      );
    }

    return (
      <>
        {payinAddress && (
          <div className={styles.textFieldWrapper}>
            <span className={styles.textFieldLabel}>{lang('Changelly Payment Address')}</span>
            <InteractiveTextField
              address={payinAddress}
              copyNotification={lang('Address was copied!')}
              noSavedAddress
              noExplorer
            />
          </div>
        )}
        <div className={styles.textFieldWrapper}>
          <span className={styles.textFieldLabel}>{lang('Exchange rate')}</span>
          {renderCurrency(renderedActivity, fromToken, toToken)}
        </div>
        <div className={styles.textFieldWrapper}>
          <span className={styles.textFieldLabel}>
            {lang('Blockchain Fee')}
          </span>
          <div className={styles.textField}>
            {formatCurrency(networkFee, TON_SYMBOL)}
          </div>
        </div>
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
          {renderErrorMessage()}
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
        {tonscanTransactionUrl && (
          <a
            href={tonscanTransactionUrl}
            target="_blank"
            rel="noreferrer noopener"
            className={styles.tonscan}
            title={lang('View Transaction on TON Explorer')}
          >
            <i className="icon-tonscan" aria-hidden />
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

function renderCurrency(activity?: ApiSwapActivity, fromToken?: ApiSwapAsset, toToken?: ApiSwapAsset) {
  const rate = getSwapRate(activity?.fromAmount, activity?.toAmount, fromToken, toToken);

  if (!rate) return undefined;

  return (
    <div className={styles.textField}>
      1 {rate.firstCurrencySymbol}{' ≈ '}
      {rate.price}{' '}{rate.secondCurrencySymbol}
    </div>
  );
}
