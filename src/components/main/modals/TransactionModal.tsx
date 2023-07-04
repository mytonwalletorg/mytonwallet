import React, { memo, useCallback, useState } from '../../../lib/teact/teact';

import type { ApiToken, ApiTransaction } from '../../../api/types';

import {
  CARD_SECONDARY_VALUE_SYMBOL,
  STAKING_CYCLE_DURATION_MS,
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

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';
import useSyncEffect from '../../../hooks/useSyncEffect';

import TransactionAmount from '../../common/TransactionAmount';
import AmountWithFeeTextField from '../../ui/AmountWithFeeTextField';
import Button from '../../ui/Button';
import InteractiveTextField from '../../ui/InteractiveTextField';
import Modal from '../../ui/Modal';
import PasswordForm from '../../ui/PasswordForm';

import transferStyles from '../../transfer/Transfer.module.scss';
import modalStyles from '../../ui/Modal.module.scss';
import styles from './TransactionModal.module.scss';

import scamImg from '../../../assets/scam.svg';

type StateProps = {
  transaction?: ApiTransaction;
  token?: ApiToken;
  savedAddresses?: Record<string, string>;
  isTestnet?: boolean;
  startOfStakingCycle?: number;
  endOfStakingCycle?: number;
};

const EMPTY_HASH_VALUE = 'NOHASH';

function TransactionModal({
  transaction,
  token,
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
  const renderedTransaction = useCurrentOrPrev(transaction, true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
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
    if (transaction) {
      setIsModalOpen(true);
      setDecryptedComment(undefined);
    }
  }, [transaction]);

  useSyncEffect(() => {
    if (endOfStakingCycle) {
      setUnstakeDate(endOfStakingCycle);
    }
  }, [endOfStakingCycle]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleSendClick = useCallback(() => {
    handleCloseModal();
    startTransfer({
      tokenSlug: slug || TON_TOKEN_SLUG,
      toAddress: address,
      amount: Math.abs(amountHuman),
      comment: !isIncoming ? comment : undefined,
    });
  }, [handleCloseModal, startTransfer, slug, address, amountHuman, isIncoming, comment]);

  const handleStartStakingClick = useCallback(() => {
    handleCloseModal();
    startStaking();
  }, [handleCloseModal, startStaking]);

  function renderHeader() {
    const isLocal = txId && getIsTxIdLocal(txId);

    return (
      <>
        {timestamp ? `${formatFullDay(lang.code!, timestamp)}, ${formatTime(timestamp)}` : lang('Transaction Info')}
        {isLocal && (
          <i className={buildClassName(styles.clockIcon, 'icon-clock')} title={lang('Transaction in progress')} />
        )}
        {isScam && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
      </>
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
        currency={CARD_SECONDARY_VALUE_SYMBOL}
      />
    );
  }

  const spoilerCallback = useLastCallback(() => {
    openPasswordModal();
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

  const handlePasswordUpdate = useLastCallback(() => {
    setPasswordError(undefined);
  });

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
          spoilerCallback={spoilerCallback}
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
              onSubmit={handlePasswordSubmit}
              onCancel={closePasswordModal}
              onUpdate={handlePasswordUpdate}
            />
          </Modal>
        )}
      </>
    );
  }

  function renderUnstakeTimer() {
    return (
      <div className={buildClassName(styles.unstakeTime, unstakeTimerClassNames)}>
        <i className={buildClassName(styles.unstakeTimeIcon, 'icon-clock')} />
        {lang('$unstaking_when_receive', {
          time: <strong>{formatRelativeHumanDateTime(lang.code, unstakeDate)}</strong>,
        })}
      </div>
    );
  }

  return (
    <Modal
      isSlideUp
      hasCloseButton
      title={renderHeader()}
      isOpen={isModalOpen}
      onClose={handleCloseModal}
      onCloseAnimationEnd={closeTransactionInfo}
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
      </div>
    </Modal>
  );
}

export default memo(
  withGlobal((global): StateProps => {
    const accountState = selectCurrentAccountState(global);

    const txId = accountState?.currentTransactionId;
    const transaction = txId ? accountState?.transactions?.byTxId[txId] : undefined;
    const token = transaction?.slug ? global.tokenInfo?.bySlug[transaction.slug] : undefined;
    const { startOfCycle: startOfStakingCycle, endOfCycle: endOfStakingCycle } = accountState?.poolState || {};
    const savedAddresses = accountState?.savedAddresses;

    return {
      transaction,
      token,
      savedAddresses,
      isTestnet: global.settings.isTestnet,
      startOfStakingCycle,
      endOfStakingCycle,
    };
  })(TransactionModal),
);
