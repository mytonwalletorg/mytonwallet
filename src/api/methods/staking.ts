import type {
  ApiChain,
  ApiJettonStakingState,
  ApiStakingState,
} from '../types';
import { ApiCommonError } from '../types';

import { logDebugError } from '../../util/logs';
import { getChainBySlug } from '../../util/tokens';
import chains from '../chains';
import { fetchStoredWallet } from '../common/accounts';
import { setStakingCommonCache } from '../common/cache';
import { createLocalTransactions } from './transfer';

export function initStaking() {}

/** The chain a staking state belongs to, and its staking implementation, both keyed by the state's token. */
function resolveStaking(state: ApiStakingState) {
  const chain = getChainBySlug(state.tokenSlug);
  const staking = chains[chain]?.staking;
  if (!staking) {
    throw new Error(`Staking is not supported for ${chain}`);
  }

  return { chain, staking };
}

export async function checkStakeDraft(accountId: string, amount: bigint, state: ApiStakingState) {
  return resolveStaking(state).staking.checkStakeDraft(accountId, amount, state);
}

export async function checkUnstakeDraft(accountId: string, amount: bigint, state: ApiStakingState) {
  return resolveStaking(state).staking.checkUnstakeDraft(accountId, amount, state);
}

export async function submitStake(
  accountId: string,
  enclaveToken: string | undefined,
  amount: bigint,
  state: ApiStakingState,
  realFee?: bigint,
) {
  const { chain, staking } = resolveStaking(state);
  const { address: fromAddress } = await fetchStoredWallet(accountId, chain);

  const result = await staking.submitStake(accountId, enclaveToken, amount, state);

  if ('error' in result) {
    return result;
  }

  if (!result.txId) {
    return { error: ApiCommonError.Unexpected };
  }

  const [localActivity] = createLocalTransactions(accountId, chain, [{
    id: result.txId,
    amount,
    fromAddress,
    fee: realFee ?? 0n,
    type: 'stake',
    slug: state.tokenSlug,
    ...result.localActivityParams,
  }]);

  return {
    activityId: localActivity.id,
  };
}

export async function submitUnstake(
  accountId: string,
  enclaveToken: string | undefined,
  tokenAmount: bigint,
  state: ApiStakingState,
  realFee?: bigint,
) {
  const { chain, staking } = resolveStaking(state);
  const { address: fromAddress } = await fetchStoredWallet(accountId, chain);

  const result = await staking.submitUnstake(accountId, enclaveToken, tokenAmount, state);
  if ('error' in result) {
    return result;
  }

  if (!result.txId) {
    return { error: ApiCommonError.Unexpected };
  }

  const [localActivity] = createLocalTransactions(accountId, chain, [{
    id: result.txId,
    amount: 0n, // Always 0, because all the gas send for the unstaking is in the fee
    fromAddress,
    fee: realFee ?? 0n,
    type: 'unstakeRequest',
    ...result.localActivityParams,
  }]);

  return {
    activityId: localActivity.id,
  };
}

export async function tryUpdateStakingCommonData() {
  for (const chain of Object.keys(chains) as ApiChain[]) {
    const staking = chains[chain].staking;
    if (!staking) continue;

    try {
      setStakingCommonCache(chain, await staking.getCommonData());
    } catch (err) {
      logDebugError('tryUpdateStakingCommonData', err);
    }
  }
}

export async function submitStakingClaimOrUnlock(
  accountId: string,
  enclaveToken: string | undefined,
  state: ApiJettonStakingState,
  realFee?: bigint,
) {
  const { chain, staking } = resolveStaking(state);
  const { address: walletAddress } = await fetchStoredWallet(accountId, chain);

  const result = await staking.submitTokenStakingClaim(accountId, enclaveToken, state);

  if ('error' in result) {
    return result;
  }

  if (!result.txId) {
    return { error: ApiCommonError.Unexpected };
  }

  const [localActivity] = createLocalTransactions(accountId, chain, [{
    id: result.txId,
    fromAddress: walletAddress,
    fee: realFee ?? 0n,
    ...result.localActivityParams,
  }]);

  return {
    activityId: localActivity.id,
  };
}
