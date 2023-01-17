import React, {
  memo, useCallback, useEffect, useMemo,
} from '../../../../lib/teact/teact';
import { withGlobal, getActions } from '../../../../global';

import type { ApiToken, ApiTransaction } from '../../../../api/types';

import { ANIMATED_STICKER_BIG_SIZE_PX, TINY_TRANSFER_MAX_AMOUNT } from '../../../../config';
import { ANIMATED_STICKERS_PATHS } from '../../../ui/helpers/animatedAssets';
import { bigStrToHuman } from '../../../../global/helpers';
import { selectCurrentAccountState } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { formatHumanDay, getDayStartAt } from '../../../../util/dateFormat';
import useInfiniteLoader from '../../../../hooks/useInfiniteLoader';
import useLang from '../../../../hooks/useLang';

import Loading from '../../../ui/Loading';
import AnimatedIconWithPreview from '../../../ui/AnimatedIconWithPreview';
import Transaction from './Transaction';

import styles from './Activity.module.scss';

interface OwnProps {
  isActive?: boolean;
}

type StateProps = {
  currentAccountId: string;
  slug?: string;
  isLoading?: boolean;
  areTinyTransfersHidden?: boolean;
  byTxId?: Record<string, ApiTransaction>;
  txIds?: string[];
  tokensBySlug?: Record<string, ApiToken>;
  apyValue: number;
};

interface TransactionDateGroup {
  datetime: number;
  transactions: ApiTransaction[];
}

const INITIAL_SLICE = 20;
const FURTHER_SLICE = 50;

function Activity({
  isActive,
  currentAccountId,
  isLoading,
  slug,
  txIds,
  byTxId,
  tokensBySlug,
  areTinyTransfersHidden,
  apyValue,
}: OwnProps & StateProps) {
  const { fetchTransactions, showTransactionInfo } = getActions();

  const lang = useLang();

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
          && (
            !areTinyTransfersHidden
            || Math.abs(
              bigStrToHuman(transaction.amount, tokensBySlug![transaction.slug!].decimals),
            ) >= TINY_TRANSFER_MAX_AMOUNT
          ),
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
  }, [tokensBySlug, byTxId, areTinyTransfersHidden, slug, txIds]);

  // Initial loading
  const areTxsPreloaded = txIds ? txIds.length >= INITIAL_SLICE : false;
  useEffect(() => {
    if (!areTxsPreloaded) {
      fetchTransactions({ limit: INITIAL_SLICE });
    }
  }, [areTxsPreloaded, fetchTransactions, currentAccountId]);

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
          {formatHumanDay(lang, group.datetime)}
        </div>
        {group.transactions.map((transaction) => {
          return (
            <Transaction
              key={transaction?.txId}
              transaction={transaction}
              token={transaction.slug ? tokensBySlug?.[transaction.slug] : undefined}
              apyValue={apyValue}
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

  return renderTransactionGroups(transactions);
}

export default memo(withGlobal<OwnProps>((global, ownProps, detachWhenChanged): StateProps => {
  const { currentAccountId } = global;
  detachWhenChanged(currentAccountId);

  const accountState = selectCurrentAccountState(global);

  return {
    currentAccountId: currentAccountId!,
    slug: accountState?.currentTokenSlug,
    isLoading: accountState?.transactions?.isLoading,
    byTxId: accountState?.transactions?.byTxId,
    txIds: accountState?.transactions?.orderedTxIds,
    tokensBySlug: global.tokenInfo?.bySlug,
    areTinyTransfersHidden: global.settings.areTinyTransfersHidden,
    apyValue: accountState?.poolState?.lastApy || 0,
  };
})(Activity));
