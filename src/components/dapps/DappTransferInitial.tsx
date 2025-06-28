import React, { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiDapp,
  ApiDappTransfer,
  ApiEmulationResult,
  ApiNft,
  ApiStakingState,
  ApiSwapAsset,
  ApiTokenWithPrice,
} from '../../api/types';
import type { Account, SavedAddress, Theme } from '../../global/types';

import { TONCOIN } from '../../config';
import renderText from '../../global/helpers/renderText';
import {
  selectAccountStakingStatesBySlug,
  selectCurrentAccountState,
  selectCurrentDappTransferTotals,
  selectNetworkAccounts,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { toBig, toDecimal } from '../../util/decimals';
import { formatCurrency } from '../../util/formatNumber';
import isEmptyObject from '../../util/isEmptyObject';
import { shortenAddress } from '../../util/shortenAddress';
import { isNftTransferPayload, isTokenTransferPayload } from '../../util/ton/transfer';

import useAppTheme from '../../hooks/useAppTheme';
import useCurrentOrPrev from '../../hooks/useCurrentOrPrev';
import useLang from '../../hooks/useLang';

import Activity from '../main/sections/Content/Activity';
import Button from '../ui/Button';
import FeeLine from '../ui/FeeLine';
import IconWithTooltip from '../ui/IconWithTooltip';
import ModalHeader from '../ui/ModalHeader';
import Transition from '../ui/Transition';
import DappAmountField from './DappAmountField';
import DappInfoWithAccount from './DappInfoWithAccount';
import DappSkeletonWithContent, { type DappSkeletonRow } from './DappSkeletonWithContent';

import modalStyles from '../ui/Modal.module.scss';
import styles from './Dapp.module.scss';

import scamImg from '../../assets/scam.svg';

interface OwnProps {
  onClose?: NoneToVoidFunction;
}

interface StateProps {
  transactions?: ApiDappTransfer[];
  totalAmountsBySlug: Record<string, bigint>;
  emulation?: Pick<ApiEmulationResult, 'activities' | 'realFee'>;
  isScam: boolean;
  isDangerous: boolean;
  nftCount: number;
  dapp?: ApiDapp;
  isLoading?: boolean;
  tokensBySlug: Record<string, ApiTokenWithPrice>;
  swapTokensBySlug?: Record<string, ApiSwapAsset>;
  theme: Theme;
  nftsByAddress?: Record<string, ApiNft>;
  currentAccountId: string;
  stakingStateBySlug?: Record<string, ApiStakingState>;
  savedAddresses?: SavedAddress[];
  accounts?: Record<string, Account>;
}

interface SortedDappTransfer extends ApiDappTransfer {
  index: number;
  sortingCost: number;
}

const NFT_FAKE_COST_USD = 1_000_000_000;

const skeletonRows: DappSkeletonRow[] = [
  { isLarge: false, hasFee: false },
  { isLarge: true, hasFee: true },
];

function DappTransferInitial({
  transactions,
  totalAmountsBySlug,
  emulation,
  isScam,
  isDangerous,
  nftCount,
  dapp,
  isLoading,
  tokensBySlug,
  swapTokensBySlug,
  theme,
  nftsByAddress,
  currentAccountId,
  stakingStateBySlug,
  savedAddresses,
  accounts,
  onClose,
}: OwnProps & StateProps) {
  const { closeDappTransfer, showDappTransferTransaction, submitDappTransferConfirm } = getActions();

  const lang = useLang();
  const appTheme = useAppTheme(theme);
  const renderingTransactions = useCurrentOrPrev(transactions, true);
  const sortedTransactions = useMemo(
    () => sortTransactions(renderingTransactions, tokensBySlug),
    [renderingTransactions, tokensBySlug],
  );
  const isDappLoading = dapp === undefined;

  function renderContent() {
    return (
      <div className={buildClassName(modalStyles.transitionContent, styles.skeletonBackground)}>
        <DappInfoWithAccount dapp={dapp} />
        {isDangerous && (
          <div className={buildClassName(styles.transferWarning, styles.warningForPayload)}>
            {renderText(lang('$hardware_payload_warning'))}
          </div>
        )}
        {renderTransactions()}
        {renderEmulation()}

        <div className={buildClassName(modalStyles.buttons, styles.transferButtons)}>
          <Button className={modalStyles.button} onClick={onClose}>{lang('Cancel')}</Button>
          <Button
            isPrimary
            isSubmit
            isLoading={isLoading}
            isDisabled={isScam}
            className={modalStyles.button}
            onClick={!isScam ? submitDappTransferConfirm : undefined}
          >
            {lang('Send')}
          </Button>
        </div>
      </div>
    );
  }

  function renderTransactionRow(transaction: SortedDappTransfer) {
    const { payload } = transaction;

    const amountText: string[] = [];
    if (isNftTransferPayload(payload)) {
      amountText.push('1 NFT');
    } else if (isTokenTransferPayload(payload)) {
      const { slug: tokenSlug, amount } = payload;
      const token = tokensBySlug[tokenSlug];
      if (token) {
        const { decimals, symbol } = token;
        amountText.push(formatCurrency(toDecimal(amount, decimals), symbol));
      }
    }

    amountText.push(formatCurrency(toDecimal(transaction.amount + transaction.networkFee), TONCOIN.symbol));

    return (
      <div
        key={transaction.index}
        className={styles.transactionRow}
        onClick={() => showDappTransferTransaction({ transactionIdx: transaction.index })}
      >
        {transaction.isScam && <img src={scamImg} alt={lang('Scam')} className={styles.scamImage} />}
        <span className={buildClassName(styles.transactionRowAmount, transaction.isScam && styles.scam)}>
          {amountText.join(' + ')}
        </span>
        {' '}
        <span className={buildClassName(styles.transactionRowAddress, transaction.isScam && styles.scam)}>
          {lang('$transaction_to', {
            address: shortenAddress(transaction.displayedToAddress),
          })}
        </span>
        <i className={buildClassName(styles.transactionRowChevron, 'icon-chevron-right')} aria-hidden />
      </div>
    );
  }

  function renderTransactions() {
    if (!renderingTransactions) {
      return undefined;
    }

    const hasAmount = nftCount > 0 || !isEmptyObject(totalAmountsBySlug);

    return (
      <>
        <p className={styles.label}>{lang('$many_transactions', renderingTransactions.length, 'i')}</p>
        <div className={styles.transactionList}>
          {sortedTransactions?.map(renderTransactionRow)}
        </div>
        {renderingTransactions.length > 1 && hasAmount && (
          <DappAmountField label={lang('Total Amount')} amountsBySlug={totalAmountsBySlug} nftCount={nftCount} />
        )}
      </>
    );
  }

  function renderEmulation() {
    if (!emulation?.activities?.length) {
      return undefined;
    }

    const { activities, realFee } = emulation;

    return (
      <>
        <p className={styles.label}>
          {lang('Preview')}
          {' '}
          <IconWithTooltip message={renderText(lang('$preview_not_guaranteed'))} type="warning" size="small" />
        </p>
        <div className={buildClassName(styles.transactionList, styles.emulation)}>
          {activities.map((activity, index) => (
            <Activity
              key={activity.id}
              activity={activity}
              isFuture
              isLast={index === activities.length - 1}
              tokensBySlug={tokensBySlug}
              swapTokensBySlug={swapTokensBySlug}
              appTheme={appTheme}
              nftsByAddress={nftsByAddress}
              currentAccountId={currentAccountId}
              stakingStateBySlug={stakingStateBySlug}
              savedAddresses={savedAddresses}
              accounts={accounts}
            />
          ))}
        </div>
        {realFee !== 0n && (
          <FeeLine
            terms={{ native: realFee }}
            token={TONCOIN}
            precision="approximate"
            className={styles.emulationFee}
          />
        )}
      </>
    );
  }

  return (
    <Transition name="semiFade" activeKey={isDappLoading ? 0 : 1} slideClassName={styles.skeletonTransitionWrapper}>
      <ModalHeader
        title={lang(isNftTransferPayload(renderingTransactions?.[0]?.payload) ? 'Send NFT' : 'Send Transaction')}
        onClose={closeDappTransfer}
      />
      {isDappLoading ? <DappSkeletonWithContent rows={skeletonRows} /> : renderContent()}
    </Transition>
  );
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const { isLoading, dapp, transactions, emulation } = global.currentDappTransfer;

  const accountId = global.currentAccountId!;
  const accountState = selectCurrentAccountState(global);
  const accounts = selectNetworkAccounts(global);

  const {
    amountsBySlug: totalAmountsBySlug,
    isScam,
    isDangerous,
    nftCount,
  } = selectCurrentDappTransferTotals(global);

  return {
    transactions,
    totalAmountsBySlug,
    emulation,
    isScam,
    isDangerous,
    nftCount,
    dapp,
    isLoading,
    tokensBySlug: global.tokenInfo.bySlug,
    swapTokensBySlug: global.swapTokenInfo?.bySlug,
    theme: global.settings.theme,
    nftsByAddress: accountState?.nfts?.byAddress,
    currentAccountId: accountId,
    stakingStateBySlug: selectAccountStakingStatesBySlug(global, accountId),
    savedAddresses: accountState?.savedAddresses,
    accounts,
  };
})(DappTransferInitial));

function sortTransactions(
  transactions: readonly ApiDappTransfer[] | undefined,
  tokensBySlug: Record<string, ApiTokenWithPrice>,
) {
  if (!transactions) {
    return transactions;
  }

  return transactions
    .map((transaction, index): SortedDappTransfer => ({
      ...transaction,
      index,
      sortingCost: getTransactionCostForSorting(transaction, tokensBySlug),
    }))
    .sort((transaction0, transaction1) => transaction1.sortingCost - transaction0.sortingCost);
}

function getTransactionCostForSorting(transaction: ApiDappTransfer, tokensBySlug: Record<string, ApiTokenWithPrice>) {
  const tonAmount = toBig(transaction.amount + transaction.networkFee, TONCOIN.decimals).toNumber();
  let cost = tokensBySlug[TONCOIN.slug].priceUsd * tonAmount;

  if (isTokenTransferPayload(transaction.payload)) {
    const { amount, slug } = transaction.payload;
    const token = tokensBySlug[slug];
    if (token) {
      cost += token.priceUsd * toBig(amount, token.decimals).toNumber();
    }
  } else if (isNftTransferPayload(transaction.payload)) {
    // Simple way to display NFT at top of list
    cost += NFT_FAKE_COST_USD;
  }

  return cost;
}
