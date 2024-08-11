import React, {
  memo,
  useMemo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiDapp, ApiDappTransfer } from '../../api/types';
import type { Account, UserToken } from '../../global/types';

import { SHORT_FRACTION_DIGITS } from '../../config';
import { Big } from '../../lib/big.js';
import { selectCurrentAccountTokens, selectNetworkAccounts } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import { shortenAddress } from '../../util/shortenAddress';

import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';

import NftInfo from '../transfer/NftInfo';
import Button from '../ui/Button';
import InteractiveTextField from '../ui/InteractiveTextField';
import DappInfo from './DappInfo';
import DappTransfer from './DappTransfer';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

import scamImg from '../../assets/scam.svg';

interface OwnProps {
  tonToken: UserToken;
  onClose?: NoneToVoidFunction;
}

interface StateProps {
  currentAccount?: Account;
  transactions?: ApiDappTransfer[];
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
  onClose,
}: OwnProps & StateProps) {
  const { showDappTransfer, submitDappTransferConfirm } = getActions();

  const lang = useLang();
  const isSingleTransaction = transactions?.length === 1;
  const renderingTransactions = useCurrentOrPrev(transactions, true);
  const isNftTransfer = renderingTransactions?.[0].payload?.type === 'nft:transfer';
  const nft = isNftTransfer && 'nft' in renderingTransactions![0].payload!
    ? renderingTransactions[0].payload.nft
    : undefined;
  const hasScamAddresses = useMemo(() => {
    return renderingTransactions?.some(({ isScam }) => isScam);
  }, [renderingTransactions]);

  const totalAmountText = useMemo(() => {
    const feeDecimal = fee ? toDecimal(fee) : '0';
    let tonAmount = Big(feeDecimal);
    let cost = 0;

    const bySymbol: Record<string, Big> = (renderingTransactions ?? []).reduce((acc, transaction) => {
      const { payload, amount } = transaction;
      const amountDecimal = toDecimal(amount);

      tonAmount = tonAmount.plus(amountDecimal);
      cost += Number(amountDecimal) * tonToken.priceUsd ?? 0;

      if (payload?.type === 'tokens:transfer' || payload?.type === 'tokens:transfer-non-standard') {
        const { slug: tokenSlug, amount: tokenAmount } = payload;

        const token = tokens?.find(({ slug }) => tokenSlug === slug);
        if (token) {
          const { decimals, symbol, priceUsd } = token;
          const tokenAmountDecimal = toDecimal(tokenAmount, decimals);

          acc[symbol] = (acc[symbol] ?? Big(0)).plus(tokenAmountDecimal);
          cost += Number(tokenAmountDecimal) * priceUsd;
        }
      }

      return acc;
    }, {} as Record<string, Big>);

    const text = Object.entries(bySymbol).reduce((acc, [symbol, amountBig]) => {
      return `${acc} + ${formatCurrency(amountBig.toString(), symbol, SHORT_FRACTION_DIGITS)}`;
    }, formatCurrency(tonAmount.toString(), tonToken.symbol, SHORT_FRACTION_DIGITS));

    return `${text} (${formatCurrency(cost, '$')})`;
  }, [renderingTransactions, fee, tokens, tonToken]);

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
      <DappTransfer
        transaction={renderingTransactions![0]}
        tonToken={tonToken}
        fee={fee}
        tokens={tokens}
      />
    );
  }

  function renderTransactionRow(transaction: ApiDappTransfer, i: number) {
    const { payload } = transaction;

    let extraText: string = '';
    if (payload?.type === 'nft:transfer') {
      extraText = '1 NFT + ';
    } else if (payload?.type === 'tokens:transfer' || payload?.type === 'tokens:transfer-non-standard') {
      const { slug: tokenSlug, amount } = payload;
      const token = tokens?.find(({ slug }) => tokenSlug === slug);
      if (token) {
        const { decimals, symbol } = token;
        extraText = `${formatCurrency(toDecimal(amount, decimals), symbol, SHORT_FRACTION_DIGITS)} + `;
      }
    }

    return (
      <div
        key={`${transaction.toAddress}_${transaction.amount}_${i}`}
        className={styles.transactionRow}
        onClick={() => { showDappTransfer({ transactionIdx: i }); }}
      >
        {transaction.isScam && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
        <span className={buildClassName(styles.transactionRowAmount, transaction.isScam && styles.scam)}>
          {extraText}
          {formatCurrency(toDecimal(transaction.amount), tonToken.symbol, SHORT_FRACTION_DIGITS)}
        </span>
        {' '}
        <span className={buildClassName(styles.transactionRowAddress, transaction.isScam && styles.scam)}>
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
        <span className={styles.label}>
          {lang('Total Amount')}
        </span>
        <InteractiveTextField text={totalAmountText} />
      </>
    );
  }

  if (!renderingTransactions) {
    return undefined;
  }

  return (
    <div className={modalStyles.transitionContent}>
      {renderDapp()}

      {isNftTransfer && <NftInfo nft={nft} /> }

      <div className={styles.contentWithBackground}>
        {isSingleTransaction ? renderTransaction() : renderTransactions()}
      </div>

      <div className={modalStyles.buttons}>
        <Button className={modalStyles.button} onClick={onClose}>{lang('Cancel')}</Button>
        <Button
          isPrimary
          isSubmit
          isLoading={isLoading}
          isDisabled={hasScamAddresses}
          className={modalStyles.button}
          onClick={!hasScamAddresses ? submitDappTransferConfirm : undefined}
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
