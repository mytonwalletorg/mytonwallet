import React, {
  memo, useCallback, useEffect, useMemo,
} from '../../lib/teact/teact';
import { withGlobal, getActions } from '../../global';

import { ApiToken, ApiTransaction } from '../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX, TINY_TRANSFER_MAX_AMOUNT } from '../../config';
import { ANIMATED_STICKERS_PATHS } from '../ui/helpers/animatedAssets';
import { bigStrToHuman } from '../../global/helpers';
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
  areTinyTransfersHidden?: boolean;
  byTxId?: Record<string, ApiTransaction>;
  txIds?: string[];
  tokensBySlug?: Record<string, ApiToken>;
};

interface TransactionDateGroup {
  datetime: number;
  transactions: ApiTransaction[];
}

const INITIAL_SLICE = 20;
const FURTHER_SLICE = 50;

function Activity({
  isActive, isLoading, slug, txIds, byTxId, tokensBySlug, areTinyTransfersHidden,
}: OwnProps & StateProps) {
  const { fetchTransactions, showTransactionInfo } = getActions();

  const transactions = useMemo(() => {
    if (!txIds) {
      return undefined;
    }
    const allTransactions = txIds
      .map((txId) => byTxId?.[txId])
      .filter((transaction) => {
        return Boolean(
          transaction?.slug
          && (!slug || transaction.slug === slug)
          && (!areTinyTransfersHidden || Math.abs(bigStrToHuman(transaction.amount)) >= TINY_TRANSFER_MAX_AMOUNT),
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
  }, [byTxId, areTinyTransfersHidden, slug, txIds]);

  // Initial loading
  const areTxsPreloaded = txIds ? txIds.length >= INITIAL_SLICE : false;
  useEffect(() => {
    if (!areTxsPreloaded) {
      fetchTransactions({ limit: INITIAL_SLICE });
    }
  }, [areTxsPreloaded, fetchTransactions]);

  const loadMore = useCallback(() => {
    fetchTransactions({ limit: FURTHER_SLICE });
  }, [fetchTransactions]);

  const handleTransactionClick = useCallback((txId: string) => {
    showTransactionInfo({ txId });
  }, [showTransactionInfo]);

  const lastElementRef = useInfiniteLoader({ isLoading, loadMore });

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
        {groupIdx + 1 === transactionGroups.length && (
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
          className={styles.sticker}
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
    tokensBySlug: global.tokenInfo?.bySlug,
    areTinyTransfersHidden: global.settings.areTinyTransfersHidden,
  };
})(Activity));
