import { Big } from '../lib/big.js';

export function calcChangeValue(currentPrice: number, changeFactor: number) {
  return currentPrice - currentPrice / (1 + changeFactor);
}

export function calcBigChangeValue(currentPrice: Big | string, changeFactor: Big | number) {
  currentPrice = Big(currentPrice);
  changeFactor = Big(changeFactor);
  return currentPrice.minus(currentPrice.div(changeFactor.plus(1)));
}
