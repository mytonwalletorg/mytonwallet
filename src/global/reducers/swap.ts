import type { ApiSwapEstimateResponse } from '../../api/types';
import type { GlobalState } from '../types';
import { SwapState } from '../types';

import { DEFAULT_SLIPPAGE_VALUE, TONCOIN_SLUG } from '../../config';
import { fromDecimal, toDecimal } from '../../util/decimals';
import { TOKEN_TRANSFER_TONCOIN_AMOUNT } from '../../api/blockchains/ton/constants';
import { selectAccountState } from '../selectors';

export function updateCurrentSwap(global: GlobalState, update: Partial<GlobalState['currentSwap']>) {
  return {
    ...global,
    currentSwap: {
      ...global.currentSwap,
      ...update,
    },
  };
}

export function clearCurrentSwap(global: GlobalState) {
  return {
    ...global,
    currentSwap: {
      state: SwapState.None,
      slippage: DEFAULT_SLIPPAGE_VALUE,
    },
  };
}

export function updateCurrentSwapFee(
  global: GlobalState,
  estimate: ApiSwapEstimateResponse,
  additionalTonAmount: string,
) {
  const accountState = selectAccountState(global, global.currentAccountId!);
  const balance = accountState?.balances?.bySlug[TONCOIN_SLUG] ?? 0n;

  const compositeFee = fromDecimal(estimate.networkFee) + TOKEN_TRANSFER_TONCOIN_AMOUNT;
  const updatedBalance = balance - fromDecimal(additionalTonAmount);

  const networkFee = updatedBalance < compositeFee
    ? Number(toDecimal(compositeFee)) : estimate.networkFee;

  const realNetworkFee = networkFee === estimate.networkFee
    ? estimate.realNetworkFee : networkFee;

  return updateCurrentSwap(global, { networkFee, realNetworkFee });
}
