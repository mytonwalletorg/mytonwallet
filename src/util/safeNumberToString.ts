import { Big } from '../lib/big.js/index.js';

export default function safeNumberToString(value: number, decimals: number) {
  const result = String(value);
  if (result.includes('e-')) {
    Big.NE = -decimals - 1;
    return new Big(result).toString();
  }
  return result;
}
