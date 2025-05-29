export interface TransferRow {
  receiver: string;
  amount: string;
  tokenIdentifier: string;
  comment?: string;
  resolvedTokenInfo?: {
    tokenAddress: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  resolvedAddress?: string;
}

export interface ValidationError {
  line: number;
  column: number;
  reason: string;
}
