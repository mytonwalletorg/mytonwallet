export type ApiCommentPayload = {
  type: 'comment';
  comment: string;
};

export type ApiEncryptedCommentPayload = {
  type: 'encrypted-comment';
  encryptedComment: string;
};

export type ApiNftTransferPayload = {
  type: 'nft:transfer';
  queryId: bigint;
  newOwner: string;
  responseDestination: string;
  customPayload?: string;
  forwardAmount: bigint;
  forwardPayload?: string;
  // Specific to UI
  nftAddress: string;
  nftName?: string;
};

export type ApiTokensTransferPayload = {
  type: 'tokens:transfer';
  queryId: bigint;
  amount: bigint;
  destination: string;
  responseDestination: string;
  customPayload?: string;
  forwardAmount: bigint;
  forwardPayload?: string;
  // Specific to UI
  slug: string;
};

export type ApiTokensTransferNonStandardPayload = {
  type: 'tokens:transfer-non-standard';
  queryId: bigint;
  amount: bigint;
  destination: string;
  // Specific to UI
  slug: string;
};

export type ApiUnknownPayload = {
  type: 'unknown';
  base64: string;
};

export type ApiTokensBurnPayload = {
  type: 'tokens:burn';
  queryId: bigint;
  amount: bigint;
  address: string;
  customPayload?: string;
  // Specific to UI
  slug: string;
  isLiquidUnstakeRequest: boolean;
};

export type ApiLiquidStakingDepositPayload = {
  type: 'liquid-staking:deposit';
  queryId: bigint;
};

export type ApiLiquidStakingWithdrawalNftPayload = {
  type: 'liquid-staking:withdrawal-nft';
  queryId: bigint;
};

export type ApiLiquidStakingWithdrawalPayload = {
  type: 'liquid-staking:withdrawal';
  queryId: bigint;
};

export type ApiParsedPayload = ApiCommentPayload
| ApiEncryptedCommentPayload
| ApiNftTransferPayload
| ApiTokensTransferPayload
| ApiTokensTransferNonStandardPayload
| ApiUnknownPayload
| ApiTokensBurnPayload
| ApiLiquidStakingDepositPayload
| ApiLiquidStakingWithdrawalPayload
| ApiLiquidStakingWithdrawalNftPayload;
