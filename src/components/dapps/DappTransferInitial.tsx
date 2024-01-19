import React, {
  memo,
  useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiDapp, ApiDappTransaction } from '../../api/types';
import type { Account, UserToken } from '../../global/types';

import { SHORT_FRACTION_DIGITS } from '../../config';
import { selectCurrentAccountTokens, selectNetworkAccounts } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import { shortenAddress } from '../../util/shortenAddress';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';

import AmountWithFeeTextField from '../ui/AmountWithFeeTextField';
import Button from '../ui/Button';
import DappInfo from './DappInfo';
import DappTransaction from './DappTransaction';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

interface OwnProps {
  tonToken: UserToken;
}

interface StateProps {
  currentAccount?: Account;
  transactions?: ApiDappTransaction[];
  fee?: bigint;
  dapp?: ApiDapp;
  isLoading?: boolean;
  tokens?: UserToken[];
}

function DappTransferInitial({
  tonToken,
  currentAccount,
  transactions,
  fee,
  dapp,
  isLoading,
  tokens,
}: OwnProps & StateProps) {
  const { showDappTransaction, submitDappTransferConfirm, cancelDappTransfer } = getActions();

  const lang = useLang();
  const isSingleTransaction = transactions?.length === 1;
  const renderingTransactions = useCurrentOrPrev(transactions, true);

  const totalAmount = useMemo(() => {
    return renderingTransactions?.reduce((acc, { amount }) => {
      return acc + amount;
    }, fee ?? 0n) || 0n;
  }, [renderingTransactions, fee]);

  function renderDapp() {
    return (
      <div className={styles.transactionDirection}>
        <div className={styles.transactionAccount}>
          <div className={styles.accountTitle}>{currentAccount?.title}</div>
          <div className={styles.accountBalance}>{formatCurrency(toDecimal(tonToken.amount), tonToken.symbol)}</div>
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
        tokens={tokens}
      />
    );
  }

  function renderTransactionRow(transaction: ApiDappTransaction, i: number) {
    const { payload } = transaction;

    let extraText: string = '';
    if (payload?.type === 'nft:transfer') {
      extraText = '1 NFT + ';
    } else if (payload?.type === 'tokens:transfer') {
      const { slug, amount } = payload;
      const { decimals, symbol } = tokens!.find((token) => token.slug === slug)!;
      extraText = `${formatCurrency(toDecimal(amount, decimals), symbol, SHORT_FRACTION_DIGITS)} + `;
    }

    return (
      <div
        key={`${transaction.toAddress}_${transaction.amount}`}
        className={styles.transactionRow}
        onClick={() => { showDappTransaction({ transactionIdx: i }); }}
      >
        <span className={styles.transactionRowAmount}>
          {extraText}
          {formatCurrency(toDecimal(transaction.amount), tonToken.symbol, SHORT_FRACTION_DIGITS)}
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
          amount={toDecimal(totalAmount)}
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
        <Button className={modalStyles.button} onClick={cancelDappTransfer}>{lang('Cancel')}</Button>
        <Button
          isPrimary
          isSubmit
          isLoading={isLoading}
          className={modalStyles.button}
          onClick={submitDappTransferConfirm}
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
    tokens: selectCurrentAccountTokens(global),
  };
})(DappTransferInitial));
