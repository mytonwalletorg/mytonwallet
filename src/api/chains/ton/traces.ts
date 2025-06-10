import type { ApiNetwork } from '../../types';
import type { AddressBook, AnyAction, TraceDetail, Transaction } from './toncenter/types';
import type { ParsedTrace, ParsedTracePart } from './types';

import { bigintAbs } from '../../../util/bigint';
import { groupBy } from '../../../util/iteratees';
import { fetchTrace } from './toncenter/traces';
import { parseRawTransaction } from './toncenter';

export async function fetchAndParseTrace(
  network: ApiNetwork,
  walletAddress: string,
  traceId: string,
): Promise<ParsedTrace> {
  const { trace, addressBook } = await fetchTrace({ network, traceId });

  return parseTrace({
    network,
    walletAddress,
    actions: trace.actions,
    traceDetail: trace.trace,
    addressBook,
    transactions: trace.transactions,
  });
}

export function parseTrace(options: {
  network: ApiNetwork;
  walletAddress: string;
  actions: AnyAction[];
  traceDetail: TraceDetail;
  addressBook: AddressBook;
  transactions: Record<string, Transaction>;
}): ParsedTrace {
  const {
    network,
    walletAddress,
    actions,
    traceDetail,
    addressBook,
    transactions: rawTransactions,
  } = options;

  const transactions = Object.values(rawTransactions)
    .map((rawTx) => parseRawTransaction(network, rawTx, addressBook))
    .flat();

  const byHash = groupBy(transactions, 'hash');

  let totalSent = 0n;
  let totalReceived = 0n;
  let totalNetworkFee = 0n;

  const byTransactionIndex: ParsedTracePart[] = [];

  let isWalletTransactionFound = false;

  function processTrace(_traceDetail: TraceDetail, _index?: number) {
    const hash = _traceDetail.tx_hash;
    const txs = byHash[hash] || [];

    if (!isWalletTransactionFound) {
      isWalletTransactionFound = txs.some(({
        fromAddress,
        isIncoming,
      }) => {
        return fromAddress === walletAddress && !isIncoming;
      });

      // In gasless operations, we need to skip transactions before our wallet
      if (!isWalletTransactionFound) {
        _traceDetail.children.forEach(processTrace);
        return;
      }
    }

    for (const [i, tx] of txs.entries()) {
      const {
        fromAddress,
        toAddress,
        amount,
        isIncoming,
        fee,
        msgHash,
        type,
      } = tx;

      const index = _index ?? i;

      if (!(index in byTransactionIndex)) {
        // First transaction from wallet includes all sub-transactions, and its hash is not unique
        byTransactionIndex.push({
          hashes: new Set(),
          sent: 0n,
          received: 0n,
          networkFee: 0n,
        });
      } else {
        byTransactionIndex[index].hashes.add(hash);
      }

      if (fromAddress === walletAddress && !isIncoming) {
        byTransactionIndex[index].sent += bigintAbs(amount);
        byTransactionIndex[index].networkFee = fee;
        totalSent += bigintAbs(amount);
        totalNetworkFee += fee;
      } else if (toAddress === walletAddress && isIncoming && type !== 'bounced') {
        byTransactionIndex[index].received += bigintAbs(amount);
        totalReceived += bigintAbs(amount);
      }

      const child = _traceDetail.children.find(({ in_msg_hash }) => in_msg_hash === msgHash);
      if (child) {
        processTrace(child, index);
      }
    }
  }

  processTrace(traceDetail);

  return {
    actions,
    traceDetail,
    addressBook,
    byTransactionIndex,
    totalSent,
    totalReceived,
    totalNetworkFee,
  };
}
