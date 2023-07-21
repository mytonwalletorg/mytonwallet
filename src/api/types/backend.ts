export type ApiSwapEstimateRequest = {
  from: string;
  fromAmount: string;
  to: string;
  slippage: number;
};

export type ApiSwapEstimateResponse = ApiSwapEstimateRequest & {
  toAmount: string;
  toMinAmount: string;
  networkFee: number;
  swapFee: number;
  impact: number;
};

export type ApiSwapBuildRequest = ApiSwapEstimateRequest & {
  toAmount: string;
  toMinAmount: string;
  slippage: number;
  fromAddress: string;
  dexLabel: string;
};

export type ApiSwapBuildResponse = ApiSwapBuildRequest & {
  transfer: {
    toAddress: string;
    amount: string;
    payload: string;
  };
};

export type ApiSwapCurrency = {
  name: string;
  symbol: string;
  image: string;
  blockchain: string;
  slug: string;
  contract?: string;
  decimals?: number;
};

export type ApiSwapTonCurrency = ApiSwapCurrency & {
  blockchain: 'ton';
  decimals: number;
};

export type ApiSwapShortCurrency = {
  name: string;
  symbol: string;
  slug: string;
};
