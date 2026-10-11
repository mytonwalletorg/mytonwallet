import type {
  ApiActivity,
  ApiDecryptCommentOptions,
  ApiFetchActivitySliceOptions,
  ApiNetwork,
} from '../../types';
import type { ParsedAction, ParsedTrace, TraceOutput } from './types';

import { TONCOIN } from '../../../config';
import { pauseWithAbortSignal, raceWithAbortSignal } from '../../../util/abortSignal';
import { parseAccountId } from '../../../util/account';
import { getActivityTokenSlugs, getIsActivityPending } from '../../../util/activities';
import { toDecimal } from '../../../util/decimals';
import { logDebug, logDebugError } from '../../../util/logs';
import withCacheAsync from '../../../util/withCacheAsync';
import { getSigner } from './util/signer';
import { fetchTokenWalletAddress, resolveTokenWalletAddress } from './util/tonCore';
import { fetchStoredChainAccount, fetchStoredWallet } from '../../common/accounts';
import { getTokenBySlug, tokensPreload } from '../../common/tokens';
import { SEC } from '../../constants';
import { fetchActions, fetchTransactions, parseActionActivityId } from './toncenter';
import { fetchAndParseTrace } from './traces';

const GET_TRANSACTIONS_LIMIT = 128;

const TRACE_ATTEMPT_COUNT = 5;
const TRACE_RETRY_DELAY = SEC;

export const checkHasTransaction = withCacheAsync(fetchHasTransaction);

export async function fetchHasTransaction(network: ApiNetwork, address: string, signal?: AbortSignal) {
  const transactions = await fetchTransactions({
    network,
    address,
    limit: 1,
    signal,
  });
  return Boolean(transactions.length);
}

export async function fetchActivitySlice({
  accountId,
  tokenSlug,
  toTimestamp,
  fromTimestamp,
  limit,
  signal,
}: ApiFetchActivitySliceOptions): Promise<ApiActivity[]> {
  const { network } = parseAccountId(accountId);
  const { address } = await fetchStoredWallet(accountId, 'ton');
  let activities: ApiActivity[];

  if (!tokenSlug) {
    activities = await fetchActions({
      network,
      filter: { address },
      walletAddress: address,
      limit: limit ?? GET_TRANSACTIONS_LIMIT,
      fromTimestamp,
      toTimestamp,
      signal,
    });
  } else {
    let tokenWalletAddress = address;

    if (tokenSlug !== TONCOIN.slug) {
      await raceWithAbortSignal(tokensPreload.promise, signal);
      const token = getTokenBySlug(tokenSlug);
      if (!token?.tokenAddress) {
        // Returning [] would make upstream `addPastActivities` set
        // `isHistoryEndReachedBySlug[tokenSlug]=true` and stop polling this slug.
        // Throwing makes `callApi` return undefined - the next cycle retries.
        throw new Error(`fetchActivitySlice: token ${tokenSlug} not in cache`);
      }
      tokenWalletAddress = signal
        ? await fetchTokenWalletAddress(network, address, token.tokenAddress, signal)
        : await resolveTokenWalletAddress(network, address, token.tokenAddress);
    }

    activities = await fetchActions({
      network,
      filter: { address: tokenWalletAddress },
      walletAddress: address,
      limit: limit ?? GET_TRANSACTIONS_LIMIT,
      fromTimestamp,
      toTimestamp,
      signal,
    });

    activities = activities.filter((activity) => getActivityTokenSlugs(activity).includes(tokenSlug));
  }

  return activities;
}

export async function decryptComment({ accountId, activity, enclaveToken }: ApiDecryptCommentOptions) {
  const account = await fetchStoredChainAccount(accountId, 'ton');
  const signer = getSigner(accountId, account, enclaveToken);
  return signer.decryptComment(Buffer.from(activity.encryptedComment, 'base64'), activity.fromAddress);
}

export async function fetchActivityDetails(
  accountId: string,
  activity: ApiActivity,
  signal?: AbortSignal,
): Promise<ApiActivity | undefined> {
  const { network } = parseAccountId(accountId);
  const { address: walletAddress } = await fetchStoredWallet(accountId, 'ton');
  let result: ApiActivity | undefined;

  // The trace can be unavailable immediately after the action is received, so a couple of delayed retries are made
  for (let attempt = 0; attempt < TRACE_ATTEMPT_COUNT && !result; attempt++) {
    if (attempt > 0) {
      await pauseWithAbortSignal(TRACE_RETRY_DELAY, signal);
    }

    const parsedTrace = await fetchAndParseTrace(
      network,
      walletAddress,
      activity.externalMsgHashNorm!,
      getIsActivityPending(activity),
      signal,
    );
    if (!parsedTrace) {
      continue;
    }

    result = fillActivityDetails(activity, parsedTrace);
  }

  if (!result) {
    logDebugError('Trace unavailable for activity', activity.id);
  }

  return result ?? activity;
}

export function fillActivityDetails(activity: ApiActivity, parsedTrace: ParsedTrace): ApiActivity {
  const { actionId } = parseActionActivityId(activity.id);
  const { traceOutput, parsedAction } = findParsedAction(parsedTrace, actionId) ?? {};

  if (!traceOutput || !parsedAction) {
    return { ...activity, shouldLoadDetails: undefined };
  }

  const { action } = parsedAction;
  const { realFee } = traceOutput;

  activity = { ...activity, fee: realFee };

  activity = { ...activity, shouldLoadDetails: undefined };

  logDebug('Calculation of fee for action', {
    actionId: action.action_id,
    externalMsgHashNorm: activity.externalMsgHashNorm,
    activityStatus: activity.status,
    networkFee: toDecimal(traceOutput.networkFee),
    realFee: toDecimal(getActivityRealFee(activity)),
    details: action.details,
  });

  return activity;
}

function findParsedAction(parsedTrace: ParsedTrace, actionId: string): {
  traceOutput: TraceOutput;
  parsedAction: ParsedAction;
} | undefined {
  for (const traceOutput of parsedTrace.traceOutputs) {
    for (const parsedAction of traceOutput.walletActions) {
      if (parsedAction.action.action_id === actionId) {
        return { traceOutput, parsedAction };
      }
    }
  }

  return undefined;
}

export function getActivityRealFee(activity: ApiActivity) {
  return activity.fee;
}
