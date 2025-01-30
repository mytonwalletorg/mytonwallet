import React, { memo, type TeactNode, useMemo } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiSwapActivity, ApiSwapAsset } from '../../../api/types';
import type { Account, Theme } from '../../../global/types';
import type { FeePrecision } from '../../../util/fee/types';

import {
  ANIMATED_STICKER_TINY_ICON_PX,
  ANIMATION_END_DELAY,
  ANIMATION_LEVEL_MIN,
  CHANGELLY_LIVE_CHAT_URL,
  CHANGELLY_SECURITY_EMAIL,
  CHANGELLY_SUPPORT_EMAIL,
  CHANGELLY_WAITING_DEADLINE,
  TONCOIN,
} from '../../../config';
import { Big } from '../../../lib/big.js';
import { getIsInternalSwap, getIsSupportedChain, resolveSwapAsset } from '../../../global/helpers';
import { selectCurrentAccount, selectCurrentAccountState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatFullDay, formatTime } from '../../../util/dateFormat';
import { formatCurrencyExtended } from '../../../util/formatNumber';
import getChainNetworkName from '../../../util/swap/getChainNetworkName';
import { getTransactionHashFromTxId } from '../../../util/tokens';
import { getExplorerName, getExplorerTransactionUrl } from '../../../util/url';
import { ANIMATED_STICKERS_PATHS } from '../../ui/helpers/animatedAssets';

import useAppTheme from '../../../hooks/useAppTheme';
import { useDeviceScreen } from '../../../hooks/useDeviceScreen';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';
import useQrCode from '../../../hooks/useQrCode';

import Countdown from '../../common/Countdown';
import SwapTokensInfo from '../../common/SwapTokensInfo';
import AnimatedIconWithPreview from '../../ui/AnimatedIconWithPreview';
import Button from '../../ui/Button';
import Fee from '../../ui/Fee';
import InteractiveTextField from '../../ui/InteractiveTextField';
import Modal, { CLOSE_DURATION, CLOSE_DURATION_PORTRAIT } from '../../ui/Modal';

import modalStyles from '../../ui/Modal.module.scss';
import styles from './TransactionModal.module.scss';

type StateProps = {
  addressByChain?: Account['addressByChain'];
  activity?: ApiSwapActivity;
  tokensBySlug?: Record<string, ApiSwapAsset>;
  theme: Theme;
};

const CHANGELLY_EXPIRE_CHECK_STATUSES = new Set(['new', 'waiting']);
const CHANGELLY_PENDING_STATUSES = new Set(['new', 'waiting', 'confirming', 'exchanging', 'sending']);
const CHANGELLY_ERROR_STATUSES = new Set(['failed', 'expired', 'refunded', 'overdue']);
const ONCHAIN_ERROR_STATUSES = new Set(['failed', 'expired']);

function SwapActivityModal({
  activity, tokensBySlug, theme, addressByChain,
}: StateProps) {
  const {
    startSwap,
    closeActivityInfo,
  } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  const isOpen = Boolean(activity);
  const animationLevel = getGlobal().settings.animationLevel;
  const animationDuration = animationLevel === ANIMATION_LEVEL_MIN
    ? 0
    : (isPortrait ? CLOSE_DURATION_PORTRAIT : CLOSE_DURATION) + ANIMATION_END_DELAY;
  const renderedActivity = usePrevDuringAnimation(activity, animationDuration);
  const tonExplorerTitle = useMemo(() => {
    return (lang('View Transaction on %ton_explorer_name%', {
      ton_explorer_name: getExplorerName('ton'),
    }) as TeactNode[]
    ).join('');
  }, [lang]);
  const appTheme = useAppTheme(theme);

  const {
    txIds,
    timestamp,
    networkFee = '0',
    ourFee = '0',
  } = renderedActivity ?? {};
  const { payinAddress, payoutAddress, payinExtraId } = renderedActivity?.cex || {};

  let fromAmount = '0';
  let toAmount = '0';
  let isPending = true;
  let isError = false;
  let shouldRenderCexInfo = false;
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

  const fromToken = useMemo(() => {
    if (!renderedActivity?.from || !tokensBySlug) return undefined;

    return resolveSwapAsset(tokensBySlug, renderedActivity.from);
  }, [renderedActivity?.from, tokensBySlug]);

  const toToken = useMemo(() => {
    if (!renderedActivity?.to || !tokensBySlug) return undefined;

    return resolveSwapAsset(tokensBySlug, renderedActivity.to);
  }, [renderedActivity?.to, tokensBySlug]);
  const isInternalSwap = getIsInternalSwap({
    from: fromToken, to: toToken, toAddress: payoutAddress, addressByChain,
  });

  if (renderedActivity) {
    const {
      status, from, cex,
    } = renderedActivity;
    fromAmount = renderedActivity.fromAmount;
    toAmount = renderedActivity.toAmount;
    isFromToncoin = from === TONCOIN.slug;

    if (cex) {
      isCountdownFinished = timestamp
        ? (timestamp + CHANGELLY_WAITING_DEADLINE - Date.now() < 0)
        : false;
      isExpired = CHANGELLY_EXPIRE_CHECK_STATUSES.has(cex.status) && isCountdownFinished;
      shouldRenderCexInfo = cex.status !== 'finished';
      isPending = !isExpired && CHANGELLY_PENDING_STATUSES.has(cex.status);
      isCexPending = isPending;
      isCexError = isExpired || CHANGELLY_ERROR_STATUSES.has(cex.status);
      isCexHold = cex.status === 'hold';
      // Skip the 'waiting' status for transactions from Toncoin to other chains
      // or from TRON to TON inside a multichain wallet for delayed status updates from Сhangelly
      isCexWaiting = cex.status === 'waiting' && !isExpired && !isInternalSwap && !isFromToncoin;
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
      const { status: cexStatus } = renderedActivity.cex ?? {};
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

  const transactionHash = getTransactionHashFromTxId('ton', txIds?.[0] || '');
  const transactionUrl = getExplorerTransactionUrl('ton', transactionHash);

  const shouldShowQrCode = !payinExtraId && toToken?.chain === 'ton' && !isInternalSwap;
  const { qrCodeRef, isInitialized } = useQrCode({
    address: payinAddress,
    isActive: Boolean(payinAddress),
    hiddenClassName: styles.qrCodeHidden,
    hideLogo: true,
  });

  const handleClose = useLastCallback(() => {
    closeActivityInfo({ id: renderedActivity!.id });
  });

  const handleSwapClick = useLastCallback(() => {
    closeActivityInfo({ id: activity!.id });
    startSwap({
      tokenInSlug: fromToken!.slug,
      tokenOutSlug: toToken!.slug,
      amountIn: fromAmount,
    });
  });

  function renderHeader() {
    return (
      <div className={styles.transactionHeader}>
        <div className={styles.headerTitle}>
          {title}
          {isPending && (
            <AnimatedIconWithPreview
              play={isOpen}
              size={ANIMATED_STICKER_TINY_ICON_PX}
              nonInteractive
              noLoop={false}
              tgsUrl={ANIMATED_STICKERS_PATHS[appTheme].iconClock}
              previewUrl={ANIMATED_STICKERS_PATHS[appTheme].preview.iconClock}
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
    if (!Number(networkFee) || !fromToken) {
      return undefined;
    }

    const precision: FeePrecision = activity?.status === 'pending' ? 'approximate' : 'exact';
    const terms = isFromToncoin ? {
      native: Big(networkFee).add(ourFee).toString(),
    } : {
      native: networkFee,
      token: ourFee,
    };

    return (
      <div className={styles.textFieldWrapperFullWidth}>
        <span className={styles.textFieldLabel}>
          {lang('Fee')}
        </span>
        <div className={styles.textField}>
          <span>
            <Fee terms={terms} token={fromToken} precision={precision} />
          </span>
        </div>
      </div>
    );
  }

  function renderAddress() {
    if (!payinAddress) return undefined;
    const token = isFromToncoin ? toToken : fromToken;
    const chain = getIsSupportedChain(token?.chain) ? token.chain : undefined;

    return (
      <div className={styles.textFieldWrapper}>
        <span className={styles.textFieldLabel}>
          {isFromToncoin
            ? lang('Your %blockchain% Address', { blockchain: toToken?.name })
            : lang('Address for %blockchain% transfer', { blockchain: fromToken?.name })}
        </span>
        <InteractiveTextField
          chain={chain}
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
      if (isInternalSwap) return undefined;
      const chain = getIsSupportedChain(fromToken?.chain) ? fromToken.chain : undefined;

      return (
        <div className={styles.changellyInfoBlock}>
          {renderFee()}
          <span className={styles.changellyDescription}>{lang('$swap_changelly_to_ton_description1', {
            value: (
              <span className={styles.changellyDescriptionBold}>
                {formatCurrencyExtended(Number(fromAmount), fromToken?.symbol ?? '', true)}
              </span>
            ),
            blockchain: (
              <span className={styles.changellyDescriptionBold}>
                {getChainNetworkName(fromToken?.chain)}
              </span>
            ),
            time: <Countdown timestamp={timestamp ?? 0} deadline={CHANGELLY_WAITING_DEADLINE} />,
          })}
          </span>
          <InteractiveTextField
            chain={chain}
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

    return (
      <>
        {renderFee()}
        {!isInternalSwap && renderAddress()}
        {!isInternalSwap && renderMemo()}
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
          {shouldRenderCexInfo && renderCexInformation()}
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
      titleClassName={styles.modalTitle}
      isOpen={isOpen}
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
            aria-label={tonExplorerTitle}
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
    const account = selectCurrentAccount(global);

    const id = accountState?.currentActivityId;
    const activity = id ? accountState?.activities?.byId[id] : undefined;

    return {
      activity: activity?.kind === 'swap' ? activity : undefined,
      tokensBySlug: global.swapTokenInfo?.bySlug,
      theme: global.settings.theme,
      addressByChain: account?.addressByChain,
    };
  })(SwapActivityModal),
);
