import React, { memo, useCallback, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiToken, ApiTransaction } from '../../../api/types';

import {
  CARD_SECONDARY_VALUE_SYMBOL,
  STAKING_CYCLE_DURATION_MS,
  TON_TOKEN_SLUG,
  TONSCAN_BASE_MAINNET_URL,
  TONSCAN_BASE_TESTNET_URL,
} from '../../../config';
import { selectCurrentAccountState } from '../../../global/selectors';
import { bigStrToHuman, getIsTxIdLocal } from '../../../global/helpers';
import { formatCurrencyExtended } from '../../../util/formatNumber';
import buildClassName from '../../../util/buildClassName';
import { formatFullDay, formatRelativeHumanDateTime, formatTime } from '../../../util/dateFormat';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useOnChange from '../../../hooks/useOnChange';
import useLang from '../../../hooks/useLang';

import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import TransactionAmount from '../../common/TransactionAmount';
import InteractiveTextValue from '../../ui/InteractiveTextValue';

import transferStyles from '../../transfer/Transfer.module.scss';
import modalStyles from '../../ui/Modal.module.scss';
import styles from './TransactionModal.module.scss';
import useShowTransition from '../../../hooks/useShowTransition';

type StateProps = {
  transaction?: ApiTransaction;
  token?: ApiToken;
  isTestnet?: boolean;
  startOfStakingCycle?: number;
  endOfStakingCycle?: number;
};

const EMPTY_HASH_VALUE = 'NOHASH';

function TransactionModal({
  transaction,
  token,
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
    fromAddress, toAddress, amount, comment, fee, txId, isIncoming, slug, timestamp,
  } = renderedTransaction || {};
  const [, transactionHash] = (txId || '').split(':');
  const isStaking = Boolean(transaction?.type);

  const amountHuman = amount ? bigStrToHuman(amount, token?.decimals) : 0;
  const address = isIncoming ? fromAddress : toAddress;

  const tonscanBaseUrl = isTestnet ? TONSCAN_BASE_TESTNET_URL : TONSCAN_BASE_MAINNET_URL;
  const tonscanTransactionUrl = transactionHash && transactionHash !== EMPTY_HASH_VALUE
    ? `${tonscanBaseUrl}tx/${transactionHash}`
    : undefined;

  const withUnstakeTimer = Boolean(
    transaction?.type === 'unstakeRequest' && startOfStakingCycle
    && (transaction.timestamp >= startOfStakingCycle),
  );
  const {
    shouldRender: shouldRenderUnstakeTimer,
    transitionClassNames: unstakeTimerClassNames,
  } = useShowTransition(withUnstakeTimer);

  useOnChange(() => {
    if (transaction) {
      setIsModalOpen(true);
    }
  }, [transaction]);

  useOnChange(() => {
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
          <i
            className={buildClassName(styles.clockIcon, 'icon-clock')}
            title={lang('Transaction in progress')}
          />
        )}
      </>
    );
  }

  function renderFee() {
    if (isIncoming || !fee) {
      return undefined;
    }

    return (
      <>
        <div className={transferStyles.label}>{lang('Fee')}</div>
        <div className={transferStyles.inputReadOnly}>
          {formatCurrencyExtended(bigStrToHuman(fee), CARD_SECONDARY_VALUE_SYMBOL, true)}
        </div>
      </>
    );
  }

  function renderComment() {
    if (!comment || transaction?.type) {
      return undefined;
    }

    return (
      <>
        <div className={transferStyles.label}>Comment</div>
        <InteractiveTextValue
          text={comment}
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
        <TransactionAmount isIncoming={isIncoming} amount={amountHuman} tokenSymbol={token?.symbol} />

        <div className={transferStyles.label}>{lang(isIncoming ? 'Sender' : 'Recipient')}</div>
        <InteractiveTextValue
          address={address!}
          copyNotification={lang('Address was copied!')}
          className={styles.copyButtonWrapper}
        />

        {renderFee()}
        {renderComment()}
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

export default memo(withGlobal(
  (global): StateProps => {
    const accountState = selectCurrentAccountState(global);

    const txId = accountState?.currentTransactionId;
    const transaction = txId ? accountState?.transactions?.byTxId[txId] : undefined;
    const token = transaction?.slug ? global.tokenInfo?.bySlug[transaction.slug] : undefined;
    const { startOfCycle: startOfStakingCycle, endOfCycle: endOfStakingCycle } = accountState?.poolState || {};

    return {
      transaction,
      token,
      isTestnet: global.settings.isTestnet,
      startOfStakingCycle,
      endOfStakingCycle,
    };
  },
)(TransactionModal));
