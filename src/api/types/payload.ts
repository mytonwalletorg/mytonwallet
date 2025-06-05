import type { DNS_CATEGORY_HASH_MAP } from '../chains/ton/constants';
import type { ApiNft } from './misc';

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
  nft?: ApiNft;
  comment?: string;
};

export type ApiNftOwnershipAssignedPayload = {
  type: 'nft:ownership-assigned';
  queryId: bigint;
  prevOwner: string;
  // Specific to UI
  nftAddress: string;
  nft?: ApiNft;
  comment?: string;
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
  forwardPayloadOpCode?: number;
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
  appId?: bigint;
};

export type ApiLiquidStakingWithdrawalNftPayload = {
  type: 'liquid-staking:withdrawal-nft';
  queryId: bigint;
};

export type ApiLiquidStakingWithdrawalPayload = {
  type: 'liquid-staking:withdrawal';
  queryId: bigint;
};

export type ApiTokenBridgePaySwap = {
  type: 'token-bridge:pay-swap';
  queryId: bigint;
  swapId: string;
};

export type ApiDnsChangeRecord = {
  type: 'dns:change-record';
  queryId: bigint;
  record: {
    type: keyof typeof DNS_CATEGORY_HASH_MAP;
    value?: string;
    flags?: number;
  } | {
    type: 'unknown';
    key: string;
    value?: string;
  };
  // Specific to UI
  domain: string;
};

export type ApiVestingAddWhitelistPayload = {
  type: 'vesting:add-whitelist';
  queryId: bigint;
  address: string;
};

export type ApiSingleNominatorWithdrawPayload = {
  type: 'single-nominator:withdraw';
  queryId: bigint;
  amount: bigint;
};

export type ApiSingleNominatorChangeValidatorPayload = {
  type: 'single-nominator:change-validator';
  queryId: bigint;
  address: string;
};

export type ApiLiquidStakingVotePayload = {
  type: 'liquid-staking:vote';
  queryId: bigint;
  votingAddress: string;
  expirationDate: number;
  vote: boolean;
  needConfirmation: boolean;
};

export type ApiJettonStakePayload = {
  type: 'jetton-staking:unstake';
  queryId: bigint;
  amount: bigint;
  isForce: boolean;
};

export type ApiParsedPayload = ApiCommentPayload
  | ApiEncryptedCommentPayload
  | ApiNftTransferPayload
  | ApiNftOwnershipAssignedPayload
  | ApiTokensTransferPayload
  | ApiTokensTransferNonStandardPayload
  | ApiUnknownPayload
  | ApiTokensBurnPayload
  | ApiLiquidStakingDepositPayload
  | ApiLiquidStakingWithdrawalPayload
  | ApiLiquidStakingWithdrawalNftPayload
  | ApiTokenBridgePaySwap
  | ApiDnsChangeRecord
  | ApiVestingAddWhitelistPayload
  | ApiSingleNominatorWithdrawPayload
  | ApiSingleNominatorChangeValidatorPayload
  | ApiLiquidStakingVotePayload
  | ApiJettonStakePayload;
