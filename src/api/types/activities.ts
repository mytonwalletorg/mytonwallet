import type { ApiNetwork, ApiNftMarketplace, ApiTransaction } from './misc';

export type ApiActivityReconciliationReason =
  | 'raw'
  | 'local-intent'
  | 'ton-partial-failure-deaggregated';

export type ApiActivityReconciliationMetadata = {
  operationId?: string;
  sourceActionIds: string[];
  hiddenSourceActionIds: string[];
  reason: ApiActivityReconciliationReason;
};

type BaseActivity = {
  id: string;
  shouldHide?: boolean;
  /** Trace external message hash normalized. Not unique but doesn't change in pending activities. Only for TON. */
  externalMsgHashNorm?: string;
  /**
   * Whether more details should be loaded by calling the `fetchTonActivityDetails` action when the activity modal is
   * open. Undefined means "no".
   */
  shouldLoadDetails?: boolean;
  isScam?: boolean;
  extra?: {
    marketplace?: ApiNftMarketplace;
    /** Request identifier from the underlying message where available (TON only) */
    queryId?: string;
    /** SDK-owned source/projection metadata for activity reconciliation. Optional for backwards compatibility. */
    reconciliation?: ApiActivityReconciliationMetadata;
    // TODO Move other extra fields here (externalMsgHash, ...)
  };
};

export type ApiTransactionActivity = BaseActivity & ApiTransaction & {
  kind: 'transaction';
};

export type ApiActivity = ApiTransactionActivity;

export type ApiFetchActivitySliceOptions = {
  accountId: string;
  tokenSlug?: string;
  /** If neither of the timestamps is set, the method must load the latest activities */
  toTimestamp?: number;
  fromTimestamp?: number;
  limit?: number;
  signal?: AbortSignal;
};

export type ApiDecryptCommentOptions = {
  accountId: string;
  activity: ApiTransactionActivity & Required<Pick<ApiTransactionActivity, 'encryptedComment'>>;
  enclaveToken?: string;
};

export type ApiFetchTransactionByIdOptions = {
  network: ApiNetwork;
  walletAddress: string;
  txId: string;
} | {
  network: ApiNetwork;
  walletAddress: string;
  txHash: string;
};
