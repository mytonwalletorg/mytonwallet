export function round(value: number, precision = 0) {
  return parseFloat(value.toFixed(precision));
}

export function floor(value: number, precision = 0) {
  if (precision === 0) {
    return Math.floor(value);
  }

  const convFactor = 10 ** precision;
  return round(Math.floor(value * convFactor) / convFactor, precision);
}
