import React, { memo } from '../../lib/teact/teact';
import { getActions } from '../../global';

import { TON_TOKEN_SLUG } from '../../config';

import { useDeviceScreen } from '../../hooks/useDeviceScreen';
import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import TransferResult from '../common/TransferResult';
import Button from '../ui/Button';
import ModalHeader from '../ui/ModalHeader';

import modalStyles from '../ui/Modal.module.scss';

interface OwnProps {
  isActive?: boolean;
  amount?: bigint;
  symbol: string;
  balance?: bigint;
  fee?: bigint;
  operationAmount?: bigint;
  txId?: string;
  tokenSlug?: string;
  toAddress?: string;
  comment?: string;
  decimals?: number;
  onInfoClick: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
}

const AMOUNT_PRECISION = 4;

function TransferComplete({
  isActive,
  amount,
  symbol,
  balance,
  fee,
  operationAmount,
  txId,
  tokenSlug,
  toAddress,
  comment,
  decimals,
  onInfoClick,
  onClose,
}: OwnProps) {
  const { startTransfer } = getActions();

  const lang = useLang();
  const { isPortrait } = useDeviceScreen();

  useHistoryBack({
    isActive,
    onBack: onClose,
  });

  const handleTransactionRepeatClick = useLastCallback(() => {
    startTransfer({
      isPortrait,
      tokenSlug: tokenSlug || TON_TOKEN_SLUG,
      toAddress,
      amount,
      comment,
    });
  });

  return (
    <>
      <ModalHeader title={lang('Coins have been sent!')} onClose={onClose} />

      <div className={modalStyles.transitionContent}>
        <TransferResult
          playAnimation={isActive}
          amount={amount ? -amount : undefined}
          tokenSymbol={symbol}
          precision={AMOUNT_PRECISION}
          balance={balance}
          fee={fee ?? 0n}
          operationAmount={operationAmount ? -operationAmount : undefined}
          firstButtonText={txId ? lang('Details') : undefined}
          secondButtonText={lang('Repeat')}
          onFirstButtonClick={onInfoClick}
          onSecondButtonClick={handleTransactionRepeatClick}
          decimals={decimals}
        />

        <div className={modalStyles.buttons}>
          <Button onClick={onClose} isPrimary>{lang('Close')}</Button>
        </div>
      </div>
    </>
  );
}

export default memo(TransferComplete);
