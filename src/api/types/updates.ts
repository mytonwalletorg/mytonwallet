import type { ApiTonConnectProof } from '../tonConnect/types';
import type { ApiActivity, ApiTransactionActivity } from './activity';
import type { ApiAnyDisplayError } from './errors';
import type {
  ApiBackendStakingState,
  ApiDappTransaction,
  ApiNft,
  ApiStakingState,
  ApiToken,
} from './misc';
import type { ApiParsedPayload } from './payload';
import type { ApiDapp } from './storage';

export type ApiUpdateBalance = {
  type: 'updateBalance';
  accountId: string;
  slug: string;
  balance: string;
};

export type ApiUpdateNewActivities = {
  type: 'newActivities';
  accountId: string;
  activities: ApiActivity[];
};

export type ApiUpdateNewLocalTransaction = {
  type: 'newLocalTransaction';
  accountId: string;
  transaction: ApiTransactionActivity;
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
  rawPayload?: string;
  parsedPayload?: ApiParsedPayload;
  stateInit?: string;
};

export type ApiUpdateCreateSignature = {
  type: 'createSignature';
  promiseId: string;
  dataHex: string;
};

export type ApiUpdateTxComplete = {
  type: 'updateTxComplete';
  accountId: string;
  toAddress: string;
  amount: string;
  txId: string;
  localTxId: string;
};

export type ApiUpdateShowError = {
  type: 'showError';
  error?: ApiAnyDisplayError;
};

export type ApiUpdateStakingState = {
  type: 'updateStakingState';
  accountId: string;
  stakingState: ApiStakingState;
};

export type ApiUpdateBackendStakingState = {
  type: 'updateBackendStakingState';
  backendStakingState: ApiBackendStakingState;
};

export type ApiUpdateActiveDapp = {
  type: 'updateActiveDapp';
  accountId: string;
  origin?: string;
};

export type ApiUpdateDappSendTransactions = {
  type: 'dappSendTransactions';
  promiseId: string;
  accountId: string;
  dapp: ApiDapp;
  transactions: ApiDappTransaction[];
  fee: string;
};

export type ApiUpdateDappConnect = {
  type: 'dappConnect';
  promiseId: string;
  accountId: string;
  dapp: ApiDapp;
  permissions: {
    address: boolean;
    proof: boolean;
  };
  proof?: ApiTonConnectProof;
};

export type ApiUpdateDappDisconnect = {
  type: 'dappDisconnect';
  accountId: string;
  origin: string;
};

export type ApiUpdatePrepareTransaction = {
  type: 'prepareTransaction';
  toAddress: string;
  amount?: string;
  comment?: string;
};

export type ApiUpdateNfts = {
  type: 'updateNfts';
  accountId: string;
  nfts: ApiNft[];
};

export type ApiUpdateNftReceived = {
  type: 'nftReceived';
  accountId: string;
  nftAddress: string;
  nft: ApiNft;
};

export type ApiUpdateNftSent = {
  type: 'nftSent';
  accountId: string;
  nftAddress: string;
};

export type ApiUpdateNftPutUpForSale = {
  type: 'nftPutUpForSale';
  accountId: string;
  nftAddress: string;
};

export type ApiNftUpdate = ApiUpdateNftReceived | ApiUpdateNftSent | ApiUpdateNftPutUpForSale;

export type ApiUpdate =
  ApiUpdateBalance
  | ApiUpdateNewActivities
  | ApiUpdateNewLocalTransaction
  | ApiUpdateTokens
  | ApiUpdateCreateTransaction
  | ApiUpdateCreateSignature
  | ApiUpdateTxComplete
  | ApiUpdateStakingState
  | ApiUpdateActiveDapp
  | ApiUpdateDappSendTransactions
  | ApiUpdateDappConnect
  | ApiUpdateDappDisconnect
  | ApiUpdateBackendStakingState
  | ApiUpdatePrepareTransaction
  | ApiUpdateShowError
  | ApiUpdateNfts
  | ApiNftUpdate;

export type OnApiUpdate = (update: ApiUpdate) => void;
