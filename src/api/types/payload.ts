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
  queryId: string;
  newOwner: string;
  responseDestination: string;
  customPayload?: string;
  forwardAmount: string;
  forwardPayload?: string;
  // Specific to UI
  nftAddress: string;
  nftName?: string;
};

export type ApiTokensTransferPayload = {
  type: 'tokens:transfer';
  queryId: string;
  amount: string;
  destination: string;
  responseDestination: string;
  customPayload?: string;
  forwardAmount: string;
  forwardPayload?: string;
  // Specific to UI
  slug: string;
};

export type ApiTokensTransferNonStandardPayload = {
  type: 'tokens:transfer-non-standard';
  queryId: string;
  amount: string;
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
  queryId: string;
  amount: string;
  address: string;
  customPayload?: string;
  // Specific to UI
  slug: string;
  isLiquidUnstakeRequest: boolean;
};

export type ApiLiquidStakingDepositPayload = {
  type: 'liquid-staking:deposit';
  queryId: string;
};

export type ApiLiquidStakingWithdrawalNftPayload = {
  type: 'liquid-staking:withdrawal-nft';
  queryId: string;
};

export type ApiLiquidStakingWithdrawalPayload = {
  type: 'liquid-staking:withdrawal';
  queryId: string;
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
