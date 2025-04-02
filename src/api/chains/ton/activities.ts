import type { ApiActivity, ApiNetwork, ApiSwapActivity, ApiTransactionActivity } from '../../types';
import type {
  AddressBook,
  AnyAction,
  CallContractAction,
  JettonTransferAction,
  SwapAction,
  Trace,
  TraceDetail,
} from './toncenter/types';
import type { ApiTransactionExtended } from './types';

import { parseAccountId } from '../../../util/account';
import { getActivityTokenSlugs, parseTxId } from '../../../util/activities';
import { bigintAbs } from '../../../util/bigint';
import { toDecimal } from '../../../util/decimals';
import { groupBy, intersection } from '../../../util/iteratees';
import { logDebug } from '../../../util/logs';
import withCacheAsync from '../../../util/withCacheAsync';
import { resolveTokenWalletAddress } from './util/tonCore';
import { fetchStoredTonWallet } from '../../common/accounts';
import { updateActivityMetadata } from '../../common/helpers';
import { getTokenBySlug } from '../../common/tokens';
import { fetchTrace } from './toncenter/traces';
import { OpCode, OUR_FEE_PAYLOAD_BOC } from './constants';
import { fetchActions, fetchTransactions, parseActionActivitySubId, parseRawTransaction } from './toncenter';

type ParsedTracePart = {
  hashes: Set<string>;
  inputTxs: ApiTransactionExtended[];
  sent: bigint;
  received: bigint;
  networkFee: bigint;
};

type ParsedTrace = {
  trace: Trace;
  addressBook: AddressBook;
  byTransactionIndex: ParsedTracePart[];
  totalSent: bigint;
  totalReceived: bigint;
  totalNetworkFee: bigint;
};

const GET_TRANSACTIONS_LIMIT = 128;

export const checkHasTransaction = withCacheAsync(async (network: ApiNetwork, address: string) => {
  const transactions = await fetchTransactions({
    network,
    address,
    limit: 1,
  });
  return Boolean(transactions.length);
});

export async function fetchActivitySlice(
  accountId: string,
  tokenSlug?: string,
  toTimestamp?: number,
  fromTimestamp?: number,
  limit?: number,
  shouldIncludeFrom?: boolean,
): Promise<ApiActivity[]> {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredTonWallet(accountId);

  let activities: ApiActivity[];

  if (!tokenSlug) {
    activities = await fetchActions({
      network,
      address,
      walletAddress: address,
      limit: limit ?? GET_TRANSACTIONS_LIMIT,
      fromTimestamp,
      toTimestamp,
      shouldIncludeFrom,
    });
  } else {
    const token = getTokenBySlug(tokenSlug);
    const tokenWalletAddress = await resolveTokenWalletAddress(network, address, token.tokenAddress!);

    activities = await fetchActions({
      network,
      address: tokenWalletAddress,
      walletAddress: address,
      limit: limit ?? GET_TRANSACTIONS_LIMIT,
      fromTimestamp,
      toTimestamp,
      shouldIncludeFrom,
    });

    activities = activities.filter((activity) => getActivityTokenSlugs(activity).includes(tokenSlug));
  }

  return activities.map(updateActivityMetadata);
}

export async function fetchNewestActionId(network: ApiNetwork, address: string) {
  const transactions = await fetchTransactions({
    network,
    address,
    limit: 1,
  });

  if (!transactions.length) {
    return undefined;
  }

  return transactions[0].txId;
}

export async function fetchActivityDetails(accountId: string, activity: ApiActivity): Promise<ApiActivity> {
  const { network } = parseAccountId(accountId);
  const { address: walletAddress } = await fetchStoredTonWallet(accountId);

  const { id } = activity;
  const { hash: traceId, subId } = parseTxId(id);
  const { actionId } = parseActionActivitySubId(subId!);

  const parsedTrace = await fetchAndParseTrace(network, walletAddress, traceId);
  const { trace, byTransactionIndex } = parsedTrace;

  const action = trace.actions.find(({ action_id }) => action_id === actionId)!;
  const actionHashes = new Set(action.transactions);

  const {
    sent,
    received,
    networkFee,
  } = byTransactionIndex.find((item) => {
    return intersection(item.hashes, actionHashes).size;
  })!;

  let realFee = networkFee;

  if (activity.kind === 'swap') {
    ({ realFee, activity } = setSwapDetails({
      parsedTrace, activity, action: action as SwapAction, sent, received, realFee,
    }));
  } else {
    ({ realFee, activity } = setTransactionDetails({
      parsedTrace, activity, action, sent, received, realFee,
    }));
  }

  logDebug('Calculation of fee for action', {
    actionId: action.action_id,
    traceId,
    sent: toDecimal(sent),
    networkFee: toDecimal(networkFee),
    returned: toDecimal(received),
    change: toDecimal(-sent + received),
    realFee: toDecimal(realFee),
    details: action.details,
  });

  return activity;
}

function setSwapDetails(options: {
  parsedTrace: ParsedTrace;
  action: SwapAction;
  activity: ApiSwapActivity;
  sent: bigint;
  received: bigint;
  realFee: bigint;
}) {
  const { action, received, sent, parsedTrace: { trace } } = options;
  let { realFee, activity } = options;

  const { details } = action as SwapAction;

  if (!details.asset_in) {
    // TON -> token
    realFee += sent - BigInt(details.dex_incoming_transfer.amount) - received;
  } else if (!details.asset_out) {
    // Token -> TON
    realFee += sent - received + BigInt(details.dex_outgoing_transfer.amount);
  } else {
    // Token -> token
    realFee += sent - received;
  }

  activity = {
    ...activity,
    networkFee: toDecimal(realFee),
  };
  delete activity.shouldLoadDetails;

  let ourFee: bigint | undefined;
  if (!details.asset_in) {
    const ourFeeAction = trace.actions.find((_action) => {
      return _action.type === 'call_contract' && Number(_action.details.opcode) === OpCode.OurFee;
    }) as CallContractAction | undefined;
    if (ourFeeAction) {
      ourFee = BigInt(ourFeeAction.details.value);
    }
  } else {
    const ourFeeAction = trace.actions.find((_action) => {
      return _action.type === 'jetton_transfer' && _action.details.forward_payload === OUR_FEE_PAYLOAD_BOC;
    }) as JettonTransferAction | undefined;
    if (ourFeeAction) {
      ourFee = BigInt(ourFeeAction.details.amount);
    }
  }

  if (ourFee) {
    const tokenIn = getTokenBySlug(activity.from);
    activity.ourFee = toDecimal(ourFee, tokenIn?.decimals);
  }

  return { realFee, activity };
}

function setTransactionDetails(options: {
  parsedTrace: ParsedTrace;
  action: AnyAction;
  activity: ApiTransactionActivity;
  sent: bigint;
  received: bigint;
  realFee: bigint;
}) {
  const {
    action,
    received,
    sent,
    parsedTrace: {
      byTransactionIndex,
      totalSent,
      totalReceived,
      totalNetworkFee,
    } } = options;
  let { realFee, activity } = options;

  switch (action.type) {
    case 'jetton_transfer':
    case 'jetton_mint':
    case 'jetton_burn':
    case 'nft_mint':
    case 'nft_transfer':
    case 'stake_withdrawal_request': {
      realFee += sent - received;
      break;
    }
    case 'stake_deposit': {
      realFee += sent - received - BigInt(action.details.amount);
      break;
    }
    case 'stake_withdrawal': {
      realFee += sent - received + BigInt(action.details.amount);
      break;
    }
    case 'change_dns':
    case 'delete_dns':
    case 'renew_dns': {
      realFee += sent - received;
      break;
    }
    case 'dex_deposit_liquidity': {
      if (byTransactionIndex.length > 1) {
        realFee = totalNetworkFee + totalSent - totalReceived;
      } else {
        realFee += sent - received;
      }

      if (!action.details.asset_1) {
        realFee -= BigInt(action.details.amount_1!);
      } else if (action.details.lp_tokens_minted && !action.details.asset_2) {
        realFee -= BigInt(action.details.amount_2!);
      }

      if (byTransactionIndex.length > 1) {
        realFee /= 2n;
      }
      break;
    }
    case 'dex_withdraw_liquidity': {
      realFee += sent - received;
      if (!action.details.asset_1) {
        realFee += BigInt(action.details.amount_1);
      } else if (!action.details.asset_2) {
        realFee += BigInt(action.details.amount_2);
      }
      realFee /= 2n;
      break;
    }
  }

  activity = {
    ...activity,
    fee: realFee,
  };
  delete activity.shouldLoadDetails;

  return { activity, realFee };
}

async function fetchAndParseTrace(network: ApiNetwork, walletAddress: string, traceId: string): Promise<ParsedTrace> {
  const {
    trace,
    addressBook,
  } = await fetchTrace({
    network,
    traceId,
  });

  const transactions = Object.values(trace.transactions)
    .map((rawTx) => parseRawTransaction(network, rawTx, addressBook))
    .flat();
  const byHash = groupBy(transactions, 'hash');

  let totalSent = 0n;
  let totalReceived = 0n;
  let totalNetworkFee = 0n;

  const byTransactionIndex: ParsedTracePart[] = [];

  let isWalletTransactionFound = false;

  function processTrace(traceDetail: TraceDetail, _index?: number) {
    const hash = traceDetail.tx_hash;
    const txs = byHash[hash];

    if (!isWalletTransactionFound) {
      isWalletTransactionFound = txs.some(({ fromAddress, isIncoming }) => {
        return fromAddress === walletAddress && !isIncoming;
      });

      // In gasless operations, we need to skip transactions before our wallet
      if (!isWalletTransactionFound) {
        traceDetail.children.forEach(processTrace);
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
      } = tx;

      const index = _index ?? i;

      if (!(index in byTransactionIndex)) {
        byTransactionIndex.push({
          hashes: new Set(),
          inputTxs: [],
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
      } else if (toAddress === walletAddress && isIncoming) {
        byTransactionIndex[index].received += bigintAbs(amount);
        byTransactionIndex[index].inputTxs.push(tx);
        totalReceived += bigintAbs(amount);
      }

      const child = traceDetail.children.find(({ in_msg_hash }) => in_msg_hash === msgHash);
      if (child) {
        processTrace(child, index);
      }
    }
  }

  processTrace(trace.trace);

  return {
    trace,
    addressBook,
    byTransactionIndex,
    totalSent,
    totalReceived,
    totalNetworkFee,
  };
}
