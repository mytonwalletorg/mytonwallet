import type { SwapHistoryRange } from '../../methods';
import type {
  ApiActivity,
  ApiNetwork,
  ApiSwapBuildRequest,
  ApiSwapHistoryItem,
  ApiTokensTransferPayload,
  ApiTransaction,
  ApiTransactionActivity,
} from '../../types';
import type { TonTransferParams } from './types';

import { DIESEL_ADDRESS, SWAP_FEE_ADDRESS, TONCOIN } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { assert } from '../../../util/assert';
import { fromDecimal } from '../../../util/decimals';
import { logDebugError } from '../../../util/logs';
import { pause } from '../../../util/schedulers';
import { parseTxId } from './util';
import { parsePayloadBase64 } from './util/metadata';
import { resolveTokenWalletAddress, toBase64Address } from './util/tonCore';
import { fetchStoredTonWallet } from '../../common/accounts';
import { swapGetHistory, swapGetHistoryByRanges, swapItemToActivity } from '../../common/swap';
import { getTokenByAddress, getTokenBySlug } from '../../common/tokens';
import { getContractInfo } from './wallet';

type LtRange = [number, number];

const FEE_ADDRESSES = [SWAP_FEE_ADDRESS, DIESEL_ADDRESS];
const MEGATON_WTON_MINTER = 'EQCajaUU1XXSAjTD-xOV7pE49fGtg4q8kF3ELCOJtGvQFQ2C';
const MAX_NETWORK_FEE = 1000000000n; // 1 TON

const SWAP_MAX_LT = 50;
const SWAP_WAITING_TIME = 5 * 60 * 1_000; // 5 min
const SWAP_WAITING_PAUSE = 1_000; // 1 sec
const MAX_OLD_SWAP_ID = 41276;

export async function validateDexSwapTransfers(
  network: ApiNetwork,
  address: string,
  request: ApiSwapBuildRequest,
  transfers: TonTransferParams[],
) {
  assert(transfers.length <= 2);

  const [mainTransfer, feeTransfer] = transfers;

  if (request.from === TONCOIN.symbol) {
    const maxAmount = fromDecimal(request.fromAmount) + MAX_NETWORK_FEE;
    const { isSwapAllowed, codeHash } = await getContractInfo(network, mainTransfer.toAddress);

    assert(!!isSwapAllowed, `Not allowed swap contract: ${codeHash} ${mainTransfer.toAddress}`);
    assert(mainTransfer.amount <= maxAmount);

    if (feeTransfer) {
      assert(feeTransfer.amount <= mainTransfer.amount);
      assert(feeTransfer.amount + mainTransfer.amount < maxAmount);
      assert(FEE_ADDRESSES.includes(toBase64Address(feeTransfer.toAddress, false)));
    }
  } else {
    const token = getTokenByAddress(request.from)!;
    assert(!!token);

    const maxAmount = fromDecimal(request.fromAmount, token.decimals)
      + fromDecimal(request.ourFee ?? 0, token.decimals)
      + fromDecimal(request.dieselFee ?? 0, token.decimals);
    const maxTonAmount = MAX_NETWORK_FEE;

    const walletAddress = await resolveTokenWalletAddress(network, address, token.tokenAddress!);
    const parsedPayload = await parsePayloadBase64(network, mainTransfer.toAddress, mainTransfer.payload as string);

    let destination: string;
    let tokenAmount = 0n;

    if (mainTransfer.toAddress === MEGATON_WTON_MINTER) {
      destination = mainTransfer.toAddress;
      assert(mainTransfer.toAddress === token.tokenAddress);
    } else {
      assert(mainTransfer.toAddress === walletAddress);
      assert(['tokens:transfer', 'tokens:transfer-non-standard'].includes(parsedPayload.type));

      ({ amount: tokenAmount, destination } = parsedPayload as ApiTokensTransferPayload);
      assert(tokenAmount <= maxAmount);
    }

    assert(mainTransfer.amount < maxTonAmount);

    const { isSwapAllowed } = await getContractInfo(network, destination);

    assert(!!isSwapAllowed);

    if (feeTransfer) {
      const feePayload = await parsePayloadBase64(network, feeTransfer.toAddress, feeTransfer.payload as string);

      assert(feeTransfer.amount + mainTransfer.amount < maxTonAmount);
      assert(feeTransfer.toAddress === walletAddress);
      assert(['tokens:transfer', 'tokens:transfer-non-standard'].includes(feePayload.type));

      const { amount: tokenFeeAmount, destination: feeDestination } = feePayload as ApiTokensTransferPayload;

      assert(tokenAmount + tokenFeeAmount <= maxAmount);
      assert(FEE_ADDRESSES.includes(toBase64Address(feeDestination, false)));
    }
  }
}

export async function swapReplaceTransactions(
  accountId: string,
  transactions: ApiTransactionActivity[],
  network: ApiNetwork,
  slug?: string,
): Promise<ApiActivity[]> {
  if (!transactions.length || network === 'testnet') {
    return transactions;
  }

  try {
    const { address } = await fetchStoredTonWallet(accountId);
    const asset = slug ? getTokenBySlug(slug).tokenAddress ?? TONCOIN.symbol : undefined;
    const {
      fromLt, toLt, fromTime, toTime,
    } = buildSwapHistoryRange(transactions);

    const swaps = await swapGetHistory(address, {
      fromLt,
      toLt,
      fromTimestamp: fromTime,
      toTimestamp: toTime,
      asset,
    });

    if (!swaps.length) {
      return transactions;
    }

    return replaceTransactions(transactions, swaps);
  } catch (err) {
    logDebugError('swapReplaceTransactions', err);
    return transactions;
  }
}

export async function swapReplaceTransactionsByRanges(
  accountId: string,
  transactions: ApiTransactionActivity[],
  chunks: ApiTransactionActivity[][],
  isFirstLoad?: boolean,
): Promise<ApiActivity[]> {
  transactions = transactions.slice();

  const { network } = parseAccountId(accountId);

  if (!chunks.length || network === 'testnet') {
    return transactions;
  }

  try {
    const { address } = await fetchStoredTonWallet(accountId);

    if (!isFirstLoad) {
      await waitPendingDexSwap(address);
    }

    const ranges = chunks.map((txs) => buildSwapHistoryRange(txs));
    const swaps = await swapGetHistoryByRanges(address, ranges);

    if (!swaps.length) {
      return transactions;
    }

    return replaceTransactions(transactions, swaps);
  } catch (err) {
    logDebugError('swapReplaceTransactionsByRanges', err);
    return transactions;
  }
}

function replaceTransactions(transactions: ApiTransactionActivity[], swaps: ApiSwapHistoryItem[]) {
  const result: ApiActivity[] = [];
  const hiddenTxIds = new Set<string>();

  const skipLtRanges: LtRange[] = []; // TODO Remove it after applying correcting script in backend

  for (const swap of swaps) {
    swap.txIds?.forEach((txId) => {
      hiddenTxIds.add(txId);
    });

    if (swap.lt && Number(swap.id) < MAX_OLD_SWAP_ID) {
      skipLtRanges.push([swap.lt, swap.lt + SWAP_MAX_LT]);
    }

    const swapActivity = swapItemToActivity(swap);

    result.push(swapActivity);
  }

  for (let transaction of transactions) {
    const [ltString, hash] = transaction.txId.split(':');
    const lt = Number(ltString);
    const shortenedTxId = `${lt}:${hash}`;

    const shouldHide = Boolean(
      hiddenTxIds.has(shortenedTxId)
      || skipLtRanges.find(([startLt, endLt]) => lt >= startLt && lt <= endLt),
    );

    if (shouldHide) {
      transaction = { ...transaction, shouldHide };
    }
    result.push(transaction);
  }

  return result;
}

async function waitPendingDexSwap(address: string) {
  const waitUntil = Date.now() + SWAP_WAITING_TIME;

  while (Date.now() < waitUntil) {
    const pendingSwaps = await swapGetHistory(address, {
      status: 'pending',
      isCex: false,
    });

    if (!pendingSwaps.length) {
      break;
    }

    const areAllStale = pendingSwaps.every((swap) => (
      Date.now() - swap.timestamp > SWAP_WAITING_TIME * 2
    ));
    if (areAllStale) {
      break;
    }

    await pause(SWAP_WAITING_PAUSE);
  }
}

function buildSwapHistoryRange(transactions: ApiTransaction[]): SwapHistoryRange {
  const firstLt = parseTxId(transactions[0].txId).lt;
  const lastLt = parseTxId(transactions[transactions.length - 1].txId).lt;

  const firstTimestamp = transactions[0].timestamp;
  const lastTimestamp = transactions[transactions.length - 1].timestamp;

  const [fromLt, fromTime] = firstLt > lastLt ? [lastLt, lastTimestamp] : [firstLt, firstTimestamp];
  const [toLt, toTime] = firstLt > lastLt ? [firstLt, firstTimestamp] : [lastLt, lastTimestamp];

  const slug = transactions[0].slug;
  const asset = slug === TONCOIN.slug ? TONCOIN.symbol : getTokenBySlug(slug).tokenAddress!;

  return {
    asset,
    fromLt: Math.floor(fromLt / 100) * 100,
    toLt,
    fromTime,
    toTime,
  };
}
