export type ApiSubmitTransferTronResult = {
  toAddress: string;
  amount: bigint;
  txId: string;
} | {
  error: string;
};
