import React, {
  memo, useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';

import type { ApiToken, ApiTransaction } from '../../../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX, TON_TOKEN_SLUG } from '../../../../config';
import { getActions, withGlobal } from '../../../../global';
import { getIsTinyTransaction, getIsTxIdLocal } from '../../../../global/helpers';
import { selectCurrentAccountState, selectIsNewWallet } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { compareTransactions } from '../../../../util/compareTransactions';
import { formatHumanDay, getDayStartAt } from '../../../../util/dateFormat';
import { findLast } from '../../../../util/iteratees';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';

import { useDeviceScreen } from '../../../../hooks/useDeviceScreen';
import useInfiniteLoader from '../../../../hooks/useInfiniteLoader';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Loading from '../../../ui/Loading';
import NewWalletGreeting from './NewWalletGreeting';
import Transaction from './Transaction';

import styles from './Activity.module.scss';

interface OwnProps {
  isActive?: boolean;
}

type StateProps = {
  currentAccountId: string;
  slug?: string;
  isLoading?: boolean;
  isNewWallet: boolean;
  areTinyTransfersHidden?: boolean;
  byTxId?: Record<string, ApiTransaction>;
  txIdsBySlug?: Record<string, string[]>;
  tokensBySlug?: Record<string, ApiToken>;
  apyValue: number;
  savedAddresses?: Record<string, string>;
  isHistoryEndReached?: boolean;
};

interface TransactionDateGroup {
  datetime: number;
  transactions: ApiTransaction[];
}

const FURTHER_SLICE = 50;
const LOAD_MORE_REQUEST_TIMEOUT = 3_000;

function Activity({
  isActive,
  currentAccountId,
  isLoading,
  isNewWallet,
  slug,
  txIdsBySlug,
  byTxId,
  tokensBySlug,
  areTinyTransfersHidden,
  apyValue,
  savedAddresses,
  isHistoryEndReached,
}: OwnProps & StateProps) {
  const {
    fetchTokenTransactions, fetchAllTransactions, showTransactionInfo, resetIsHistoryEndReached,
  } = getActions();

  const lang = useLang();
  const { isLandscape } = useDeviceScreen();
  const [isFetching, setIsFetching] = useState(!isNewWallet);
  const loadMoreTimeout = useRef<NodeJS.Timeout>();

  const txIds = useMemo(() => {
    let idList: string[] | undefined;

    const bySlug = txIdsBySlug ?? {};

    if (byTxId) {
      if (slug) {
        idList = bySlug[slug] ?? [];
      } else {
        const lastTonTxId = findLast(bySlug[TON_TOKEN_SLUG] ?? [], (txId) => !getIsTxIdLocal(txId));
        idList = Object.values(bySlug).flat();
        if (lastTonTxId) {
          idList = idList.filter((txId) => byTxId[txId].timestamp >= byTxId[lastTonTxId].timestamp);
        }

        idList.sort((a, b) => compareTransactions(byTxId[a], byTxId[b], false));
      }
    }

    if (!idList) {
      return undefined;
    }

    return idList;
  }, [byTxId, slug, txIdsBySlug]);

  const transactions = useMemo(() => {
    if (!txIds) {
      return [];
    }

    const allTransactions = txIds
      .map((txId) => byTxId?.[txId])
      .filter((transaction) => {
        return Boolean(
          transaction?.slug
            && (!slug || transaction.slug === slug)
            && (!areTinyTransfersHidden || !getIsTinyTransaction(transaction, tokensBySlug![transaction.slug])),
        );
      }) as ApiTransaction[];

    if (!allTransactions.length) {
      return [];
    }

    let currentDateGroup: TransactionDateGroup = {
      datetime: getDayStartAt(allTransactions[0].timestamp),
      transactions: [],
    };
    const groupedTransactions: TransactionDateGroup[] = [currentDateGroup];

    allTransactions.forEach((transaction, index) => {
      currentDateGroup.transactions.push(transaction);
      const nextTransaction = allTransactions[index + 1];

      if (nextTransaction) {
        const nextTransactionDayStartsAt = getDayStartAt(nextTransaction.timestamp);
        if (currentDateGroup.datetime !== nextTransactionDayStartsAt) {
          currentDateGroup = {
            datetime: nextTransactionDayStartsAt,
            transactions: [],
          };

          groupedTransactions.push(currentDateGroup);
        }
      }
    });

    return groupedTransactions;
  }, [txIds, byTxId, slug, areTinyTransfersHidden, tokensBySlug]);

  const loadMore = useLastCallback(() => {
    if (slug) {
      fetchTokenTransactions({ slug, limit: FURTHER_SLICE });
    } else {
      fetchAllTransactions({ limit: FURTHER_SLICE });
    }
  });

  const isLoadingDisabled = isHistoryEndReached || isLoading;
  const { handleIntersection } = useInfiniteLoader({ isDisabled: isLoadingDisabled, isLoading, loadMore });

  const handleFetchingState = useLastCallback(() => {
    clearTimeout(loadMoreTimeout.current);
    loadMoreTimeout.current = setTimeout(() => {
      setIsFetching(false);
    }, LOAD_MORE_REQUEST_TIMEOUT);
  });

  useEffect(() => {
    if (isActive) {
      setIsFetching(!isNewWallet);
      resetIsHistoryEndReached();
      handleFetchingState();
    }
  }, [handleFetchingState, isActive, isNewWallet, loadMore, slug]);

  useEffect(() => {
    if (!transactions.length) {
      loadMore();
      handleFetchingState();
    }
  }, [handleFetchingState, loadMore, transactions, txIds]);

  const handleTransactionClick = useLastCallback((txId: string) => {
    showTransactionInfo({ txId });
  });

  if (!currentAccountId) {
    return undefined;
  }

  function renderTransactionGroups(transactionGroups: TransactionDateGroup[]) {
    return transactionGroups.map((group, groupIdx) => (
      <div className={styles.group}>
        <div className={styles.date}>{formatHumanDay(lang, group.datetime)}</div>
        {group.transactions.map((transaction) => {
          return (
            <Transaction
              key={transaction?.txId}
              transaction={transaction}
              token={transaction.slug ? tokensBySlug?.[transaction.slug] : undefined}
              apyValue={apyValue}
              savedAddresses={savedAddresses}
              onClick={handleTransactionClick}
            />
          );
        })}
        {
          groupIdx + 1 === transactionGroups.length && (
            <div ref={handleIntersection} className={styles.loaderThreshold} />
          )
        }
      </div>
    ));
  }
  if (!transactions.length && isFetching) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}>
        <Loading />
      </div>
    );
  }

  if (isLandscape && isNewWallet) {
    return (
      <div className={styles.greeting}>
        <NewWalletGreeting isActive mode="emptyList" />
      </div>
    );
  }

  if (!transactions?.length) {
    return (
      <div className={styles.emptyList}>
        <AnimatedIconWithPreview
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.noData}
          previewUrl={ANIMATED_STICKERS_PATHS.noDataPreview}
          size={ANIMATED_STICKER_BIG_SIZE_PX}
          className={styles.sticker}
          noLoop={false}
          nonInteractive
        />
        <p className={styles.emptyListTitle}>{lang('No Activity')}</p>
      </div>
    );
  }

  return <div>{renderTransactionGroups(transactions)}</div>;
}

export default memo(
  withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
    const { currentAccountId } = global;
    detachWhenChanged(currentAccountId);

    const accountState = selectCurrentAccountState(global);
    const isNewWallet = selectIsNewWallet(global);
    const slug = accountState?.currentTokenSlug;
    const {
      txIdsBySlug, byTxId, isLoading, isHistoryEndReached,
    } = accountState?.transactions || {};
    return {
      currentAccountId: currentAccountId!,
      slug,
      isLoading,
      byTxId,
      isNewWallet,
      txIdsBySlug,
      tokensBySlug: global.tokenInfo?.bySlug,
      areTinyTransfersHidden: global.settings.areTinyTransfersHidden,
      apyValue: accountState?.poolState?.lastApy || 0,
      savedAddresses: accountState?.savedAddresses,
      isHistoryEndReached,
    };
  })(Activity),
);
