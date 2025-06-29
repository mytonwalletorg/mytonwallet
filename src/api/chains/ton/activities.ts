import type { ApiActivity, ApiNetwork, ApiSwapActivity, ApiTransactionActivity } from '../../types';
import type { AnyAction, CallContractAction, JettonTransferAction, SwapAction } from './toncenter/types';
import type { ParsedTrace } from './types';

import { TONCOIN } from '../../../config';
import { parseAccountId } from '../../../util/account';
import { getActivityTokenSlugs, parseTxId } from '../../../util/activities';
import { fromDecimal, toDecimal } from '../../../util/decimals';
import { intersection } from '../../../util/iteratees';
import { logDebug } from '../../../util/logs';
import withCacheAsync from '../../../util/withCacheAsync';
import { resolveTokenWalletAddress } from './util/tonCore';
import { fetchStoredTonWallet } from '../../common/accounts';
import { updateActivityMetadata } from '../../common/helpers';
import { getTokenBySlug } from '../../common/tokens';
import { OpCode, OUR_FEE_PAYLOAD_BOC } from './constants';
import { fetchActions, fetchTransactions, parseActionActivitySubId, parseLiquidityDeposit } from './toncenter';
import { fetchAndParseTrace } from './traces';

type ActivityDetailsResult = {
  activity: ApiActivity;
  sentForFee: bigint;
  excess: bigint;
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
    activities = await fetchActions({
      network,
      address: tokenSlug === TONCOIN.slug
        ? address
        : await resolveTokenWalletAddress(network, address, getTokenBySlug(tokenSlug).tokenAddress!),
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

export async function fetchActivityDetails(accountId: string, activity: ApiActivity): Promise<ActivityDetailsResult> {
  const { network } = parseAccountId(accountId);
  const { address: walletAddress } = await fetchStoredTonWallet(accountId);

  const { hash: traceId } = parseTxId(activity.id);
  const parsedTrace = await fetchAndParseTrace(network, walletAddress, traceId);

  return calculateActivityDetails(activity, parsedTrace);
}

export function calculateActivityDetails(activity: ApiActivity, parsedTrace: ParsedTrace): ActivityDetailsResult {
  const { hash: traceId, subId } = parseTxId(activity.id);
  const { actionId } = parseActionActivitySubId(subId!);
  const { actions, byTransactionIndex } = parsedTrace;

  const action = actions.find(({ action_id }) => action_id === actionId)!;
  const actionHashes = new Set(action.transactions);

  const {
    sent,
    received,
    networkFee,
  } = byTransactionIndex.find((item) => {
    return intersection(item.hashes, actionHashes).size;
  })!;

  let result: ActivityDetailsResult;

  if (activity.kind === 'swap') {
    result = setSwapDetails({
      parsedTrace, activity, action: action as SwapAction, sent, received, networkFee,
    });
  } else {
    result = setTransactionDetails({
      parsedTrace, activity, action, sent, received, networkFee,
    });
  }

  logDebug('Calculation of fee for action', {
    actionId: action.action_id,
    traceId,
    networkFee: toDecimal(networkFee),
    realFee: toDecimal(getActivityRealFee(result.activity)),
    sentForFee: toDecimal(result.sentForFee),
    excess: toDecimal(result.excess),
    details: action.details,
  });

  return result;
}

function setSwapDetails(options: {
  parsedTrace: ParsedTrace;
  action: SwapAction;
  activity: ApiSwapActivity;
  sent: bigint;
  received: bigint;
  networkFee: bigint;
}): ActivityDetailsResult {
  const { action, networkFee, received, sent, parsedTrace: { actions } } = options;
  let { activity } = options;

  const { details } = action;

  let sentForFee = sent;
  let excess = received;

  if (!details.asset_in) {
    // TON -> token
    sentForFee -= BigInt(details.dex_incoming_transfer.amount);
  } else if (!details.asset_out) {
    // Token -> TON
    excess -= BigInt(details.dex_outgoing_transfer.amount);
  }

  const realFee = networkFee + sentForFee - excess;

  activity = {
    ...activity,
    networkFee: toDecimal(realFee),
  };

  let ourFee: bigint | undefined;
  if (!details.asset_in) {
    const ourFeeAction = actions.find((_action) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      return _action.type === 'call_contract' && Number(_action.details.opcode) === OpCode.OurFee;
    }) as CallContractAction | undefined;
    if (ourFeeAction) {
      ourFee = BigInt(ourFeeAction.details.value);
    }
  } else {
    const ourFeeAction = actions.find((_action) => {
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

  delete activity.shouldLoadDetails;

  return { activity, sentForFee, excess };
}

function setTransactionDetails(options: {
  parsedTrace: ParsedTrace;
  action: AnyAction;
  activity: ApiTransactionActivity;
  sent: bigint;
  received: bigint;
  networkFee: bigint;
}): ActivityDetailsResult {
  const {
    action,
    received,
    sent,
    parsedTrace: {
      addressBook,
      totalSent,
      totalReceived,
      totalNetworkFee,
    },
  } = options;

  let { activity, networkFee } = options;
  let sentForFee = sent;
  let excess = received;

  switch (action.type) {
    case 'ton_transfer':
    case 'call_contract': {
      sentForFee -= BigInt(action.details.value);
      break;
    }
    case 'nft_transfer': {
      if (action.details.is_purchase) {
        sentForFee -= BigInt(action.details.price!);
      }
      break;
    }
    case 'stake_deposit': {
      sentForFee -= BigInt(action.details.amount);
      break;
    }
    case 'stake_withdrawal': {
      excess -= BigInt(action.details.amount);
      break;
    }
    case 'dex_deposit_liquidity': {
      // Liquidity deposit can be either a dual transaction or two separate single transactions.
      // We display the deposit as separate actions, so we divide by the number of actions.
      const activitiesPerAction = BigInt(parseLiquidityDeposit(action, {
        addressBook,
        // The below fields don't matter here, they are only to satisfy the type requirements:
        network: 'mainnet',
        walletAddress: '',
        metadata: {},
        nftSuperCollectionsByCollectionAddress: {},
      }).length);

      networkFee = totalNetworkFee / activitiesPerAction;
      sentForFee = totalSent / activitiesPerAction;
      excess = totalReceived / activitiesPerAction;

      if (!action.details.asset_1) {
        sentForFee -= BigInt(action.details.amount_1 ?? 0n) / activitiesPerAction;
      } else if (!action.details.asset_2) {
        sentForFee -= BigInt(action.details.amount_2 ?? 0n) / activitiesPerAction;
      }
      break;
    }
    case 'dex_withdraw_liquidity': {
      if (!action.details.asset_1) {
        excess -= BigInt(action.details.amount_1);
      } else if (!action.details.asset_2) {
        excess -= BigInt(action.details.amount_2);
      }

      sentForFee /= 2n;
      excess /= 2n;
      break;
    }
  }

  const realFee = networkFee + sentForFee - excess;

  activity = {
    ...activity,
    fee: realFee,
  };

  delete activity.shouldLoadDetails;

  return { activity, sentForFee, excess };
}

export function getActivityRealFee(activity: ApiActivity) {
  return activity.kind === 'swap' ? fromDecimal(activity.networkFee, TONCOIN.decimals) : activity.fee;
}
