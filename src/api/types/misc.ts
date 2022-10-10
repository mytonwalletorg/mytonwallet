export interface ApiInitArgs {
  newestTxId?: string;
}

export interface ApiToken {
  name: string;
  symbol: string;
  slug: string;
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
  minterAddress?: string;
  image?: string;
}

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
