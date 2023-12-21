import type { ApiSwapAsset } from '../../api/types';

import { TON_SYMBOL } from '../../config';
import { Big } from '../../lib/big.js';
import { formatInteger } from '../formatNumber';

const BTC = new Set(['jWBTC', 'oWBTC', 'BTC']);
const USD = new Set(['jUSDT', 'oUSDT', 'USDT', 'jUSDC', 'oUSDC', 'USDC']);

const LARGE_NUMBER = 1000;

export default function getSwapRate(
  fromAmount?: string,
  toAmount?: string,
  fromToken?: ApiSwapAsset,
  toToken?: ApiSwapAsset,
  shouldTrimLargeNumber = false,
) {
  if (!fromAmount || !toAmount || !fromToken || !toToken) {
    return undefined;
  }

  let firstCurrencySymbol = fromToken.symbol;
  let secondCurrencySymbol = toToken.symbol;
  let price: string;

  if (
    BTC.has(secondCurrencySymbol)
    || (USD.has(secondCurrencySymbol) && firstCurrencySymbol !== TON_SYMBOL)
    || (USD.has(firstCurrencySymbol) && secondCurrencySymbol === TON_SYMBOL)
    || (firstCurrencySymbol === TON_SYMBOL && !USD.has(secondCurrencySymbol))
  ) {
    firstCurrencySymbol = toToken.symbol;
    secondCurrencySymbol = fromToken.symbol;
    const ratio = new Big(fromAmount).div(toAmount);
    const isLargeNumber = shouldTrimLargeNumber && ratio.gte(LARGE_NUMBER);
    price = formatInteger(ratio.toNumber(), isLargeNumber ? 0 : 2);
  } else {
    const ratio = new Big(toAmount).div(fromAmount);
    const isLargeNumber = shouldTrimLargeNumber && ratio.gte(LARGE_NUMBER);
    price = formatInteger(ratio.toNumber(), isLargeNumber ? 0 : 2);
  }

  return {
    firstCurrencySymbol,
    secondCurrencySymbol,
    price,
  };
}
