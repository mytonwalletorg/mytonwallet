export type ApiEmulatedTransaction = {
  /** The fee of the blockchain itself. In contract to the regular transaction's `networkFee`, this is more precise. */
  networkFee: bigint;
  /** TON balance change considering received amount (positive means more was received than sent) */
  change: bigint;
  /** How much TON will be received as a result of the transaction (the sent amount is not deducted) */
  received: bigint;
  /**
   * The real fee in TON (in most cases: sent minus the received). Undefined means that the full fee and the received
   * amount should be shown in the UI.
   */
  realFee?: bigint;
  isTokenOrNft?: boolean;
};

export type ApiEmulationResult = {
  totalNetworkFee: bigint;
  totalRealFee?: bigint;
  totalReceived: bigint;
  totalChange: bigint;
  byTransactionIndex: (ApiEmulatedTransaction & { sent: bigint })[];
};
