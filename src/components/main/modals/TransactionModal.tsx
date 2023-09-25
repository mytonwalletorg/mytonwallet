import React, { memo, useState } from '../../../lib/teact/teact';

import type { ApiToken, ApiTransaction } from '../../../api/types';

import {
  ANIMATION_END_DELAY, ANIMATION_LEVEL_MIN,
  STAKING_CYCLE_DURATION_MS,
  TON_SYMBOL,
  TON_TOKEN_SLUG,
  TONSCAN_BASE_MAINNET_URL,
  TONSCAN_BASE_TESTNET_URL,
} from '../../../config';
import { getActions, getGlobal, withGlobal } from '../../../global';
import { bigStrToHuman, getIsTxIdLocal } from '../../../global/helpers';
import { selectCurrentAccountState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { formatFullDay, formatRelativeHumanDateTime, formatTime } from '../../../util/dateFormat';
import { callApi } from '../../../api';

import { useDeviceScreen } from '../../../hooks/useDeviceScreen';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import usePrevDuringAnimation from '../../../hooks/usePrevDuringAnimation';
import useShowTransition from '../../../hooks/useShowTransition';
import useSyncEffect from '../../../hooks/useSyncEffect';

import TransactionAmount from '../../common/TransactionAmount';
import AmountWithFeeTextField from '../../ui/AmountWithFeeTextField';
import Button from '../../ui/Button';
import InteractiveTextField from '../../ui/InteractiveTextField';
import Modal, { ANIMATION_DURATION, ANIMATION_DURATION_PORTRAIT } from '../../ui/Modal';
import PasswordForm from '../../ui/PasswordForm';

import transferStyles from '../../transfer/Transfer.module.scss';
import modalStyles from '../../ui/Modal.module.scss';
import styles from './TransactionModal.module.scss';

import scamImg from '../../../assets/scam.svg';

type StateProps = {
  transaction?: ApiTransaction;
  tokensBySlug?: Record<string, ApiToken>;
  savedAddresses?: Record<string, string>;
  isTestnet?: boolean;
  startOfStakingCycle?: number;
  endOfStakingCycle?: number;
};

const EMPTY_HASH_VALUE = 'NOHASH';

function TransactionModal({
  transaction,
  tokensBySlug,
  savedAddresses,
  isTestnet,
  startOfStakingCycle,
  endOfStakingCycle,
}: StateProps) {
  const {
    startTransfer,
    startStaking,
    closeTransactionInfo,
  } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();
  const animationLevel = getGlobal().settings.animationLevel;
  const animationDuration = animationLevel === ANIMATION_LEVEL_MIN
    ? 0
    : (isPortrait ? ANIMATION_DURATION_PORTRAIT : ANIMATION_DURATION) + ANIMATION_END_DELAY;
  const renderedTransaction = usePrevDuringAnimation(transaction, animationDuration);
  const [unstakeDate, setUnstakeDate] = useState<number>(Date.now() + STAKING_CYCLE_DURATION_MS);

  const {
    fromAddress,
    toAddress,
    amount,
    comment,
    encryptedComment,
    fee,
    txId,
    isIncoming,
    slug,
    timestamp,
  } = renderedTransaction || {};
  const [, transactionHash] = (txId || '').split(':');
  const isStaking = Boolean(transaction?.type);

  const token = slug ? tokensBySlug?.[slug] : undefined;
  const amountHuman = amount ? bigStrToHuman(amount, token?.decimals) : 0;
  const address = isIncoming ? fromAddress : toAddress;
  const addressName = (address && savedAddresses?.[address]) || transaction?.metadata?.name;
  const isScam = Boolean(transaction?.metadata?.isScam);

  const [decryptedComment, setDecryptedComment] = useState<string>();
  const [isPasswordModalOpen, openPasswordModal, closePasswordModal] = useFlag();
  const [passwordError, setPasswordError] = useState<string>();

  const tonscanBaseUrl = isTestnet ? TONSCAN_BASE_TESTNET_URL : TONSCAN_BASE_MAINNET_URL;
  const tonscanTransactionUrl = transactionHash && transactionHash !== EMPTY_HASH_VALUE
    ? `${tonscanBaseUrl}tx/${transactionHash}`
    : undefined;

  const withUnstakeTimer = Boolean(
    transaction?.type === 'unstakeRequest' && startOfStakingCycle && transaction.timestamp >= startOfStakingCycle,
  );

  const {
    shouldRender: shouldRenderUnstakeTimer,
    transitionClassNames: unstakeTimerClassNames,
  } = useShowTransition(withUnstakeTimer);

  useSyncEffect(() => {
    if (renderedTransaction) {
      setDecryptedComment(undefined);
    } else {
      closeTransactionInfo();
    }
  }, [renderedTransaction]);

  useSyncEffect(() => {
    if (endOfStakingCycle) {
      setUnstakeDate(endOfStakingCycle);
    }
  }, [endOfStakingCycle]);

  const handleSendClick = useLastCallback(() => {
    closeTransactionInfo();
    startTransfer({
      tokenSlug: slug || TON_TOKEN_SLUG,
      toAddress: address,
      amount: Math.abs(amountHuman),
      comment: !isIncoming ? comment : undefined,
    });
  });

  const handleStartStakingClick = useLastCallback(() => {
    closeTransactionInfo();
    startStaking();
  });

  const handlePasswordSubmit = useLastCallback(async (password: string) => {
    const result = await callApi(
      'decryptComment',
      getGlobal().currentAccountId!,
      encryptedComment!,
      fromAddress!,
      password,
    );

    if (!result) {
      setPasswordError('Wrong password, please try again');
      return;
    }

    closePasswordModal();
    setDecryptedComment(result);
  });

  const clearPasswordError = useLastCallback(() => {
    setPasswordError(undefined);
  });

  function renderHeader() {
    const isLocal = txId && getIsTxIdLocal(txId);
    const plainTitle = isIncoming
      ? lang('Received')
      : isLocal
        ? lang('Sending')
        : lang('Sent');
    const title = plainTitle;

    return (
      <div className={styles.transactionHeader}>
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
          spoilerCallback={openPasswordModal}
          copyNotification={lang('Comment was copied!')}
          className={styles.copyButtonWrapper}
          textClassName={styles.comment}
        />
        {encryptedComment && (
          <Modal
            isCompact
            isOpen={isPasswordModalOpen}
            onClose={closePasswordModal}
            title={lang('Enter Password')}
            contentClassName={styles.passwordModal}
          >
            <PasswordForm
              isActive={isPasswordModalOpen}
              submitLabel={lang('Send')}
              placeholder={lang('Enter your password')}
              error={passwordError}
              containerClassName={styles.passwordFormContent}
              onSubmit={handlePasswordSubmit}
              onCancel={closePasswordModal}
              onUpdate={clearPasswordError}
            />
          </Modal>
        )}
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

  function renderPlainTransaction() {
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

  function renderTransactionContent() {
    return renderPlainTransaction();
  }

  return (
    <Modal
      hasCloseButton
      title={renderHeader()}
      isOpen={Boolean(transaction)}
      onClose={closeTransactionInfo}
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
        {renderTransactionContent()}
      </div>
    </Modal>
  );
}

export default memo(
  withGlobal((global): StateProps => {
    const accountState = selectCurrentAccountState(global);

    const txId = accountState?.currentTransactionId;
    const transaction = txId ? accountState?.transactions?.byTxId[txId] : undefined;
    const { startOfCycle: startOfStakingCycle, endOfCycle: endOfStakingCycle } = accountState?.poolState || {};
    const savedAddresses = accountState?.savedAddresses;

    return {
      transaction,
      tokensBySlug: global.tokenInfo?.bySlug,
      savedAddresses,
      isTestnet: global.settings.isTestnet,
      startOfStakingCycle,
      endOfStakingCycle,
    };
  })(TransactionModal),
);
