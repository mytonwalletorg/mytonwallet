import type { GlobalState } from '../types';

import { explainApiTransferFee, getMaxTransferAmount } from '../../util/fee/transferFee';
import { getChainBySlug, getIsNativeToken } from '../../util/tokens';
import { selectCurrentAccountTokenBalance } from './tokens';

export function selectCurrentTransferMaxAmount(global: GlobalState) {
  const { currentTransfer } = global;
  const chain = getChainBySlug(currentTransfer.tokenSlug);
  const isNativeToken = getIsNativeToken(currentTransfer.tokenSlug);
  const tokenBalance = selectCurrentAccountTokenBalance(global, currentTransfer.tokenSlug);
  const { fullFee, canTransferFullBalance } = explainApiTransferFee({
    fee: currentTransfer.fee,
    realFee: currentTransfer.realFee,
    diesel: currentTransfer.diesel,
    chain,
    isNativeToken,
  });
  return getMaxTransferAmount({
    tokenBalance,
    isNativeToken,
    fullFee: fullFee?.terms,
    canTransferFullBalance,
  });
}
