import React, {
  memo, useCallback, useEffect, useMemo,
} from '../../lib/teact/teact';
import { withGlobal, getActions } from '../../global';

import { ApiToken, ApiTransaction } from '../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX } from '../../config';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import buildClassName from '../../util/buildClassName';
import { formatHumanDay, getDayStartAt } from '../../util/dateFormat';
import useInfiniteLoader from '../../hooks/useInfiniteLoader';

import Transaction from './Transaction';
import Loading from '../ui/Loading';
import AnimatedIcon from '../ui/AnimatedIcon';

import styles from './Activity.module.scss';

interface OwnProps {
  isActive?: boolean;
}

type StateProps = {
  slug?: string;
  isLoading?: boolean;
  byTxId?: Record<string, ApiTransaction>;
  txIds?: string[];
  nextOffsetTxId?: string;
  tokensBySlug?: Record<string, ApiToken>;
};

interface TransactionDateGroup {
  datetime: number;
  transactions: ApiTransaction[];
}

const INITIAL_SLICE = 20;
const FURTHER_SLICE = 50;

function Activity({
  isActive, isLoading, slug, txIds, byTxId, nextOffsetTxId, tokensBySlug,
}: OwnProps & StateProps) {
  const { fetchTransactions, showTransactionInfo } = getActions();
  const hasNextPage = Boolean(nextOffsetTxId);

  const transactions = useMemo(() => {
    if (!txIds) {
      return undefined;
    }
    const allTransactions = txIds
      .map((txId) => byTxId?.[txId])
      .filter((transaction) => {
        return Boolean(transaction?.slug && (!slug || transaction.slug === slug));
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
  }, [byTxId, slug, txIds]);

  // Initial loading
  useEffect(() => {
    fetchTransactions({ limit: INITIAL_SLICE });
  }, [fetchTransactions]);

  const loadMore = useCallback(() => {
    fetchTransactions({ limit: FURTHER_SLICE, offsetId: nextOffsetTxId });
  }, [fetchTransactions, nextOffsetTxId]);

  const handleTransactionClick = useCallback((txId: string) => {
    showTransactionInfo({ txId });
  }, [showTransactionInfo]);

  const lastElementRef = useInfiniteLoader({ isLoading, loadMore, isDisabled: !hasNextPage });

  function renderTransactionGroups(transactionGroups: TransactionDateGroup[]) {
    return transactionGroups.map((group, groupIdx) => (
      <div className={styles.group}>
        <div className={styles.date}>
          {formatHumanDay(group.datetime)}
        </div>
        {group.transactions.map((transaction) => {
          return (
            <Transaction
              key={transaction?.txId}
              transaction={transaction}
              token={transaction.slug ? tokensBySlug?.[transaction.slug] : undefined}
              onClick={handleTransactionClick}
            />
          );
        })}
        {hasNextPage && groupIdx + 1 === transactionGroups.length && (
          <div ref={lastElementRef} className={styles.loaderThreshold} />
        )}
      </div>
    ));
  }

  if (!transactions) {
    return (
      <div className={buildClassName(styles.emptyList, styles.emptyListLoading)}><Loading /></div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className={styles.emptyList}>
        <AnimatedIcon
          play={isActive}
          tgsUrl={ANIMATED_STICKERS_PATHS.noData}
          size={ANIMATED_STICKER_BIG_SIZE_PX}
          noLoop={false}
          nonInteractive
        />
        <p className={styles.emptyListTitle}>No Activity</p>
      </div>
    );
  }

  return renderTransactionGroups(transactions);
}

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    slug: global.currentTokenSlug,
    isLoading: global.transactions?.isLoading,
    byTxId: global.transactions?.byTxId,
    txIds: global.transactions?.orderedTxIds,
    nextOffsetTxId: global.transactions?.nextOffsetTxId,
    tokensBySlug: global.tokenInfo?.bySlug,
  };
})(Activity));
