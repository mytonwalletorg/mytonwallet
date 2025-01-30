import type { GlobalState } from '../types';

import { explainApiTransferFee, getMaxTransferAmount } from '../../util/fee/transferFee';
import { selectCurrentAccountTokenBalance } from './tokens';

export function selectCurrentTransferMaxAmount(global: GlobalState) {
  const { currentTransfer } = global;
  const tokenBalance = selectCurrentAccountTokenBalance(global, currentTransfer.tokenSlug);
  const { fullFee, canTransferFullBalance } = explainApiTransferFee(currentTransfer);
  return getMaxTransferAmount({
    tokenBalance,
    tokenSlug: currentTransfer.tokenSlug,
    fullFee: fullFee?.terms,
    canTransferFullBalance,
  });
}
