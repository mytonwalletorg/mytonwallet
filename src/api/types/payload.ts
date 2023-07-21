export type ApiCommentPayload = {
  type: 'comment';
  comment: string;
};

export type ApiEncryptedCommentPayload = {
  type: 'encrypted-comment';
  encryptedComment: string;
};

export type ApiTransferNftPayload = {
  type: 'transfer-nft';
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

export type ApiTransferTokensPayload = {
  type: 'transfer-tokens';
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

export type ApiTransferTokensNonStandardPayload = {
  type: 'transfer-tokens:non-standard';
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

export type ApiParsedPayload = ApiCommentPayload
| ApiEncryptedCommentPayload
| ApiTransferNftPayload
| ApiTransferTokensPayload
| ApiTransferTokensNonStandardPayload
| ApiUnknownPayload;
