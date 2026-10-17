export type TokenBalanceChange =
  | { type: 'chart'; price: number; initialPrice: number }
  | { type: 'change24h' }
  | { type: 'loading' }
  | { type: 'empty' };

const CHANGE_24H: TokenBalanceChange = { type: 'change24h' };
const LOADING: TokenBalanceChange = { type: 'loading' };
const EMPTY: TokenBalanceChange = { type: 'empty' };

interface Params {
  shouldUseChange24h: boolean;
  isLoading: boolean;
  price?: number;
  initialPrice?: number;
}

export function resolveBalanceChange({
  shouldUseChange24h, isLoading, price, initialPrice,
}: Params): TokenBalanceChange {
  if (shouldUseChange24h) return CHANGE_24H;
  if (isLoading) return LOADING;
  // Falling back to the 24h change here would show another period than the chart
  if (price === undefined || !initialPrice) return EMPTY;

  return { type: 'chart', price, initialPrice };
}
