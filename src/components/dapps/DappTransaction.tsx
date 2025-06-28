import React, { memo, useMemo } from '../../lib/teact/teact';

import type { ApiDappTransfer, ApiToken } from '../../api/types';

import { TONCOIN } from '../../config';
import buildClassName from '../../util/buildClassName';
import { isKeyCountGreater } from '../../util/isEmptyObject';
import { isNftTransferPayload, isTokenTransferPayload } from '../../util/ton/transfer';

import useHistoryBack from '../../hooks/useHistoryBack';
import useLang from '../../hooks/useLang';

import NftInfo from '../transfer/NftInfo';
import InteractiveTextField from '../ui/InteractiveTextField';
import ModalHeader from '../ui/ModalHeader';
import DappAmountField from './DappAmountField';
import DappTransactionPayload from './DappTransactionPayload';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface OwnProps {
  transaction?: ApiDappTransfer;
  tokensBySlug: Record<string, ApiToken>;
  isActive: boolean;
  onClose: NoneToVoidFunction;
  onBack: NoneToVoidFunction;
}

function DappTransaction({ transaction, tokensBySlug, isActive, onClose, onBack }: OwnProps) {
  const lang = useLang();

  useHistoryBack({ isActive, onBack });

  return (
    <>
      <ModalHeader
        title={lang('Transaction Info')}
        onBackButtonClick={onBack}
        onClose={onClose}
      />
      <div className={buildClassName(modalStyles.transitionContent, styles.transactionContent)}>
        {transaction && (
          <DappTransactionContent
            transaction={transaction}
            tokensBySlug={tokensBySlug}
          />
        )}
      </div>
    </>
  );
}

export default memo(DappTransaction);

function DappTransactionContent({
  transaction,
  tokensBySlug,
}: Required<Pick<OwnProps, 'transaction' | 'tokensBySlug'>>) {
  const lang = useLang();
  const tonAmountBySlug = useMemo(() => ({
    [TONCOIN.slug]: transaction.networkFee,
  }), [transaction]);

  function renderAmount() {
    if (isNftTransferPayload(transaction.payload)) {
      if (transaction.amount === 0n) {
        return undefined;
      }

      return (
        <DappAmountField
          label={lang('Additional Amount Sent')}
          amountsBySlug={tonAmountBySlug}
        />
      );
    }

    const amountBySlug: Record<string, bigint> = {};

    if (isTokenTransferPayload(transaction.payload)) {
      amountBySlug[transaction.payload.slug] = transaction.payload.amount;
    }
    amountBySlug[TONCOIN.slug] = transaction.amount;

    if (amountBySlug[TONCOIN.slug] === 0n && isKeyCountGreater(amountBySlug, 1)) {
      delete amountBySlug[TONCOIN.slug];
    }

    return <DappAmountField label={lang('Amount')} amountsBySlug={amountBySlug} />;
  }

  return (
    <>
      {isNftTransferPayload(transaction.payload) && <NftInfo nft={transaction.payload.nft} />}
      <p className={styles.label}>{lang('Receiving Address')}</p>
      <InteractiveTextField
        chain={TONCOIN.chain}
        address={transaction.displayedToAddress}
        isScam={transaction.isScam}
        className={buildClassName(styles.dataField, styles.receivingAddress)}
        copyNotification={lang('Address was copied!')}
      />
      {renderAmount()}
      <DappAmountField label={lang('Fee')} amountsBySlug={tonAmountBySlug} />
      <DappTransactionPayload transaction={transaction} tokensBySlug={tokensBySlug} />
    </>
  );
}
