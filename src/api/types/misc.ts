export type ApiBlockchainKey = 'ton';
export type ApiNetwork = 'mainnet' | 'testnet';

export interface AccountIdParsed {
  id: number;
  blockchain: ApiBlockchainKey;
  network: ApiNetwork;
}

export interface ApiInitArgs {
  origin: string;
  newestTxId?: string;
}

export interface ApiBaseToken {
  name: string;
  symbol: string;
  slug: string;
  decimals: number;
  minterAddress?: string;
  image?: string;
  id?: number;
}

export interface ApiToken extends ApiBaseToken {
  quote: {
    price: number;
    percentChange1h: number;
    percentChange24h: number;
    percentChange7d: number;
    percentChange30d: number;
    history24h?: ApiHistoryList;
    history7d?: ApiHistoryList;
    history30d?: ApiHistoryList;
  };
}

export type ApiTransactionType = 'stake' | 'unstake' | 'unstakeRequest' | undefined;

export interface ApiTransaction {
  txId: string;
  timestamp: number;
  amount: string;
  fromAddress: string;
  toAddress: string;
  comment?: string;
  fee: string;
  slug?: string;
  isIncoming: boolean;
  type?: ApiTransactionType;
}

export enum ApiTransactionDraftError {
  InvalidAmount = 'InvalidAmount',
  InvalidToAddress = 'InvalidToAddress',
  InsufficientBalance = 'InsufficientBalance',
  Unexpected = 'Unexpected',
  DomainNotResolved = 'DomainNotResolved',
}

export interface ApiNft {
  index: number;
  name?: string;
  address: string;
  thumbnail: string;
  image: string;
  collectionName: string;
  collectionAddress: string;
  isOnSale: boolean;
}

export type ApiHistoryList = Array<[number, number]>;
export type ApiTokenSimple = Omit<ApiToken, 'quote'>;

export interface ApiPoolState {
  startOfCycle: number;
  endOfCycle: number;
  lastApy: number;
  minStake: number;
}

export interface ApiStakingState {
  amount: number;
  pendingDepositAmount: number;
  isUnstakeRequested: boolean;
}

export interface ApiBackendStakingState {
  poolAddress: string;
  balance: number;
  totalProfit: number;
  poolState: ApiPoolState;
  profitHistory: {
    timestamp: number;
    profit: number;
  }[];
}

export interface ApiDapp {
  origin: string;
  url: string;
  name: string;
  iconUrl: string;
  manifestUrl: string;
}

export interface ApiDappPermissions {
  isAddressRequired?: boolean;
  isPasswordRequired?: boolean;
}

export type ApiDappRequest = {
  origin?: string;
  accountId?: string;
} | {
  origin: string;
  accountId: string;
};

export interface ApiDappTransaction {
  toAddress: string;
  amount: string;
  payload?: string;
}
