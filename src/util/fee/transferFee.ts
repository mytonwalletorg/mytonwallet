import type { ApiCheckTransactionDraftResult, ApiFetchEstimateDieselResult } from '../../api/chains/ton/types';
import type { ApiChain } from '../../api/types';
import type { FeePrecision, FeeTerms } from './types';

import { Big } from '../../lib/big.js';
import { bigintMax, bigintMin } from '../bigint';

type ApiFee = Pick<ApiCheckTransactionDraftResult, 'fee' | 'realFee' | 'diesel'> & {
  /** Undefined means that the chain is unknown */
  chain: ApiChain | undefined;
  /** True if the chain's native token is being transferred, otherwise false */
  isNativeToken: boolean;
};

type ExplainedTransferFee = {
  /** Whether the result implies paying the fee with a diesel */
  isGasless: boolean;
  /**
   * The fee that will be sent with the transfer. The wallet must have it on the balance to send the transfer.
   * Show this in the transfer form when the input amount is ≤ the balance, but the remaining balance can't cover the
   * full fee; show `realFee` otherwise. Undefined means that it's unknown.
   */
  fullFee?: {
    precision: FeePrecision;
    terms: FeeTerms;
  };
  /**
   * The real fee (the full fee minus the excess). Undefined means that it's unknown. There is no need to fall back to
   * `fullFee` when `realFee` is undefined (because it's undefined too in this case).
   */
  realFee?: {
    precision: FeePrecision;
    terms: FeeTerms;
  };
  /**
   * Whether the full token balance can be transferred despite the fee.
   * If yes, the fee will be taken from the transferred amount.
   */
  canTransferFullBalance: boolean;
};

type ApiFeeWithDiesel = ApiFee & { diesel: ApiFetchEstimateDieselResult };

type MaxTransferAmountInput = {
  /** The wallet balance of the transferred token. Undefined means that it's unknown. */
  tokenBalance: bigint | undefined;
  /** True if the chain's native token is being transferred, otherwise false. */
  isNativeToken: boolean;
  /** The full fee terms calculated by `explainApiTransferFee`. Undefined means that they're unknown. */
  fullFee: FeeTerms | undefined;
  /** Whether the full token balance can be transferred despite the fee. */
  canTransferFullBalance: boolean;
};

/**
 * Converts the transfer fee data returned from API into data that is ready to be displayed in the transfer form UI.
 */
export function explainApiTransferFee(input: ApiFee): ExplainedTransferFee {
  return shouldUseDiesel(input)
    ? explainGaslessTransferFee(input)
    : explainGasfullTransferFee(input);
}

/**
 * Calculates the maximum amount available for the transfer.
 * Returns undefined when it can't be calculated because of insufficient input data.
 */
export function getMaxTransferAmount({
  tokenBalance,
  isNativeToken,
  fullFee,
  canTransferFullBalance,
}: MaxTransferAmountInput): bigint | undefined {
  if (tokenBalance === undefined) {
    return undefined;
  }

  // Returning the full balance when the fee is unknown for a better UX
  if (canTransferFullBalance || !fullFee) {
    return tokenBalance;
  }

  let fee = fullFee.token ?? 0n;
  if (isNativeToken) {
    // When `isNativeToken` is true, both `token` and `native` refer to the same currency, so they should be added
    fee += fullFee.native ?? 0n;
  }

  return bigintMax(tokenBalance - fee, 0n);
}

function shouldUseDiesel(input: ApiFee): input is ApiFeeWithDiesel {
  return input.diesel !== undefined
    && input.diesel.status !== 'not-available';
}

/**
 * Converts the data of a transfer not involving diesel
 */
function explainGasfullTransferFee(input: ApiFee) {
  const result: ExplainedTransferFee = {
    isGasless: false,
    canTransferFullBalance: input.chain === 'ton' && input.isNativeToken,
  };

  if (input.fee !== undefined) {
    result.fullFee = {
      precision: input.realFee === input.fee ? 'exact' : 'lessThan',
      terms: { native: input.fee },
    };
    result.realFee = result.fullFee;
  }

  if (input.realFee !== undefined) {
    result.realFee = {
      precision: input.realFee === input.fee ? 'exact' : 'approximate',
      terms: { native: input.realFee },
    };
  }

  return result;
}

/**
 * Converts the diesel of semi-diesel transfer data
 */
function explainGaslessTransferFee({ diesel }: ApiFeeWithDiesel) {
  const isStarsDiesel = diesel.status === 'stars-fee';
  const dieselKey = isStarsDiesel ? 'stars' : 'token';
  const dieselAmount = diesel.amount[dieselKey];
  const realFeeInDiesel = convertFee(diesel.realFee, diesel.nativeAmount, dieselAmount);
  // Cover as much displayed real fee as possible with diesel, because in the excess it will return as the native token.
  const dieselRealFee = bigintMin(dieselAmount, realFeeInDiesel);
  // Cover the remaining real fee with the native token.
  const nativeRealFee = convertFee(realFeeInDiesel - dieselRealFee, dieselAmount, diesel.nativeAmount);

  return {
    isGasless: true,
    canTransferFullBalance: false,
    fullFee: {
      precision: 'lessThan',
      terms: {
        native: diesel.remainingFee,
        token: diesel.amount.token,
        stars: diesel.amount.stars,
      },
    },
    realFee: {
      precision: 'approximate',
      terms: {
        native: nativeRealFee,
        [dieselKey]: dieselRealFee,
      },
    },
  } satisfies ExplainedTransferFee;
}

/**
 * `exampleFromAmount` and `exampleToAmount` define the exchange rate used to convert `amount`.
 * `exampleFromAmount` is defined in the same currency as `amount`.
 * `exampleToAmount` is defined in the currency you want to get.
 */
function convertFee(
  amount: bigint,
  exampleFromAmount: bigint,
  exampleToAmount: bigint,
) {
  const exchangeRate = Big(exampleToAmount.toString()).div(exampleFromAmount.toString());
  return BigInt(Big(amount.toString()).mul(exchangeRate).round().toString());
}
