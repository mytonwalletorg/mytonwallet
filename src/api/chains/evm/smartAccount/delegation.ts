import type { ApiNetwork, EVMChain } from '../../../types';
import type { EvmMetaTransaction } from './types';

import { normalizeAddress } from '../address';
import { getEvmDelegationAddress } from '../approvals';
import { ALCHEMY_7702_DELEGATEE_ADDRESSES } from './constants';

// Reset foreign delegation before submitting batch user operation if user has one.
export function withForeignDelegationResetCall(
  address: string,
  transactions: EvmMetaTransaction[],
  foreignDelegation?: string,
): EvmMetaTransaction[] {
  if (!foreignDelegation) {
    return transactions;
  }

  return [{
    to: address,
    value: 0n,
    data: '0x',
  }, ...transactions];
}

export function resolveBatchDelegation(activeDelegate: string | undefined): {
  foreignDelegation?: string;
  shouldDelegate: boolean;
} {
  if (!activeDelegate) {
    return { shouldDelegate: true };
  }

  const normalized = normalizeAddress(activeDelegate);
  if (ALCHEMY_7702_DELEGATEE_ADDRESSES.has(normalized.toLowerCase())) {
    return { shouldDelegate: false };
  }

  return { foreignDelegation: normalized, shouldDelegate: true };
}

export async function isAlchemy7702Delegated(
  chain: EVMChain,
  network: ApiNetwork,
  address: string,
): Promise<boolean> {
  const activeDelegate = await getEvmDelegationAddress(chain, network, address);

  if (!activeDelegate) return false;

  return ALCHEMY_7702_DELEGATEE_ADDRESSES.has(normalizeAddress(activeDelegate).toLowerCase());
}

export async function getForeignEvmDelegationAddress(
  chain: EVMChain,
  network: ApiNetwork,
  address: string,
): Promise<string | undefined> {
  const activeDelegate = await getEvmDelegationAddress(chain, network, address);

  return resolveBatchDelegation(activeDelegate).foreignDelegation;
}
