export type ApiEmulatedTransaction = {
  /** The network fee in TON (the fee taken by the blockchain itself) */
  fee: bigint;
  /** How much TON will be received as a result of the transaction (the sent amount is not deducted) */
  received: bigint;
};

export type ApiEmulationResult = {
  totalFee: bigint;
  totalReceived: bigint;
  byTransactionIndex: ApiEmulatedTransaction[];
};
