import type { GlobalState } from '../types';
import { SwapState } from '../types';

import { DEFAULT_SLIPPAGE_VALUE } from '../../config';

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
