import type { ApiStakingType } from '../../api/types';

import { DEFAULT_FEE } from '../../config';
import { TON_GAS, TON_GAS_REAL } from '../../api/chains/ton/constants';

type TonOperationFees = {
  gas: bigint;
  real: bigint;
};

export default function getTonOperationFees(operation: keyof typeof TON_GAS_REAL): TonOperationFees {
  return {
    gas: TON_GAS[operation] + DEFAULT_FEE,
    real: TON_GAS_REAL[operation],
  };
}

export function getTonStakingFees(type?: ApiStakingType): {
  stake: TonOperationFees;
  unstake: TonOperationFees;
  claim?: TonOperationFees;
} {
  switch (type) {
    case 'nominators': {
      return {
        stake: getTonOperationFees('stakeNominators'),
        unstake: getTonOperationFees('unstakeNominators'),
      };
    }
    case 'liquid': {
      return {
        stake: getTonOperationFees('stakeLiquid'),
        unstake: getTonOperationFees('unstakeLiquid'),
      };
    }
    case 'jetton': {
      return {
        stake: getTonOperationFees('stakeJettons'),
        unstake: getTonOperationFees('unstakeJettons'),
        claim: getTonOperationFees('claimJettons'),
      };
    }
  }

  return {
    stake: { gas: 0n, real: 0n },
    unstake: { gas: 0n, real: 0n },
  };
}
