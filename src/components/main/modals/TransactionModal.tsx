import React, { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { ApiToken, ApiTransactionActivity } from '../../../api/types';

import {
  ANIMATION_END_DELAY,
  ANIMATION_LEVEL_MIN,
  IS_CAPACITOR,
  STAKING_CYCLE_DURATION_MS,
  TON_SYMBOL,
  TON_TOKEN_SLUG,
  TONSCAN_BASE_MAINNET_URL,
  TONSCAN_BASE_TESTNET_URL,
} from '../../../config';
import { bigStrToHuman, getIsTxIdLocal } from '../../../global/helpers';
import { selectCurrentAccountState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { vibrateOnSuccess } from '../../../util/capacitor';
import { formatFullDay, formatRelativeHumanDateTime, formatTime } from '../../../util/dateFormat';
import resolveModalTransitionName from '../../../util/resolveModalTransitionName';
import { callApi } from '../../../api';

import { useDeviceScreen } from '../../../hooks/useDeviceScreen';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';
import useShowTransition from '../../../hooks/useShowTransition';
import useSyncEffect from '../../../hooks/useSyncEffect';

import TransactionAmount from '../../common/TransactionAmount';
import AmountWithFeeTextField from '../../ui/AmountWithFeeTextField';
import Button from '../../ui/Button';
import InteractiveTextField from '../../ui/InteractiveTextField';
import Modal, { CLOSE_DURATION, CLOSE_DURATION_PORTRAIT } from '../../ui/Modal';
import ModalHeader from '../../ui/ModalHeader';
import PasswordForm from '../../ui/PasswordForm';
import Transition from '../../ui/Transition';

import transferStyles from '../../transfer/Transfer.module.scss';
import modalStyles from '../../ui/Modal.module.scss';
import styles from './TransactionModal.module.scss';

import scamImg from '../../../assets/scam.svg';

type StateProps = {
  transaction?: ApiTransactionActivity;
  tokensBySlug?: Record<string, ApiToken>;
  savedAddresses?: Record<string, string>;
  isTestnet?: boolean;
  startOfStakingCycle?: number;
  endOfStakingCycle?: number;
  isUnstakeRequested?: boolean;
  isLongUnstakeRequested?: boolean;
};
const enum SLIDES {
  initial,
  password,
}

const EMPTY_HASH_VALUE = 'NOHASH';

function TransactionModal({
  transaction,
  tokensBySlug,
  savedAddresses,
  isTestnet,
  startOfStakingCycle,
  endOfStakingCycle,
  isUnstakeRequested,
  isLongUnstakeRequested,
}: StateProps) {
  const {
    startTransfer,
    startStaking,
    closeActivityInfo,
    setIsPinAccepted,
    clearIsPinAccepted,
  } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  const [currentSlide, setCurrentSlide] = useState<number>(SLIDES.initial);
  const [nextKey, setNextKey] = useState<number | undefined>(SLIDES.password);
  const animationLevel = getGlobal().settings.animationLevel;
  const animationDuration = animationLevel === ANIMATION_LEVEL_MIN
    ? 0
    : (isPortrait ? CLOSE_DURATION_PORTRAIT : CLOSE_DURATION) + ANIMATION_END_DELAY;
  const renderedTransaction = usePrevDuringAnimation(transaction, animationDuration);
  const [unstakeDate, setUnstakeDate] = useState<number>(Date.now() + STAKING_CYCLE_DURATION_MS);

  const {
    fromAddress,
    toAddress,
    amount,
    comment,
    encryptedComment,
    fee,
    id,
    isIncoming,
    slug,
    timestamp,
  } = renderedTransaction || {};
  const [, transactionHash] = (id || '').split(':');
  const isStaking = Boolean(transaction?.type);

  const token = slug ? tokensBySlug?.[slug] : undefined;
  const amountHuman = amount ? bigStrToHuman(amount, token?.decimals) : 0;
  const address = isIncoming ? fromAddress : toAddress;
  const addressName = (address && savedAddresses?.[address]) || transaction?.metadata?.name;
  const isScam = Boolean(transaction?.metadata?.isScam);

  const [isLoading, setIsLoading] = useState(false);
  const [decryptedComment, setDecryptedComment] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();

  const tonscanBaseUrl = isTestnet ? TONSCAN_BASE_TESTNET_URL : TONSCAN_BASE_MAINNET_URL;
  const tonscanTransactionUrl = transactionHash && transactionHash !== EMPTY_HASH_VALUE
    ? `${tonscanBaseUrl}tx/${transactionHash}`
    : undefined;

  const [withUnstakeTimer, setWithUnstakeTimer] = useState(false);

  useEffect(() => {
    if (transaction?.type !== 'unstakeRequest' || !startOfStakingCycle) {
      return;
    }

    const shouldDisplayTimer = Boolean(isUnstakeRequested || isLongUnstakeRequested)
      && transaction.timestamp >= startOfStakingCycle;
    setWithUnstakeTimer(shouldDisplayTimer);
  }, [isUnstakeRequested, startOfStakingCycle, transaction, isLongUnstakeRequested]);

  const {
    shouldRender: shouldRenderUnstakeTimer,
    transitionClassNames: unstakeTimerClassNames,
  } = useShowTransition(withUnstakeTimer);

  useSyncEffect(() => {
    if (renderedTransaction) {
      setDecryptedComment(undefined);
    }
  }, [renderedTransaction]);

  useSyncEffect(() => {
    if (endOfStakingCycle) {
      setUnstakeDate(endOfStakingCycle);
    }
  }, [endOfStakingCycle]);

  const openPasswordSlide = useLastCallback(() => {
    setCurrentSlide(SLIDES.password);
    setNextKey(undefined);
  });

  const closePasswordSlide = useLastCallback(() => {
    setCurrentSlide(SLIDES.initial);
    setNextKey(SLIDES.password);
  });

  const handleSendClick = useLastCallback(() => {
    closeActivityInfo({ id: id! });
    startTransfer({
      isPortrait,
      tokenSlug: slug || TON_TOKEN_SLUG,
      toAddress: address,
      amount: Math.abs(amountHuman),
      comment: !isIncoming ? comment : undefined,
    });
  });

  const handleStartStakingClick = useLastCallback(() => {
    closeActivityInfo({ id: id! });
    startStaking();
  });

  const handlePasswordSubmit = useLastCallback(async (password: string) => {
    setIsLoading(true);
    const result = await callApi(
      'decryptComment',
      getGlobal().currentAccountId!,
      encryptedComment!,
      fromAddress!,
      password,
    );
    setIsLoading(false);

    if (!result) {
      setPasswordError('Wrong password, please try again.');
      return;
    }

    if (IS_CAPACITOR) {
      setIsPinAccepted();
      await vibrateOnSuccess(true);
    }

    closePasswordSlide();
    setDecryptedComment(result);
  });

  const handleClose = useLastCallback(() => {
    closeActivityInfo({ id: id! });
    if (IS_CAPACITOR) {
      clearIsPinAccepted();
    }
  });

  const clearPasswordError = useLastCallback(() => {
    setPasswordError(undefined);
  });

  function renderHeader() {
    const isLocal = id && getIsTxIdLocal(id);

    const title = isIncoming
      ? lang('Received')
      : isLocal
        ? lang('Sending')
        : lang('Sent');

    return (
      <div
        className={buildClassName(
          modalStyles.header,
          modalStyles.header_wideContent,
        )}
      >
        <div className={modalStyles.title}>
          <div className={styles.headerTitle}>
            {title}
            {isLocal && (
              <i
                className={buildClassName(styles.clockIcon, 'icon-clock')}
                title={lang('Transaction in progress')}
                aria-hidden
              />
            )}
            {isScam && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
          </div>
          {!!timestamp && (
            <div className={styles.headerDate}>
              {formatFullDay(lang.code!, timestamp)}, {formatTime(timestamp)}
            </div>
          )}
        </div>
        <Button
          isRound
          className={modalStyles.closeButton}
          ariaLabel={lang('Close')}
          onClick={handleClose}
        >
          <i className={buildClassName(modalStyles.closeIcon, 'icon-close')} aria-hidden />
        </Button>
      </div>
    );
  }

  function renderFee() {
    if (isIncoming || !fee) {
      return undefined;
    }

    return (
      <AmountWithFeeTextField
        label={lang('Fee')}
        amount={bigStrToHuman(fee)}
        currency={TON_SYMBOL}
      />
    );
  }

  function renderComment() {
    if ((!comment && !encryptedComment) || transaction?.type) {
      return undefined;
    }

    const spoiler = encryptedComment
      ? lang('Message is encrypted.')
      : isScam
        ? lang('Scam comment is hidden.')
        : undefined;

    return (
      <>
        <div className={transferStyles.label}>{lang('Comment')}</div>
        <InteractiveTextField
          text={encryptedComment ? decryptedComment : comment}
          spoiler={spoiler}
          spoilerRevealText={encryptedComment ? lang('Decrypt') : lang('Display')}
          spoilerCallback={openPasswordSlide}
          copyNotification={lang('Comment was copied!')}
          className={styles.copyButtonWrapper}
          textClassName={styles.comment}
        />
      </>
    );
  }

  function renderUnstakeTimer() {
    return (
      <div className={buildClassName(styles.unstakeTime, unstakeTimerClassNames)}>
        <i className={buildClassName(styles.unstakeTimeIcon, 'icon-clock')} aria-hidden />
        {lang('$unstaking_when_receive', {
          time: <strong>{formatRelativeHumanDateTime(lang.code, unstakeDate)}</strong>,
        })}
      </div>
    );
  }

  function renderTransactionContent() {
    return (
      <>
        <TransactionAmount
          isIncoming={isIncoming}
          isScam={isScam}
          amount={amountHuman}
          tokenSymbol={token?.symbol}
        />

        <div className={transferStyles.label}>{lang(isIncoming ? 'Sender' : 'Recipient')}</div>
        <InteractiveTextField
          addressName={addressName}
          address={address!}
          copyNotification={lang('Address was copied!')}
          className={styles.copyButtonWrapper}
          textClassName={isScam ? styles.scamAddress : undefined}
        />

        {renderFee()}
        {renderComment()}
        {isStaking && isIncoming && !shouldRenderUnstakeTimer && (
          <div className={styles.unstakeNotice}>{lang('Unstaked successfully')}</div>
        )}
        {shouldRenderUnstakeTimer && renderUnstakeTimer()}

        <div className={styles.footer}>
          {!isStaking && (
            <Button onClick={handleSendClick} className={styles.button}>
              {lang(isIncoming ? 'Send Back' : 'Repeat')}
            </Button>
          )}
          {isStaking && (
            <Button onClick={handleStartStakingClick} className={styles.button}>
              {lang('Stake Again')}
            </Button>
          )}
        </div>
      </>
    );
  }

  // eslint-disable-next-line consistent-return
  function renderContent(isActive: boolean, isFrom: boolean, currentKey: number) {
    switch (currentKey) {
      case SLIDES.initial:
        return (
          <>
            {renderHeader()}
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
              {renderTransactionContent()}
            </div>
          </>
        );
      case SLIDES.password:
        if (!encryptedComment) return undefined;

        return (
          <>
            {!IS_CAPACITOR && <ModalHeader title={lang('Enter Password')} onClose={handleClose} />}
            <PasswordForm
              isActive={isActive}
              isLoading={isLoading}
              submitLabel={lang('Send')}
              placeholder={lang('Enter your password')}
              error={passwordError}
              withCloseButton={IS_CAPACITOR}
              containerClassName={styles.passwordFormContent}
              onSubmit={handlePasswordSubmit}
              onCancel={closePasswordSlide}
              onUpdate={clearPasswordError}
            />
          </>
        );
    }
  }

  return (
    <Modal
      isOpen={Boolean(transaction)}
      hasCloseButton
      nativeBottomSheetKey="transaction-info"
      forceFullNative={currentSlide === SLIDES.password}
      dialogClassName={styles.modalDialog}
      onClose={handleClose}
    >
      <Transition
        name={resolveModalTransitionName()}
        className={buildClassName(modalStyles.transition, 'custom-scroll')}
        slideClassName={modalStyles.transitionSlide}
        activeKey={currentSlide}
        nextKey={nextKey}
      >
        {renderContent}
      </Transition>
    </Modal>
  );
}

export default memo(
  withGlobal((global): StateProps => {
    const accountState = selectCurrentAccountState(global);

    const txId = accountState?.currentActivityId;
    const activity = txId ? accountState?.activities?.byId[txId] : undefined;
    const {
      start: startOfStakingCycle,
      end: endOfStakingCycle,
    } = accountState?.staking || {};
    const savedAddresses = accountState?.savedAddresses;

    return {
      transaction: activity?.kind === 'transaction' ? activity : undefined,
      tokensBySlug: global.tokenInfo?.bySlug,
      savedAddresses,
      isTestnet: global.settings.isTestnet,
      startOfStakingCycle,
      endOfStakingCycle,
      isUnstakeRequested: accountState?.staking?.isUnstakeRequested,
      isLongUnstakeRequested: accountState?.isLongUnstakeRequested,
    };
  })(TransactionModal),
);
