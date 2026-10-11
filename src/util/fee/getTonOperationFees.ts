import type { ApiStakingType, ApiToken } from '../../api/types';

import { DEFAULT_FEE } from '../../config';
import {
  CLAIM_MINTLESS_AMOUNT,
  TINY_TOKEN_TRANSFER_AMOUNT,
  TINY_TOKEN_TRANSFER_REAL_AMOUNT,
  TOKEN_TRANSFER_AMOUNT,
  TOKEN_TRANSFER_REAL_AMOUNT,
  TON_GAS,
  TON_GAS_REAL,
} from '../../api/chains/ton/constants';

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
    claim: { gas: 0n, real: 0n },
  };
}

/**
 * A pure function guessing the "fee" that needs to be attached to the token transfer.
 * In contrast to the blockchain fee, this fee is a part of the transfer itself.
 *
 * `amount` is what should be attached (acts as a fee for the user);
 * `realAmount` is approximately what will be actually spent (the rest will return in the excess).
 * `amountWithDefaultFee` is amount to send plus default (maximum) network fee.
 *   It is used before emulation is called or when it is absent.
 */
export function getToncoinAmountForTransfer(token: ApiToken, willClaimMintless: boolean) {
  let amount = 0n;
  let realAmount = 0n;

  if (token.isTiny) {
    amount += TINY_TOKEN_TRANSFER_AMOUNT;
    realAmount += TINY_TOKEN_TRANSFER_REAL_AMOUNT;
  } else {
    amount += TOKEN_TRANSFER_AMOUNT;
    realAmount += TOKEN_TRANSFER_REAL_AMOUNT;
  }

  if (willClaimMintless) {
    amount += CLAIM_MINTLESS_AMOUNT;
    realAmount += CLAIM_MINTLESS_AMOUNT;
  }

  return {
    amount,
    realAmount,
    amountWithDefaultFee: amount + DEFAULT_FEE,
  };
}
