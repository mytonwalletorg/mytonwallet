export default function shiftDecimals(
  amount: number,
  fromDecimals: number,
  toDecimals: number,
): number {
  if (toDecimals >= fromDecimals) return amount;

  return Number(amount.toFixed(toDecimals));
}
