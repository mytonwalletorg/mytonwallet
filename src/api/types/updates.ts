import type { ApiTonWalletVersion } from '../chains/ton/types';
import type { ApiTonConnectProof } from '../tonConnect/types';
import type { ApiActivity, ApiTransactionActivity } from './activity';
import type { ApiStakingCommonData, ApiSwapAsset, ApiVestingInfo } from './backend';
import type { ApiAnyDisplayError } from './errors';
import type {
  ApiBalanceBySlug,
  ApiBaseCurrency,
  ApiChain,
  ApiCountryCode,
  ApiDappTransfer,
  ApiNft,
  ApiStakingState,
  ApiTokenWithPrice,
  ApiWalletInfo,
} from './misc';
import type { ApiParsedPayload } from './payload';
import type { ApiDapp, ApiTonWallet } from './storage';

export type ApiUpdateBalances = {
  type: 'updateBalances';
  accountId: string;
  chain: ApiChain;
  balances: ApiBalanceBySlug;
};

export type ApiUpdateNewActivities = {
  type: 'newActivities';
  accountId: string;
  chain?: ApiChain;
  activities: ApiActivity[];
  noForward?: boolean; // Forbid cyclic update redirection to/from NBS
};

export type ApiUpdateNewLocalTransaction = {
  type: 'newLocalTransaction';
  accountId: string;
  transaction: ApiTransactionActivity;
};

export type ApiUpdateTokens = {
  type: 'updateTokens';
  tokens: Record<string, ApiTokenWithPrice>;
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
  fee?: bigint;
  realFee?: bigint;
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
  error?: ApiAnyDisplayError | string;
};

export type ApiUpdateStaking = {
  type: 'updateStaking';
  accountId: string;
  states: ApiStakingState[];
  common: ApiStakingCommonData;
  totalProfit: bigint;
  shouldUseNominators?: boolean;
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
  transactions: ApiDappTransfer[];
  fee: bigint;
  vestingAddress?: string;
};

export type ApiUpdateDappConnect = {
  type: 'dappConnect';
  identifier?: string;
  promiseId: string;
  accountId: string;
  dapp: ApiDapp;
  permissions: {
    address: boolean;
    proof: boolean;
  };
  proof?: ApiTonConnectProof;
};

export type ApiUpdateDappConnectComplete = {
  type: 'dappConnectComplete';
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
  accountId?: string;
};

export type ApiUpdateDappCloseLoading = {
  type: 'dappCloseLoading';
};

export type ApiUpdateDapps = {
  type: 'updateDapps';
};

export type ApiUpdatePrepareTransaction = {
  type: 'prepareTransaction';
  toAddress: string;
  amount?: bigint;
  comment?: string;
  binPayload?: string;
  stateInit?: string;
};

export type ApiUpdateProcessDeeplink = {
  type: 'processDeeplink';
  url: string;
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
  newOwnerAddress: string;
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
  partial: Partial<ApiTonWallet>;
};

export type ApiUpdateConfig = {
  type: 'updateConfig';
  isLimited: boolean;
  isCopyStorageEnabled: boolean;
  supportAccountsCount?: number;
  countryCode?: ApiCountryCode;
  isAppUpdateRequired: boolean;
};

export type ApiUpdateWalletVersions = {
  type: 'updateWalletVersions';
  accountId: string;
  currentVersion: ApiTonWalletVersion;
  versions: ApiWalletInfo[];
};

export type ApiOpenUrl = {
  type: 'openUrl';
  url: string;
  isExternal?: boolean;
  title?: string;
  subtitle?: string;
};

export type ApiRequestReconnect = {
  type: 'requestReconnectApi';
};

export type ApiUpdateIncorrectTime = {
  type: 'incorrectTime';
};

export type ApiUpdateVesting = {
  type: 'updateVesting';
  accountId: string;
  vestingInfo: ApiVestingInfo[];
};

export type ApiUpdatingStatus = {
  type: 'updatingStatus';
  kind: 'balance' | 'activities';
  isUpdating?: boolean;
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
  | ApiUpdateDappConnectComplete
  | ApiUpdateDappDisconnect
  | ApiUpdateDappLoading
  | ApiUpdateDappCloseLoading
  | ApiUpdateDapps
  | ApiUpdatePrepareTransaction
  | ApiUpdateProcessDeeplink
  | ApiUpdateShowError
  | ApiUpdateNfts
  | ApiNftUpdate
  | ApiUpdateAccount
  | ApiUpdateConfig
  | ApiUpdateWalletVersions
  | ApiOpenUrl
  | ApiRequestReconnect
  | ApiUpdateIncorrectTime
  | ApiUpdateVesting
  | ApiUpdatingStatus;

export type OnApiUpdate = (update: ApiUpdate) => void;
