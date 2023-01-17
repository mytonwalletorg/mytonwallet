export function calcChangeValue(currentPrice: number, changeFactor: number) {
  return currentPrice - currentPrice / (1 + changeFactor);
}
