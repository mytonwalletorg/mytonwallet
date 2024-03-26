import type { ApiTonConnectProof } from '../tonConnect/types';
import type { ApiActivity, ApiTransactionActivity } from './activity';
import type { ApiStakingCommonData, ApiSwapAsset } from './backend';
import type { ApiAnyDisplayError } from './errors';
import type {
  ApiBackendStakingState,
  ApiBalanceBySlug,
  ApiBaseCurrency,
  ApiDappTransaction,
  ApiNft,
  ApiStakingState,
  ApiToken,
  ApiWalletInfo,
  ApiWalletVersion,
} from './misc';
import type { ApiParsedPayload } from './payload';
import type { ApiAccount, ApiDapp } from './storage';

export type ApiUpdateBalances = {
  type: 'updateBalances';
  accountId: string;
  balancesToUpdate: ApiBalanceBySlug;
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
  baseCurrency: ApiBaseCurrency;
};

export type ApiUpdateSwapTokens = {
  type: 'updateSwapTokens';
  tokens: Record<string, ApiSwapAsset>;
};

export type ApiUpdateCreateTransaction = {
  type: 'createTransaction';
  promiseId: string;
  toAddress: string;
  amount: bigint;
  fee: bigint;
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

export type ApiUpdateShowError = {
  type: 'showError';
  error?: ApiAnyDisplayError;
};

export type ApiUpdateStaking = {
  type: 'updateStaking';
  accountId: string;
  stakingCommonData: ApiStakingCommonData;
  stakingState: ApiStakingState;
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
  fee: bigint;
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

export type ApiUpdateDappLoading = {
  type: 'dappLoading';
  connectionType: 'connect' | 'sendTransaction';
  isSse?: boolean;
};

export type ApiUpdateDappCloseLoading = {
  type: 'dappCloseLoading';
};

export type ApiUpdatePrepareTransaction = {
  type: 'prepareTransaction';
  toAddress: string;
  amount?: bigint;
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

export type ApiUpdateAccount = {
  type: 'updateAccount';
  accountId: string;
  partial: Partial<ApiAccount>;
};

export type ApiUpdateConfig = {
  type: 'updateConfig';
  isLimited: boolean;
  isCopyStorageEnabled: boolean;
};

export type ApiUpdateWalletVersions = {
  type: 'updateWalletVersions';
  accountId: string;
  currentVersion: ApiWalletVersion;
  versions: ApiWalletInfo[];
};

export type ApiOpenUrl = {
  type: 'openUrl';
  url: string;
};

export type ApiRequestReconnect = {
  type: 'requestReconnectApi';
};

export type ApiUpdate =
  | ApiUpdateBalances
  | ApiUpdateNewActivities
  | ApiUpdateNewLocalTransaction
  | ApiUpdateTokens
  | ApiUpdateSwapTokens
  | ApiUpdateCreateTransaction
  | ApiUpdateCreateSignature
  | ApiUpdateStaking
  | ApiUpdateActiveDapp
  | ApiUpdateDappSendTransactions
  | ApiUpdateDappConnect
  | ApiUpdateDappDisconnect
  | ApiUpdateDappLoading
  | ApiUpdateDappCloseLoading
  | ApiUpdatePrepareTransaction
  | ApiUpdateShowError
  | ApiUpdateNfts
  | ApiNftUpdate
  | ApiUpdateAccount
  | ApiUpdateConfig
  | ApiUpdateWalletVersions
  | ApiOpenUrl
  | ApiRequestReconnect;

export type OnApiUpdate = (update: ApiUpdate) => void;
