import { ApiToken, ApiTransaction, ApiTransactionDraftError } from './misc';

export type ApiUpdateBalance = {
  type: 'updateBalance';
  accountId: string;
  slug: string;
  balance: string;
};

export type ApiUpdateNewTransaction = {
  type: 'newTransaction';
  transaction: ApiTransaction;
};

export type ApiUpdateTokens = {
  type: 'updateTokens';
  tokens: Record<string, ApiToken>;
};

export type ApiUpdateCreateTransaction = {
  type: 'createTransaction';
  promiseId: string;
  toAddress: string;
  amount: string;
  fee: string;
  comment?: string;
};

export type ApiUpdateCreateSignature = {
  type: 'createSignature';
  promiseId: string;
  dataHex: string;
};

export type ApiUpdateTxComplete = {
  type: 'updateTxComplete';
  toAddress: string;
  amount: string;
  txId: string;
};

export type ApiUpdateShowTxDraftError = {
  type: 'showTxDraftError';
  error?: ApiTransactionDraftError;
};

export type ApiUpdateTonProxyState = {
  type: 'updateTonProxyState';
  isEnabled: boolean;
};

export type ApiUpdateTonMagicState = {
  type: 'updateTonMagicState';
  isEnabled: boolean;
};

export type ApiUpdate =
  ApiUpdateBalance
  | ApiUpdateNewTransaction
  | ApiUpdateTokens
  | ApiUpdateCreateTransaction
  | ApiUpdateCreateSignature
  | ApiUpdateTxComplete
  | ApiUpdateShowTxDraftError
  | ApiUpdateTonProxyState
  | ApiUpdateTonMagicState;

export type OnApiUpdate = (update: ApiUpdate) => void;
