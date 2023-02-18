import React, {
  memo, useMemo,
} from '../../lib/teact/teact';
import { withGlobal, getActions } from '../../global';

import type { UserToken, Account } from '../../global/types';
import type { ApiDapp, ApiDappTransaction } from '../../api/types';

import buildClassName from '../../util/buildClassName';
import { selectNetworkAccounts } from '../../global/selectors';
import { bigStrToHuman } from '../../global/helpers';
import { formatCurrency } from '../../util/formatNumber';
import { shortenAddress } from '../../util/shortenAddress';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';

import DappInfo from './DappInfo';
import DappTransaction from './DappTransaction';
import AmountWithFeeTextField from '../ui/AmountWithFeeTextField';
import Button from '../ui/Button';

import styles from './Dapp.module.scss';
import modalStyles from '../ui/Modal.module.scss';

interface OwnProps {
  tonToken: UserToken;
}

interface StateProps {
  currentAccount?: Account;
  transactions?: ApiDappTransaction[];
  fee?: string;
  dapp?: ApiDapp;
  isLoading?: boolean;
}

const FRACTION_DIGITS = 2;

function DappTransferInitial({
  tonToken,
  currentAccount,
  transactions,
  fee,
  dapp,
  isLoading,
}: OwnProps & StateProps) {
  const { showDappTransaction, submitDappTransfer, cancelDappTransfer } = getActions();

  const lang = useLang();
  const isSingleTransaction = transactions?.length === 1;
  const renderingTransactions = useCurrentOrPrev(transactions, true);

  const totalAmount = useMemo(() => {
    return renderingTransactions?.reduce((acc, { amount }) => {
      return acc + bigStrToHuman(amount, tonToken.decimals);
    }, fee ? bigStrToHuman(fee, tonToken.decimals) : 0) || 0;
  }, [renderingTransactions, fee, tonToken.decimals]);

  function renderDapp() {
    return (
      <div className={styles.transactionDirection}>
        <div className={styles.transactionAccount}>
          <div className={styles.accountTitle}>{currentAccount?.title}</div>
          <div className={styles.accountBalance}>{formatCurrency(tonToken.amount, tonToken.symbol)}</div>
        </div>

        <DappInfo
          iconUrl={dapp?.iconUrl}
          name={dapp?.name}
          url={dapp?.url}
          className={styles.transactionDapp}
        />
      </div>
    );
  }

  function renderTransaction() {
    return (
      <DappTransaction
        transaction={renderingTransactions![0]}
        tonToken={tonToken}
        fee={fee}
      />
    );
  }

  function renderTransactionRow(transaction: ApiDappTransaction, i: number) {
    return (
      <div
        key={`${transaction.toAddress}_${transaction.amount}`}
        className={styles.transactionRow}
        onClick={() => { showDappTransaction({ transactionIdx: i }); }}
      >
        <span className={styles.transactionRowAmount}>
          {formatCurrency(bigStrToHuman(transaction.amount, tonToken.decimals), tonToken.symbol, FRACTION_DIGITS)}
        </span>
        {' '}
        <span className={styles.transactionRowAddress}>
          {lang('$transaction_to', {
            address: shortenAddress(transaction.toAddress),
          })}
        </span>
        <i className={buildClassName(styles.transactionRowChevron, 'icon-chevron-right')} aria-hidden />
      </div>
    );
  }

  function renderTransactions() {
    return (
      <>
        <p className={styles.label}>{lang('$many_transactions', renderingTransactions?.length, 'i')}</p>
        <div className={styles.transactionList}>
          {renderingTransactions?.map(renderTransactionRow)}
        </div>
        <AmountWithFeeTextField
          label={lang('Total Amount')}
          amount={totalAmount}
          symbol={tonToken.symbol}
        />
      </>
    );
  }

  if (!renderingTransactions) {
    return undefined;
  }

  return (
    <div className={modalStyles.transitionContent}>
      {renderDapp()}

      {isSingleTransaction ? renderTransaction() : renderTransactions()}

      <div className={modalStyles.buttons}>
        <Button onClick={cancelDappTransfer}>{lang('Cancel')}</Button>
        <Button
          isPrimary
          isSubmit
          isLoading={isLoading}
          onClick={submitDappTransfer}
        >
          {lang('Send')}
        </Button>
      </div>
    </div>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const {
    transactions,
    fee,
    isLoading,
    dapp,
  } = global.currentDappTransfer;
  const accounts = selectNetworkAccounts(global);

  return {
    currentAccount: accounts?.[global.currentAccountId!],
    transactions,
    fee,
    dapp,
    isLoading,
  };
})(DappTransferInitial));
