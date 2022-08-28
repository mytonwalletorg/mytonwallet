export function round(value: number, precision = 0) {
  return parseFloat(value.toFixed(precision));
}
